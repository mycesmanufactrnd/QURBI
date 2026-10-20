import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import {
  CourierAuditLog,
  CourierProfile,
  CourierVerificationStatus,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryMethod,
  FarmerProfile,
  NotificationAudience,
  NotificationType,
  Order,
  OrderStatus,
  OrderTrackingEvent,
  ProofStage,
  RefundStatus,
  User,
  UserRole,
} from '../entities';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { deliveryCodeFor } from '../orders/delivery-code';
import { UploadsService } from '../uploads/uploads.service';
import { notify, notifyAdmins } from '../couriers/notify';
import {
  DeliverDto,
  FailDeliveryDto,
  PickupDto,
  ProofDto,
} from './dto/courier-job.dto';
import { haversineMeters, parseCoords } from './geo';

const ACTIVE_STATUSES = [
  DeliveryAssignmentStatus.ACCEPTED,
  DeliveryAssignmentStatus.PICKED_UP,
  DeliveryAssignmentStatus.IN_TRANSIT,
];
// Counts for "is this order already taken", including a finished delivery.
const HOLDING_STATUSES = [...ACTIVE_STATUSES, DeliveryAssignmentStatus.DELIVERED];

const MIN_PHOTOS: Record<ProofStage, number> = {
  [ProofStage.PICKUP]: 1,
  [ProofStage.TRANSIT]: 1,
  // One photo of the livestock, one of the handover.
  [ProofStage.DELIVERY]: 2,
  [ProofStage.FAILED]: 1,
};

// Anomalies an admin should look at. They are recorded on the tracking event
// and never block the courier — a flaky GPS must not strand a live animal.
export const PROOF_FLAGS = {
  LATE_UPLOAD: 'late_upload',
  GPS_MISMATCH: 'gps_mismatch',
  NO_DESTINATION_COORDS: 'no_destination_coords',
  FARMER_UNCONFIRMED: 'farmer_unconfirmed',
} as const;

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = () => ({
  deliveryRadiusM: envNumber('COURIER_DELIVERY_RADIUS_M', 300),
  pickupRadiusM: envNumber('COURIER_PICKUP_RADIUS_M', 500),
  maxAccuracyM: envNumber('COURIER_MAX_ACCURACY_M', 100),
  lateUploadMinutes: envNumber('COURIER_LATE_UPLOAD_MINUTES', 10),
  maxPhotoAgeHours: envNumber('COURIER_MAX_PHOTO_AGE_HOURS', 24),
  maxActiveJobs: envNumber('COURIER_MAX_ACTIVE_JOBS', 3),
});

interface ValidatedProof {
  images: string[];
  imageHashes: string[];
  flags: string[];
  capturedAt: Date;
  serverReceivedAt: Date;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  deviceInfo: string | null;
  location: string;
}

@Injectable()
export class CourierJobsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly uploadsService: UploadsService,
  ) {}

  // ---- reading -------------------------------------------------------

  // The pool: delivery orders the farmer released that nobody holds, in the
  // courier's service area. Hidden entirely while the courier is offline so
  // "offline" really means "stop sending me work". Buyer phone, street
  // address and the farmer's phone are withheld until the job is accepted.
  async availableJobs(profile: CourierProfile) {
    if (!profile.isOnline) return { offline: true, jobs: [] };

    const orders = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'item')
      .leftJoinAndSelect('item.livestock', 'livestock')
      .where('o.deliveryMethod = :method', { method: DeliveryMethod.DELIVERY })
      .andWhere('o.status = :status', { status: OrderStatus.PREPARING })
      .andWhere('o.readyForPickupAt IS NOT NULL')
      .andWhere('o.refundStatus <> :requested', {
        requested: RefundStatus.REQUESTED,
      })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.orderId = o.id AND da.status IN (:...held))',
        { held: HOLDING_STATUSES },
      )
      .orderBy('o.readyForPickupAt', 'ASC')
      .take(100)
      .getMany();

    const farms = await this.farmsFor(orders.map((o) => o.farmerId));
    const jobs = orders
      .filter((order) => this.servesFarm(profile, farms.get(order.farmerId)))
      .map((order) => this.toJobSummary(order, farms.get(order.farmerId), profile));
    return { offline: false, jobs };
  }

  async myJobs(profile: CourierProfile, scope: 'active' | 'history') {
    const statuses =
      scope === 'active'
        ? ACTIVE_STATUSES
        : [
            DeliveryAssignmentStatus.DELIVERED,
            DeliveryAssignmentStatus.FAILED,
            DeliveryAssignmentStatus.CANCELLED,
          ];
    const assignments = await this.dataSource
      .getRepository(DeliveryAssignment)
      .find({
        where: { courierProfileId: profile.id, status: In(statuses) },
        relations: { order: { items: { livestock: true } } },
        order: { updatedAt: 'DESC' },
        take: scope === 'active' ? 50 : 100,
      });
    const farms = await this.farmsFor(assignments.map((a) => a.order.farmerId));
    return assignments.map((assignment) => ({
      ...this.toJobSummary(
        assignment.order,
        farms.get(assignment.order.farmerId),
        profile,
      ),
      assignment: this.publicAssignment(assignment),
    }));
  }

  // Full detail for the assigned courier; a pool preview for any other
  // approved courier (same fields as the list — no contact details).
  async jobDetail(orderId: string, profile: CourierProfile) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: { items: { livestock: true } },
    });
    if (!order) throw new NotFoundException('Job not found');
    const farm = (await this.farmsFor([order.farmerId])).get(order.farmerId);
    const mine = await this.dataSource.getRepository(DeliveryAssignment).findOne({
      where: { orderId, courierProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });

    if (!mine) {
      const heldByOther = await this.dataSource
        .getRepository(DeliveryAssignment)
        .count({ where: { orderId, status: In(HOLDING_STATUSES) } });
      const inPool =
        order.deliveryMethod === DeliveryMethod.DELIVERY &&
        order.status === OrderStatus.PREPARING &&
        order.readyForPickupAt &&
        heldByOther === 0 &&
        profile.isOnline &&
        this.servesFarm(profile, farm);
      if (!inPool) throw new NotFoundException('Job not found');
      return { ...this.toJobSummary(order, farm, profile), assignment: null };
    }

    const isActive = ACTIVE_STATUSES.includes(mine.status);
    const events = await this.dataSource.getRepository(OrderTrackingEvent).find({
      where: { orderId, deliveryAssignmentId: mine.id },
      order: { createdAt: 'ASC' },
    });
    const farmer = isActive
      ? await this.dataSource
          .getRepository(User)
          .findOne({ where: { id: order.farmerId } })
      : null;
    return {
      ...this.toJobSummary(order, farm, profile),
      assignment: this.publicAssignment(mine),
      events,
      // Contact and street-level details only while the job is live.
      destination: isActive ? order.deliveryAddress : null,
      pickup: isActive && farm
        ? {
            farmName: farm.farmName,
            addressLine: farm.farmAddressLine,
            city: farm.farmCity,
            state: farm.farmState,
            postcode: farm.farmPostcode,
            latitude: farm.farmLatitude,
            longitude: farm.farmLongitude,
          }
        : null,
      contacts: isActive
        ? {
            buyer: {
              name: order.deliveryAddress?.recipientName ?? null,
              phone: order.deliveryAddress?.recipientPhone ?? null,
            },
            farmer: {
              name: farmer?.fullName ?? null,
              phone: farmer?.phone ?? null,
            },
          }
        : null,
    };
  }

  // Money the courier has earned, in Malaysia time (UTC+8, no DST) because
  // "today" and "this week" mean the courier's calendar, not the server's.
  // Only DELIVERED jobs count, at the amount snapshotted when they accepted.
  async earnings(profile: CourierProfile) {
    const delivered = await this.dataSource
      .getRepository(DeliveryAssignment)
      .find({
        where: {
          courierProfileId: profile.id,
          status: DeliveryAssignmentStatus.DELIVERED,
        },
        relations: { order: true },
        order: { deliveredAt: 'DESC' },
        take: 1000,
      });

    const MYT_OFFSET_MS = 8 * 3_600_000;
    const dayStart = (date: Date) => {
      const shifted = new Date(date.getTime() + MYT_OFFSET_MS);
      shifted.setUTCHours(0, 0, 0, 0);
      return shifted.getTime() - MYT_OFFSET_MS;
    };
    // Weeks run Monday to Sunday.
    const weekStart = (date: Date) => {
      const start = dayStart(date);
      const shifted = new Date(start + MYT_OFFSET_MS);
      const sinceMonday = (shifted.getUTCDay() + 6) % 7;
      return start - sinceMonday * 86_400_000;
    };

    const now = new Date();
    const todayStart = dayStart(now);
    const thisWeekStart = weekStart(now);
    const shiftedNow = new Date(now.getTime() + MYT_OFFSET_MS);
    const monthStart =
      Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), 1) -
      MYT_OFFSET_MS;

    const totals = { today: 0, week: 0, month: 0, allTime: 0 };
    const counts = { today: 0, week: 0, month: 0, allTime: 0 };
    const weeks = new Map<number, { amount: number; deliveries: number }>();
    for (const assignment of delivered) {
      const at = assignment.deliveredAt ?? assignment.updatedAt;
      const amount = Number(assignment.earningAmount);
      const time = at.getTime();
      totals.allTime += amount;
      counts.allTime += 1;
      if (time >= monthStart) {
        totals.month += amount;
        counts.month += 1;
      }
      if (time >= thisWeekStart) {
        totals.week += amount;
        counts.week += 1;
      }
      if (time >= todayStart) {
        totals.today += amount;
        counts.today += 1;
      }
      const key = weekStart(at);
      const bucket = weeks.get(key) ?? { amount: 0, deliveries: 0 };
      bucket.amount += amount;
      bucket.deliveries += 1;
      weeks.set(key, bucket);
    }
    const money = (value: number) => value.toFixed(2);

    return {
      timezone: 'Asia/Kuala_Lumpur',
      totals: {
        today: money(totals.today),
        week: money(totals.week),
        month: money(totals.month),
        allTime: money(totals.allTime),
      },
      deliveries: counts,
      rate: {
        approvedFee: profile.approvedFee,
        proposedFee: profile.proposedFee,
        status: profile.rateStatus,
        rejectionReason: profile.rateRejectionReason,
      },
      weeks: [...weeks.entries()]
        .sort((a, b) => b[0] - a[0])
        .slice(0, 12)
        .map(([start, bucket]) => ({
          weekStart: new Date(start).toISOString(),
          amount: money(bucket.amount),
          deliveries: bucket.deliveries,
        })),
      recent: delivered.slice(0, 20).map((assignment) => ({
        orderId: assignment.orderId,
        orderNumber: assignment.order?.orderNumber ?? null,
        amount: assignment.earningAmount,
        deliveredAt: assignment.deliveredAt,
      })),
    };
  }

  // What the buyer, farmer and admin see about the courier on an order.
  async orderSummary(orderId: string, viewer: AuthenticatedUser) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
    });
    const isParty =
      !!order &&
      (viewer.role === UserRole.ADMIN ||
        (viewer.role === UserRole.BUYER && order.buyerId === viewer.id) ||
        (viewer.role === UserRole.FARMER && order.farmerId === viewer.id));
    if (!order || !isParty) throw new NotFoundException('Order not found');

    const assignment = await this.dataSource
      .getRepository(DeliveryAssignment)
      .findOne({
        where: { orderId },
        relations: { courierProfile: { user: true } },
        order: { createdAt: 'DESC' },
      });
    const state = !order.readyForPickupAt
      ? 'not_requested'
      : !assignment || !ACTIVE_STATUSES.concat(DeliveryAssignmentStatus.DELIVERED).includes(assignment.status)
        ? 'waiting_for_courier'
        : assignment.status;
    return {
      orderId,
      readyForPickupAt: order.readyForPickupAt,
      state: assignment?.status === DeliveryAssignmentStatus.FAILED ? 'failed' : state,
      courier:
        assignment && assignment.status !== DeliveryAssignmentStatus.CANCELLED
          ? {
              name: assignment.courierProfile.user.fullName,
              vehicleType: assignment.courierProfile.vehicleType,
              vehiclePlate: assignment.courierProfile.vehiclePlate,
              ratingAverage: assignment.courierProfile.ratingAverage,
              ratingCount: assignment.courierProfile.ratingCount,
            }
          : null,
      assignment: assignment ? this.publicAssignment(assignment) : null,
    };
  }

  // ---- accepting -----------------------------------------------------

  async accept(orderId: string, profile: CourierProfile) {
    if (!profile.isOnline) {
      throw new ConflictException('Go online before accepting jobs');
    }
    return this.dataSource.transaction(async (manager) => {
      const cfg = config();
      // The order lock must be the FIRST read of the transaction. Under
      // REPEATABLE READ the first plain read pins the snapshot; taking it
      // before the lock would hide the winner's assignment from the loser.
      const order = await this.lockOrder(manager, orderId);
      const activeCount = await manager.count(DeliveryAssignment, {
        where: { courierProfileId: profile.id, status: In(ACTIVE_STATUSES) },
      });
      if (activeCount >= cfg.maxActiveJobs) {
        throw new ConflictException(
          `You can hold at most ${cfg.maxActiveJobs} active jobs at a time`,
        );
      }
      const farm = (await this.farmsFor([order.farmerId], manager)).get(
        order.farmerId,
      );
      if (!this.servesFarm(profile, farm)) {
        throw new ForbiddenException('This job is outside your service area');
      }
      if (order.status !== OrderStatus.PREPARING) {
        throw new ConflictException('This job is no longer available');
      }
      return this.createAssignment(manager, order, profile, false);
    });
  }

  // Admin puts a specific courier on an order, e.g. when the pool is stuck or
  // to take over after a failed delivery. Skips the online/area checks (the
  // admin is responsible) but never the approval check.
  async adminAssign(orderId: string, courierProfileId: string, admin: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(CourierProfile, {
        where: { id: courierProfileId },
      });
      if (
        !profile ||
        profile.verificationStatus !== CourierVerificationStatus.APPROVED
      ) {
        throw new BadRequestException('That courier is not approved');
      }
      const order = await this.lockOrder(manager, orderId);
      if (
        order.status !== OrderStatus.PREPARING &&
        order.status !== OrderStatus.IN_TRANSIT
      ) {
        throw new ConflictException(
          `An order that is ${order.status} cannot be assigned`,
        );
      }
      const created = await this.createAssignment(manager, order, profile, true);
      await manager.save(
        manager.create(CourierAuditLog, {
          actorUserId: admin.id,
          courierProfileId: profile.id,
          action: 'admin_assigned',
          detail: { orderId },
        }),
      );
      return created;
    });
  }

  // Row-locks the order so two couriers accepting at the same instant are
  // serialized: the second one sees the first one's assignment and loses.
  private async lockOrder(manager: EntityManager, orderId: string): Promise<Order> {
    const order = await manager.findOne(Order, {
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order || order.deliveryMethod !== DeliveryMethod.DELIVERY) {
      throw new NotFoundException('Job not found');
    }
    return order;
  }

  private async createAssignment(
    manager: EntityManager,
    order: Order,
    profile: CourierProfile,
    byAdmin: boolean,
  ): Promise<DeliveryAssignment> {
    if (!order.readyForPickupAt && !byAdmin) {
      throw new ConflictException('This job is not ready for pickup yet');
    }
    if (order.refundStatus === RefundStatus.REQUESTED) {
      throw new ConflictException('This order has a pending refund request');
    }
    // A locking read, so it sees the latest committed assignments rather
    // than this transaction's snapshot.
    const held = await manager.find(DeliveryAssignment, {
      where: { orderId: order.id, status: In(HOLDING_STATUSES) },
      lock: { mode: 'pessimistic_write' },
    });
    if (held.length > 0) {
      throw new ConflictException('This job was just taken by another courier');
    }

    const now = new Date();
    // An admin can hand an already-moving order to a new courier; the new
    // assignment then starts where the order is, not at "accepted".
    const resumeInTransit = order.status === OrderStatus.IN_TRANSIT;
    const assignment = await manager.save(
      manager.create(DeliveryAssignment, {
        orderId: order.id,
        courierProfileId: profile.id,
        courierUserId: profile.userId,
        status: resumeInTransit
          ? DeliveryAssignmentStatus.IN_TRANSIT
          : DeliveryAssignmentStatus.ACCEPTED,
        earningAmount: (profile.approvedFee ?? order.deliveryFee ?? '0') as string,
        assignedByAdmin: byAdmin,
        acceptedAt: now,
        pickedUpAt: resumeInTransit ? now : null,
        inTransitAt: resumeInTransit ? now : null,
      }),
    );
    if (byAdmin && !order.readyForPickupAt) {
      order.readyForPickupAt = now;
      await manager.save(order);
    }

    const courier = await manager.findOneOrFail(CourierProfile, {
      where: { id: profile.id },
      relations: { user: true },
    });
    await notify(manager, {
      userId: order.farmerId,
      audience: NotificationAudience.FARMER,
      type: NotificationType.DELIVERY,
      title: 'A courier accepted your order',
      body: `${courier.user.fullName} (${courier.vehiclePlate}) will collect order #${order.orderNumber}. Have the livestock ready for handover.`,
      linkUrl: `/orders/${order.id}`,
      relatedType: 'delivery_assignment',
      relatedId: assignment.id,
    });
    await notify(manager, {
      userId: order.buyerId,
      audience: NotificationAudience.BUYER,
      type: NotificationType.DELIVERY,
      title: 'A courier is assigned to your order',
      body: `${courier.user.fullName} will deliver order #${order.orderNumber}.`,
      linkUrl: `/orders/${order.id}`,
      relatedType: 'delivery_assignment',
      relatedId: assignment.id,
    });
    return assignment;
  }

  // The courier backs out before collecting the animal. The order goes
  // straight back to the pool.
  async release(orderId: string, profile: CourierProfile, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const assignment = await this.ownAssignment(manager, order.id, profile, [
        DeliveryAssignmentStatus.ACCEPTED,
      ]);
      assignment.status = DeliveryAssignmentStatus.CANCELLED;
      assignment.cancelledAt = new Date();
      assignment.resolutionNote = reason?.trim() || 'Released by courier';
      await manager.save(assignment);
      order.poolAlertedAt = null;
      order.readyForPickupAt = new Date();
      await manager.save(order);
      await notify(manager, {
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.DELIVERY,
        title: 'Courier dropped your order',
        body: `The courier for order #${order.orderNumber} is no longer available. It is back in the courier pool.`,
        linkUrl: `/orders/${order.id}`,
        relatedType: 'delivery_assignment',
        relatedId: assignment.id,
      });
      return this.publicAssignment(assignment);
    });
  }

  // Farmer signs off that the animal was handed over to the courier.
  async farmerConfirmHandover(orderId: string, farmer: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order || order.farmerId !== farmer.id) {
        throw new NotFoundException('Order not found');
      }
      const assignment = await manager.findOne(DeliveryAssignment, {
        where: {
          orderId,
          status: In([
            DeliveryAssignmentStatus.ACCEPTED,
            DeliveryAssignmentStatus.PICKED_UP,
          ]),
        },
      });
      if (!assignment) {
        throw new ConflictException('There is no courier at pickup for this order');
      }
      assignment.farmerHandoverConfirmedAt ??= new Date();
      await manager.save(assignment);
      return this.publicAssignment(assignment);
    });
  }

  // ---- the three delivery stages -------------------------------------

  async pickup(orderId: string, profile: CourierProfile, dto: PickupDto) {
    const { earTagMatches, animalHealthy, animalSecured } = dto.checklist;
    if (!earTagMatches || !animalHealthy || !animalSecured) {
      throw new BadRequestException(
        'Do not collect the animal until the ear tag matches and it is healthy and secured. Report the problem instead.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const assignment = await this.ownAssignment(manager, order.id, profile, [
        DeliveryAssignmentStatus.ACCEPTED,
      ]);
      if (order.status !== OrderStatus.PREPARING) {
        throw new ConflictException(`Order is ${order.status}, not ready for pickup`);
      }
      const farm = (await this.farmsFor([order.farmerId], manager)).get(
        order.farmerId,
      );
      const proof = await this.validateProof(
        manager,
        profile,
        ProofStage.PICKUP,
        dto,
        {
          point: parseCoords(farm?.farmLatitude, farm?.farmLongitude),
          radiusM: config().pickupRadiusM,
        },
      );
      if (!assignment.farmerHandoverConfirmedAt) {
        proof.flags.push(PROOF_FLAGS.FARMER_UNCONFIRMED);
      }

      // Pickup does not change the order status (it is already "preparing"),
      // so the event is appended directly instead of through
      // applyStatusChange.
      const event = await manager.save(
        manager.create(OrderTrackingEvent, {
          orderId: order.id,
          status: order.status,
          note: dto.note ?? 'Courier collected the livestock from the farm',
          ...this.eventFields(proof, profile.userId, assignment.id, ProofStage.PICKUP),
        }),
      );
      assignment.status = DeliveryAssignmentStatus.PICKED_UP;
      assignment.pickedUpAt = new Date();
      assignment.pickupChecklist = dto.checklist;
      assignment.delayAlertedAt = null;
      await manager.save(assignment);

      await notify(manager, {
        userId: order.buyerId,
        audience: NotificationAudience.BUYER,
        type: NotificationType.DELIVERY,
        title: 'Your livestock was collected',
        body: `The courier collected order #${order.orderNumber} from the farm.`,
        linkUrl: `/orders/${order.id}`,
        relatedType: 'order_tracking_event',
        relatedId: event.id,
      });
      await this.flagAlert(manager, order, proof.flags, assignment.id);
      return this.publicAssignment(assignment);
    });
  }

  async startTransit(orderId: string, profile: CourierProfile, dto: ProofDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const assignment = await this.ownAssignment(manager, order.id, profile, [
        DeliveryAssignmentStatus.PICKED_UP,
      ]);
      const proof = await this.validateProof(
        manager,
        profile,
        ProofStage.TRANSIT,
        dto,
      );
      await this.ordersService.applyStatusChange(
        manager,
        order,
        OrderStatus.IN_TRANSIT,
        {
          note: dto.note ?? 'Courier is on the way',
          images: proof.images,
          location: proof.location,
          userId: profile.userId,
          proof: this.eventFields(proof, profile.userId, assignment.id, ProofStage.TRANSIT),
          buyerNotice: {
            title: 'Your order is on the way',
            body: 'The courier shared a live photo on the road. Open your order to follow it.',
          },
        },
      );
      assignment.status = DeliveryAssignmentStatus.IN_TRANSIT;
      assignment.inTransitAt = new Date();
      assignment.delayAlertedAt = null;
      await manager.save(assignment);
      await this.flagAlert(manager, order, proof.flags, assignment.id);
      return this.publicAssignment(assignment);
    });
  }

  async deliver(orderId: string, profile: CourierProfile, dto: DeliverDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const assignment = await this.ownAssignment(manager, order.id, profile, [
        DeliveryAssignmentStatus.IN_TRANSIT,
      ]);
      const expected = deliveryCodeFor(assignment.id);
      const given = Buffer.from(dto.code);
      const wanted = Buffer.from(expected);
      if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
        throw new BadRequestException(
          'The delivery code is wrong. Ask the buyer to open the code in their order page.',
        );
      }

      const destination = parseCoords(
        order.deliveryAddress?.latitude,
        order.deliveryAddress?.longitude,
      );
      const proof = await this.validateProof(
        manager,
        profile,
        ProofStage.DELIVERY,
        dto,
        { point: destination, radiusM: config().deliveryRadiusM },
      );
      await this.ordersService.applyStatusChange(
        manager,
        order,
        OrderStatus.DELIVERED,
        {
          note: dto.note ?? 'Delivered by courier, handover code confirmed',
          images: proof.images,
          location: proof.location,
          userId: profile.userId,
          proof: this.eventFields(proof, profile.userId, assignment.id, ProofStage.DELIVERY),
          buyerNotice: {
            title: 'Your order has arrived',
            body: 'The courier uploaded the handover proof. Open your order to review it and confirm receipt.',
          },
        },
      );
      assignment.status = DeliveryAssignmentStatus.DELIVERED;
      assignment.deliveredAt = new Date();
      await manager.save(assignment);
      await manager.increment(
        CourierProfile,
        { id: profile.id },
        'totalDeliveries',
        1,
      );
      await notify(manager, {
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.DELIVERY,
        title: 'Order delivered',
        body: `Order #${order.orderNumber} was delivered to the buyer by the courier.`,
        linkUrl: `/orders/${order.id}`,
        relatedType: 'delivery_assignment',
        relatedId: assignment.id,
      });
      await this.flagAlert(manager, order, proof.flags, assignment.id);
      return this.publicAssignment(assignment);
    });
  }

  // Delivery could not be completed. The order status is left as it is (the
  // animal is still somewhere between farm and buyer); everyone is told and
  // an admin decides what happens next.
  async fail(orderId: string, profile: CourierProfile, dto: FailDeliveryDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const assignment = await this.ownAssignment(manager, order.id, profile, [
        DeliveryAssignmentStatus.ACCEPTED,
        DeliveryAssignmentStatus.PICKED_UP,
        DeliveryAssignmentStatus.IN_TRANSIT,
      ]);
      const proof = await this.validateProof(
        manager,
        profile,
        ProofStage.FAILED,
        dto,
      );
      const event = await manager.save(
        manager.create(OrderTrackingEvent, {
          orderId: order.id,
          status: order.status,
          note: `Delivery problem (${dto.category}): ${dto.reason}`,
          ...this.eventFields(proof, profile.userId, assignment.id, ProofStage.FAILED),
        }),
      );
      assignment.status = DeliveryAssignmentStatus.FAILED;
      assignment.failedAt = new Date();
      assignment.failureCategory = dto.category;
      assignment.failedReason = dto.reason;
      await manager.save(assignment);

      const message = `Order #${order.orderNumber}: ${dto.reason}`;
      await notify(manager, {
        userId: order.buyerId,
        audience: NotificationAudience.BUYER,
        type: NotificationType.DELIVERY,
        title: 'There is a problem with your delivery',
        body: `${message} Our team is looking into it.`,
        linkUrl: `/orders/${order.id}`,
        relatedType: 'order_tracking_event',
        relatedId: event.id,
      });
      await notify(manager, {
        userId: order.farmerId,
        audience: NotificationAudience.FARMER,
        type: NotificationType.DELIVERY,
        title: 'Delivery problem reported',
        body: `${message} Our team is looking into it.`,
        linkUrl: `/orders/${order.id}`,
        relatedType: 'order_tracking_event',
        relatedId: event.id,
      });
      await notifyAdmins(manager, {
        type: NotificationType.DELIVERY,
        title: 'Failed delivery needs a decision',
        body: `${message} (${dto.category})`,
        linkUrl: `/admin/deliveries`,
        relatedType: 'delivery_assignment',
        relatedId: assignment.id,
      });
      return this.publicAssignment(assignment);
    });
  }

  // ---- admin ---------------------------------------------------------

  async adminList(filter: { status?: DeliveryAssignmentStatus; flagged?: boolean }) {
    const assignments = await this.dataSource
      .getRepository(DeliveryAssignment)
      .find({
        where: filter.status
          ? { status: filter.status }
          : { status: Not(DeliveryAssignmentStatus.CANCELLED) },
        relations: { order: true, courierProfile: { user: true } },
        order: { updatedAt: 'DESC' },
        take: 200,
      });
    const events = assignments.length
      ? await this.dataSource.getRepository(OrderTrackingEvent).find({
          where: { deliveryAssignmentId: In(assignments.map((a) => a.id)) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const rows = assignments.map((assignment) => {
      const own = events.filter((e) => e.deliveryAssignmentId === assignment.id);
      const flags = [...new Set(own.flatMap((e) => e.flags ?? []))];
      return {
        ...this.publicAssignment(assignment),
        order: {
          id: assignment.order.id,
          orderNumber: assignment.order.orderNumber,
          status: assignment.order.status,
        },
        courier: {
          id: assignment.courierProfileId,
          name: assignment.courierProfile.user.fullName,
          vehiclePlate: assignment.courierProfile.vehiclePlate,
        },
        flags,
        events: own,
      };
    });
    return filter.flagged
      ? rows.filter(
          (row) =>
            row.flags.length > 0 ||
            row.status === DeliveryAssignmentStatus.FAILED,
        )
      : rows;
  }

  // Closes out a failed delivery with the admin's decision recorded. Putting
  // the order back on the road is done with adminAssign; refunding it with
  // the existing refund tooling.
  async adminResolve(assignmentId: string, admin: AuthenticatedUser, note: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.findOne(DeliveryAssignment, {
        where: { id: assignmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment) throw new NotFoundException('Assignment not found');
      if (assignment.status !== DeliveryAssignmentStatus.FAILED) {
        throw new ConflictException('Only failed deliveries need resolving');
      }
      assignment.resolutionNote = note.trim();
      await manager.save(assignment);
      await manager.save(
        manager.create(CourierAuditLog, {
          actorUserId: admin.id,
          courierProfileId: assignment.courierProfileId,
          action: 'failure_resolved',
          detail: { assignmentId, note: assignment.resolutionNote },
        }),
      );
      return this.publicAssignment(assignment);
    });
  }

  // ---- proof validation ----------------------------------------------

  // Everything the server can check about a "live" photo without trusting the
  // client: the files are the courier's own private image uploads, none of
  // them was ever used on any order before (hash of the stored bytes), the
  // GPS fix is present and tight enough, and the capture time is plausible.
  // Location mismatches and late uploads are flagged, not rejected.
  private async validateProof(
    manager: EntityManager,
    profile: CourierProfile,
    stage: ProofStage,
    dto: ProofDto,
    target?: { point: { lat: number; lng: number } | null; radiusM: number },
  ): Promise<ValidatedProof> {
    const cfg = config();
    const min = MIN_PHOTOS[stage];
    if (dto.photos.length < min) {
      throw new BadRequestException(
        `At least ${min} live photo${min > 1 ? 's are' : ' is'} required for this step`,
      );
    }
    if (new Set(dto.photos).size !== dto.photos.length) {
      throw new BadRequestException('The same photo was attached twice');
    }
    if (dto.meta.accuracy > cfg.maxAccuracyM) {
      throw new BadRequestException(
        `GPS accuracy is too low (${Math.round(dto.meta.accuracy)} m). Move to an open area and try again.`,
      );
    }

    const capturedAt = new Date(dto.meta.capturedAt);
    const serverReceivedAt = new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      throw new BadRequestException('capturedAt is not a valid timestamp');
    }
    const ageMs = serverReceivedAt.getTime() - capturedAt.getTime();
    if (ageMs < -2 * 60_000) {
      throw new BadRequestException(
        'The photo timestamp is in the future. Check your phone clock.',
      );
    }
    if (ageMs > cfg.maxPhotoAgeHours * 3_600_000) {
      throw new BadRequestException(
        'This photo is too old to be accepted as live proof',
      );
    }

    const images: string[] = [];
    const imageHashes: string[] = [];
    for (const url of dto.photos) {
      const stored = await this.uploadsService.readOwnedPrivateImage(
        url,
        profile.userId,
      );
      const reused = await manager
        .getRepository(OrderTrackingEvent)
        .createQueryBuilder('event')
        .where('JSON_CONTAINS(event.imageHashes, :hash)', {
          hash: JSON.stringify(stored.sha256),
        })
        .getCount();
      if (reused > 0) {
        throw new ConflictException(
          'One of these photos was already submitted. Take a new photo.',
        );
      }
      images.push(stored.url);
      imageHashes.push(stored.sha256);
    }

    const flags: string[] = [];
    if (ageMs > cfg.lateUploadMinutes * 60_000) {
      flags.push(PROOF_FLAGS.LATE_UPLOAD);
    }
    if (target) {
      if (!target.point) {
        flags.push(PROOF_FLAGS.NO_DESTINATION_COORDS);
      } else {
        const distance = haversineMeters(
          { lat: dto.meta.latitude, lng: dto.meta.longitude },
          target.point,
        );
        if (distance > target.radiusM + dto.meta.accuracy) {
          flags.push(PROOF_FLAGS.GPS_MISMATCH);
        }
      }
    }

    return {
      images,
      imageHashes,
      flags,
      capturedAt,
      serverReceivedAt,
      latitude: dto.meta.latitude,
      longitude: dto.meta.longitude,
      accuracyMeters: Math.round(dto.meta.accuracy),
      deviceInfo: dto.meta.deviceInfo?.slice(0, 255) ?? null,
      location: `${dto.meta.latitude.toFixed(6)},${dto.meta.longitude.toFixed(6)}`,
    };
  }

  private eventFields(
    proof: ValidatedProof,
    userId: string,
    assignmentId: string,
    stage: ProofStage,
  ) {
    return {
      images: proof.images,
      location: proof.location,
      createdByUserId: userId,
      stage,
      deliveryAssignmentId: assignmentId,
      capturedAt: proof.capturedAt,
      serverReceivedAt: proof.serverReceivedAt,
      latitude: proof.latitude.toFixed(7),
      longitude: proof.longitude.toFixed(7),
      accuracyMeters: proof.accuracyMeters,
      imageHashes: proof.imageHashes,
      flags: proof.flags.length ? proof.flags : null,
      deviceInfo: proof.deviceInfo,
    };
  }

  // Tells admins as soon as a step is flagged instead of waiting for them to
  // open the dashboard.
  private async flagAlert(
    manager: EntityManager,
    order: Order,
    flags: string[],
    assignmentId: string,
  ): Promise<void> {
    if (!flags.length) return;
    await notifyAdmins(manager, {
      type: NotificationType.DELIVERY,
      title: 'Delivery proof flagged',
      body: `Order #${order.orderNumber}: ${flags.join(', ').replace(/_/g, ' ')}`,
      linkUrl: '/admin/deliveries',
      relatedType: 'delivery_assignment',
      relatedId: assignmentId,
    });
  }

  // ---- helpers -------------------------------------------------------

  private async ownAssignment(
    manager: EntityManager,
    orderId: string,
    profile: CourierProfile,
    allowed: DeliveryAssignmentStatus[],
  ): Promise<DeliveryAssignment> {
    const assignment = await manager.findOne(DeliveryAssignment, {
      where: { orderId, courierProfileId: profile.id },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!assignment) throw new NotFoundException('Job not found');
    if (!allowed.includes(assignment.status)) {
      throw new ConflictException(
        `This job is ${assignment.status.replace(/_/g, ' ')}, so that step is not available`,
      );
    }
    return assignment;
  }

  private async farmsFor(
    farmerIds: string[],
    manager?: EntityManager,
  ): Promise<Map<string, FarmerProfile>> {
    const ids = [...new Set(farmerIds)];
    if (!ids.length) return new Map();
    const repo = (manager ?? this.dataSource.manager).getRepository(FarmerProfile);
    const farms = await repo.find({ where: { userId: In(ids) } });
    return new Map(farms.map((farm) => [farm.userId, farm]));
  }

  private servesFarm(profile: CourierProfile, farm?: FarmerProfile): boolean {
    if (!farm) return false;
    const state = farm.farmState.trim().toLowerCase();
    const city = farm.farmCity.trim().toLowerCase();
    return profile.serviceAreas.some((area) => {
      if (area.state.trim().toLowerCase() !== state) return false;
      if (!area.districts?.length) return true;
      return area.districts.some((d) => d.trim().toLowerCase() === city);
    });
  }

  private publicAssignment(assignment: DeliveryAssignment) {
    return {
      id: assignment.id,
      orderId: assignment.orderId,
      status: assignment.status,
      earningAmount: assignment.earningAmount,
      acceptedAt: assignment.acceptedAt,
      pickedUpAt: assignment.pickedUpAt,
      inTransitAt: assignment.inTransitAt,
      deliveredAt: assignment.deliveredAt,
      failedAt: assignment.failedAt,
      failureCategory: assignment.failureCategory,
      failedReason: assignment.failedReason,
      resolutionNote: assignment.resolutionNote,
      farmerHandoverConfirmedAt: assignment.farmerHandoverConfirmedAt,
      assignedByAdmin: assignment.assignedByAdmin,
    };
  }

  // The pre-accept view: enough to decide, nothing that identifies the buyer
  // beyond the town they live in.
  private toJobSummary(
    order: Order,
    farm: FarmerProfile | undefined,
    profile: CourierProfile,
  ) {
    const from = parseCoords(farm?.farmLatitude, farm?.farmLongitude);
    const to = parseCoords(
      order.deliveryAddress?.latitude,
      order.deliveryAddress?.longitude,
    );
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      readyForPickupAt: order.readyForPickupAt,
      scheduledDate: order.scheduledDate,
      earning: (profile.approvedFee ?? order.deliveryFee) as string,
      earningIsApprovedRate: profile.approvedFee != null,
      distanceKm:
        from && to ? Math.round((haversineMeters(from, to) / 1000) * 10) / 10 : null,
      pickupArea: farm
        ? { farmName: farm.farmName, city: farm.farmCity, state: farm.farmState }
        : null,
      dropoffArea: {
        city: order.deliveryAddress?.city ?? null,
        state: order.deliveryAddress?.state ?? null,
        postcode: order.deliveryAddress?.postcode ?? null,
      },
      items: (order.items ?? []).map((item) => ({
        title: item.titleSnapshot,
        quantity: item.quantity,
        tagNumber: item.livestock?.tagNumber ?? null,
        weightKg: item.livestock?.weightKg ?? null,
      })),
    };
  }
}
