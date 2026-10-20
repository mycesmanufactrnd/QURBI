import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CourierProfile,
  CourierVerificationStatus,
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryMethod,
  FarmerProfile,
  Order,
  OrderStatus,
  ProofStage,
  RefundStatus,
} from '../entities';
import { deliveryCodeFor } from '../orders/delivery-code';
import { CourierJobsService } from './courier-jobs.service';

// @nestjs/typeorm@12 is ESM-only while this repository's Jest runtime is
// CommonJS; the services only need the decorator shapes here.
jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

process.env.JWT_SECRET = 'test-secret';

const NOW = new Date('2026-10-11T10:00:00.000Z');

const profile = {
  id: 'cp-1',
  userId: 'courier-user-1',
  verificationStatus: CourierVerificationStatus.APPROVED,
  isOnline: true,
  approvedFee: '12.00',
  serviceAreas: [{ state: 'Selangor' }],
} as unknown as CourierProfile;

const farm = {
  userId: 'farmer-1',
  farmName: 'Ladang Maju',
  farmCity: 'Klang',
  farmState: 'Selangor',
  farmLatitude: '3.0449000',
  farmLongitude: '101.4455000',
} as unknown as FarmerProfile;

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'QRB-1',
    buyerId: 'buyer-1',
    farmerId: 'farmer-1',
    status: OrderStatus.PREPARING,
    deliveryMethod: DeliveryMethod.DELIVERY,
    deliveryFee: '10.00',
    refundStatus: RefundStatus.NONE,
    readyForPickupAt: new Date('2026-10-11T08:00:00.000Z'),
    deliveryAddress: {
      recipientName: 'Aina',
      recipientPhone: '0123456789',
      city: 'Shah Alam',
      state: 'Selangor',
      postcode: '40000',
      latitude: '3.0738000',
      longitude: '101.5183000',
    },
    ...overrides,
  } as unknown as Order;
}

function proofBody(overrides: Record<string, unknown> = {}) {
  return {
    photos: ['/uploads/private/11111111-1111-1111-1111-111111111111'],
    meta: {
      latitude: 3.0449,
      longitude: 101.4455,
      accuracy: 12,
      capturedAt: new Date(NOW.getTime() - 30_000).toISOString(),
    },
    ...overrides,
  };
}

function setup(opts: { reusedHash?: boolean; orderRow?: Order; assignment?: Partial<DeliveryAssignment> | null; held?: number; active?: number } = {}) {
  const hashFor = (url: string) => `hash-of-${url}`;
  const uploadsService = {
    readOwnedPrivateImage: jest.fn(async (url: string) => ({
      id: 'f',
      url,
      sha256: hashFor(url),
    })),
  };
  const eventQuery = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(opts.reusedHash ? 1 : 0),
  };
  const assignmentRow = opts.assignment === null
    ? null
    : ({
        id: 'asg-1',
        orderId: 'order-1',
        courierProfileId: 'cp-1',
        courierUserId: 'courier-user-1',
        status: DeliveryAssignmentStatus.ACCEPTED,
        ...opts.assignment,
      } as DeliveryAssignment);
  const orderRow = opts.orderRow ?? order();
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Order) return orderRow;
      if (entity === DeliveryAssignment) return assignmentRow;
      return null;
    }),
    findOneOrFail: jest.fn(async () => ({
      ...profile,
      user: { fullName: 'Courier One' },
    })),
    find: jest.fn(async (entity: unknown) => {
      if (entity === FarmerProfile) return [farm];
      // createAssignment's locking "is this order already held" read.
      if (entity === DeliveryAssignment) {
        return Array.from({ length: opts.held ?? 0 }, () => ({}));
      }
      return [];
    }),
    count: jest.fn(async () => opts.active ?? 0),
    save: jest.fn(async (value: unknown) => value),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    increment: jest.fn(),
    getRepository: jest.fn((entity: unknown) =>
      entity === FarmerProfile
        ? { find: jest.fn(async () => [farm]) }
        : { createQueryBuilder: jest.fn(() => eventQuery) },
    ),
  };
  const dataSource = {
    manager,
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const ordersService = { applyStatusChange: jest.fn(async (_m: unknown, o: Order) => o) };
  const service = new CourierJobsService(
    dataSource as never,
    ordersService as never,
    uploadsService as never,
  );
  return { service, manager, ordersService, uploadsService, orderRow };
}

describe('CourierJobsService', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: NOW });
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  describe('proof validation', () => {
    type Validate = (
      manager: unknown,
      profile: CourierProfile,
      stage: ProofStage,
      dto: unknown,
      target?: unknown,
    ) => Promise<{ flags: string[]; imageHashes: string[]; location: string }>;
    const validate = (s: CourierJobsService): Validate =>
      (s as unknown as { validateProof: Validate }).validateProof.bind(s);

    it('accepts a fresh, accurate, on-site photo and records the server hash', async () => {
      const { service, manager } = setup();
      const result = await validate(service)(manager, profile, ProofStage.PICKUP, proofBody(), {
        point: { lat: 3.0449, lng: 101.4455 },
        radiusM: 500,
      });
      expect(result.flags).toEqual([]);
      expect(result.imageHashes).toEqual([
        'hash-of-/uploads/private/11111111-1111-1111-1111-111111111111',
      ]);
    });

    it('rejects a poor GPS fix', async () => {
      const { service, manager } = setup();
      const body = proofBody();
      (body.meta as { accuracy: number }).accuracy = 250;
      await expect(
        validate(service)(manager, profile, ProofStage.TRANSIT, body),
      ).rejects.toThrow(/accuracy is too low/);
    });

    it('rejects a timestamp from the future and one that is too old', async () => {
      const { service, manager } = setup();
      const future = proofBody();
      (future.meta as { capturedAt: string }).capturedAt = new Date(
        NOW.getTime() + 10 * 60_000,
      ).toISOString();
      await expect(
        validate(service)(manager, profile, ProofStage.TRANSIT, future),
      ).rejects.toThrow(/future/);

      const old = proofBody();
      (old.meta as { capturedAt: string }).capturedAt = new Date(
        NOW.getTime() - 25 * 3_600_000,
      ).toISOString();
      await expect(
        validate(service)(manager, profile, ProofStage.TRANSIT, old),
      ).rejects.toThrow(/too old/);
    });

    it('requires two photos at delivery', async () => {
      const { service, manager } = setup();
      await expect(
        validate(service)(manager, profile, ProofStage.DELIVERY, proofBody()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a photo that was already used on another order', async () => {
      const { service, manager } = setup({ reusedHash: true });
      await expect(
        validate(service)(manager, profile, ProofStage.TRANSIT, proofBody()),
      ).rejects.toThrow(ConflictException);
    });

    it('flags (does not reject) a delivery far from the address and a late upload', async () => {
      const { service, manager } = setup();
      const body = proofBody();
      (body.meta as { latitude: number }).latitude = 3.2;
      (body.meta as { capturedAt: string }).capturedAt = new Date(
        NOW.getTime() - 30 * 60_000,
      ).toISOString();
      const result = await validate(service)(
        manager,
        profile,
        ProofStage.TRANSIT,
        body,
        { point: { lat: 3.0738, lng: 101.5183 }, radiusM: 300 },
      );
      expect(result.flags).toEqual(['late_upload', 'gps_mismatch']);
    });

    it('flags a destination that has no coordinates', async () => {
      const { service, manager } = setup();
      const result = await validate(service)(
        manager,
        profile,
        ProofStage.TRANSIT,
        proofBody(),
        { point: null, radiusM: 300 },
      );
      expect(result.flags).toEqual(['no_destination_coords']);
    });
  });

  describe('accept', () => {
    it('lets an online courier in the service area take a released job', async () => {
      const { service, manager } = setup({ assignment: null });
      const result = await service.accept('order-1', profile);
      expect(result).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          courierProfileId: 'cp-1',
          status: DeliveryAssignmentStatus.ACCEPTED,
          earningAmount: '12.00',
        }),
      );
      // farmer + buyer are told
      expect(manager.create).toHaveBeenCalledTimes(3);
    });

    it('snapshots the order delivery fee when no rate is approved yet', async () => {
      const { service } = setup({ assignment: null });
      const result = await service.accept('order-1', {
        ...profile,
        approvedFee: null,
      } as unknown as CourierProfile);
      expect(result.earningAmount).toBe('10.00');
    });

    it('refuses while offline', async () => {
      const { service } = setup();
      await expect(
        service.accept('order-1', { ...profile, isOnline: false } as CourierProfile),
      ).rejects.toThrow(/online/);
    });

    it('refuses a job outside the service area', async () => {
      const { service } = setup();
      await expect(
        service.accept('order-1', {
          ...profile,
          serviceAreas: [{ state: 'Johor' }],
        } as CourierProfile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('loses the race when another courier already holds the order', async () => {
      const { service } = setup({ held: 1 });
      await expect(service.accept('order-1', profile)).rejects.toThrow(
        /just taken/,
      );
    });

    it('refuses an order that is not in preparing', async () => {
      const { service } = setup({ orderRow: order({ status: OrderStatus.IN_TRANSIT }) });
      await expect(service.accept('order-1', profile)).rejects.toThrow(
        /no longer available/,
      );
    });

    it('refuses an order with a pending refund request', async () => {
      const { service } = setup({
        orderRow: order({ refundStatus: RefundStatus.REQUESTED }),
      });
      await expect(service.accept('order-1', profile)).rejects.toThrow(
        /refund/,
      );
    });

    it('caps how many active jobs one courier can hold', async () => {
      const { service } = setup({ active: 3 });
      await expect(service.accept('order-1', profile)).rejects.toThrow(
        /at most 3/,
      );
    });
  });

  describe('stage rules', () => {
    it('will not collect the animal with a failed checklist item', async () => {
      const { service } = setup();
      await expect(
        service.pickup('order-1', profile, {
          ...proofBody(),
          checklist: { earTagMatches: false, animalHealthy: true, animalSecured: true },
        } as never),
      ).rejects.toThrow(/ear tag matches/);
    });

    it('cannot start the trip before pickup', async () => {
      const { service } = setup({
        assignment: { status: DeliveryAssignmentStatus.ACCEPTED },
      });
      await expect(
        service.startTransit('order-1', profile, proofBody() as never),
      ).rejects.toThrow(/accepted, so that step is not available/);
    });

    it('cannot deliver before the trip started', async () => {
      const { service } = setup({
        assignment: { status: DeliveryAssignmentStatus.PICKED_UP },
      });
      await expect(
        service.deliver('order-1', profile, {
          ...proofBody({ photos: ['/uploads/private/a', '/uploads/private/b'] }),
          code: '123456',
        } as never),
      ).rejects.toThrow(/picked up, so that step is not available/);
    });

    it('rejects a wrong handover code and accepts the right one', async () => {
      const photos = [
        '/uploads/private/11111111-1111-1111-1111-111111111111',
        '/uploads/private/22222222-2222-2222-2222-222222222222',
      ];
      const wrong = setup({
        assignment: { status: DeliveryAssignmentStatus.IN_TRANSIT },
      });
      const wrongCode = deliveryCodeFor('asg-1') === '000000' ? '111111' : '000000';
      await expect(
        wrong.service.deliver('order-1', profile, {
          ...proofBody({ photos }),
          code: wrongCode,
        } as never),
      ).rejects.toThrow(/delivery code is wrong/);
      expect(wrong.ordersService.applyStatusChange).not.toHaveBeenCalled();

      const right = setup({
        assignment: { status: DeliveryAssignmentStatus.IN_TRANSIT },
      });
      const result = await right.service.deliver('order-1', profile, {
        ...proofBody({ photos }),
        code: deliveryCodeFor('asg-1'),
      } as never);
      expect(result.status).toBe(DeliveryAssignmentStatus.DELIVERED);
      expect(right.ordersService.applyStatusChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        OrderStatus.DELIVERED,
        expect.objectContaining({
          userId: 'courier-user-1',
          images: photos,
          proof: expect.objectContaining({
            stage: ProofStage.DELIVERY,
            deliveryAssignmentId: 'asg-1',
          }),
        }),
      );
      expect(right.manager.increment).toHaveBeenCalledWith(
        CourierProfile,
        { id: 'cp-1' },
        'totalDeliveries',
        1,
      );
    });

    it("cannot act on another courier's job", async () => {
      const { service } = setup({ assignment: null });
      await expect(
        service.startTransit('order-1', profile, proofBody() as never),
      ).rejects.toThrow(/Job not found/);
    });
  });
});

describe('delivery code', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('is a stable 6-digit number per assignment and differs between assignments', () => {
    const a = deliveryCodeFor('asg-1');
    expect(a).toMatch(/^\d{6}$/);
    expect(deliveryCodeFor('asg-1')).toBe(a);
    expect(deliveryCodeFor('asg-2')).not.toBe(a);
  });
});
