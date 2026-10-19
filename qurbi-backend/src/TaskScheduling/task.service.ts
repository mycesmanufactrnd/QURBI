import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LivestockService } from '../livestock/livestock.service';
import { ReservationsService } from '../reservations/reservations.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reservationsService: ReservationsService,
    private readonly livestockService: LivestockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePaymentReservations(): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.reservationsService.expireDue(manager),
    );
  }

  // Expired livestock stays visible to its farmer but leaves the buyer
  // marketplace until the farmer reviews and republishes it.
  @Cron(CronExpression.EVERY_HOUR)
  async expireLivestockListings(): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.livestockService.expireDueListings(manager),
    );
  }
}
