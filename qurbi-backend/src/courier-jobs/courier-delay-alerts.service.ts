import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import {
  DeliveryAssignment,
  DeliveryAssignmentStatus,
  DeliveryMethod,
  NotificationAudience,
  NotificationType,
  Order,
  OrderStatus,
} from '../entities';
import { notify, notifyAdmins } from '../couriers/notify';

function envMinutes(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Alerts when a delivery stops moving. Each condition alerts once per stage
// (poolAlertedAt on the order, delayAlertedAt on the assignment, both reset
// when the stage changes), so a stuck job produces one alert, not one per
// scheduler run.
@Injectable()
export class CourierDelayAlertsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run(): Promise<{ pool: number; assignments: number }> {
    return {
      pool: await this.alertUnacceptedOrders(),
      assignments: await this.alertStalledAssignments(),
    };
  }

  // Released to the pool but nobody accepted it.
  private async alertUnacceptedOrders(): Promise<number> {
    const cutoff = new Date(
      Date.now() - envMinutes('COURIER_POOL_ALERT_MINUTES', 60) * 60_000,
    );
    const stale = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .where('o.deliveryMethod = :method', { method: DeliveryMethod.DELIVERY })
      .andWhere('o.status = :status', { status: OrderStatus.PREPARING })
      .andWhere('o.readyForPickupAt <= :cutoff', { cutoff })
      .andWhere('o.poolAlertedAt IS NULL')
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.orderId = o.id AND da.status IN (:...held))',
        {
          held: [
            DeliveryAssignmentStatus.ACCEPTED,
            DeliveryAssignmentStatus.PICKED_UP,
            DeliveryAssignmentStatus.IN_TRANSIT,
            DeliveryAssignmentStatus.DELIVERED,
          ],
        },
      )
      .take(50)
      .getMany();

    for (const order of stale) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(Order, order.id, { poolAlertedAt: new Date() });
        await notify(manager, {
          userId: order.farmerId,
          audience: NotificationAudience.FARMER,
          type: NotificationType.DELIVERY,
          title: 'Still waiting for a courier',
          body: `No courier has accepted order #${order.orderNumber} yet. We are looking into it.`,
          linkUrl: `/orders/${order.id}`,
          relatedType: 'order',
          relatedId: order.id,
        });
        await notifyAdmins(manager, {
          type: NotificationType.DELIVERY,
          title: 'Order has no courier',
          body: `Order #${order.orderNumber} has been waiting for a courier. Consider assigning one manually.`,
          linkUrl: '/admin/deliveries',
          relatedType: 'order',
          relatedId: order.id,
        });
      });
    }
    return stale.length;
  }

  // Accepted but not collected, or collected but not delivered, for too long.
  private async alertStalledAssignments(): Promise<number> {
    const now = Date.now();
    const limits: Array<[DeliveryAssignmentStatus, string, number, string]> = [
      [DeliveryAssignmentStatus.ACCEPTED, 'acceptedAt', envMinutes('COURIER_PICKUP_ALERT_MINUTES', 180), 'has not collected'],
      [DeliveryAssignmentStatus.PICKED_UP, 'pickedUpAt', envMinutes('COURIER_TRANSIT_ALERT_MINUTES', 60), 'has not started the trip for'],
      [DeliveryAssignmentStatus.IN_TRANSIT, 'inTransitAt', envMinutes('COURIER_DELIVERY_ALERT_MINUTES', 720), 'has not delivered'],
    ];
    let alerted = 0;
    for (const [status, field, minutes, phrase] of limits) {
      const cutoff = new Date(now - minutes * 60_000);
      const stalled = await this.dataSource
        .getRepository(DeliveryAssignment)
        .find({
          where: {
            status,
            delayAlertedAt: IsNull(),
            [field]: LessThanOrEqual(cutoff),
          },
          relations: { order: true },
          take: 50,
        });
      for (const assignment of stalled) {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(DeliveryAssignment, assignment.id, {
            delayAlertedAt: new Date(),
          });
          const { order } = assignment;
          const text = `The courier ${phrase} order #${order.orderNumber} in time.`;
          await notify(manager, {
            userId: order.farmerId,
            audience: NotificationAudience.FARMER,
            type: NotificationType.DELIVERY,
            title: 'Delivery is running late',
            body: text,
            linkUrl: `/orders/${order.id}`,
            relatedType: 'delivery_assignment',
            relatedId: assignment.id,
          });
          await notify(manager, {
            userId: assignment.courierUserId,
            audience: NotificationAudience.COURIER,
            type: NotificationType.DELIVERY,
            title: 'Please update your job',
            body: `Order #${order.orderNumber} has been waiting for your next step.`,
            linkUrl: `/jobs/${order.id}`,
            relatedType: 'delivery_assignment',
            relatedId: assignment.id,
          });
          await notifyAdmins(manager, {
            type: NotificationType.DELIVERY,
            title: 'Delivery is stalled',
            body: text,
            linkUrl: '/admin/deliveries',
            relatedType: 'delivery_assignment',
            relatedId: assignment.id,
          });
        });
        alerted += 1;
      }
    }
    return alerted;
  }
}
