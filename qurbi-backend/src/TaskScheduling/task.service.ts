import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Livestock, LivestockStatus } from '../entities';
import { ReservationsService } from '../reservations/reservations.service';
import { OrdersService } from '../orders/orders.service';
import { CourierDelayAlertsService } from '../courier-jobs/courier-delay-alerts.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reservationsService: ReservationsService,
    private readonly ordersService: OrdersService,
    private readonly courierDelayAlerts: CourierDelayAlertsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePaymentReservations(): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.reservationsService.expireDue(manager),
    );
  }

  // A buyer who never confirms after the courier's delivery proof must not
  // leave the order open forever. The window is configurable.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoConfirmDeliveredOrders(): Promise<void> {
    const parsed = Number(process.env.AUTO_CONFIRM_HOURS);
    const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
    await this.ordersService.autoConfirmDelivered(hours);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async alertDelayedDeliveries(): Promise<void> {
    await this.courierDelayAlerts.run();
  }

  // Expired livestock stays visible to its farmer but leaves the buyer
  // marketplace until the farmer reviews and republishes it.
  @Cron(CronExpression.EVERY_HOUR)
  async expireLivestockListings(): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(Livestock)
      .set({ status: LivestockStatus.UNAVAILABLE })
      .where('status = :available', { available: LivestockStatus.AVAILABLE })
      .andWhere(
        'COALESCE(marketplaceExpiresAt, DATE_ADD(createdAt, INTERVAL 14 DAY)) <= :now',
        { now: new Date() },
      )
      .execute();
  }
}
