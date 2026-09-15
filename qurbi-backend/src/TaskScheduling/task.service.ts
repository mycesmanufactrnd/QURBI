import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class TasksService {
  constructor(private readonly ordersService: OrdersService) {}

  @Cron('0 * * * * *')
  async releaseExpiredLivestockReservations(): Promise<void> {
    await this.ordersService.expirePendingReservations();
  }
}
