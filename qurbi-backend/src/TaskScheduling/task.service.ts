import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Livestock,
  LivestockStatus,
  Notification,
  NotificationAudience,
  NotificationType,
} from '../entities';
import { ReservationsService } from '../reservations/reservations.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reservationsService: ReservationsService,
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
    await this.dataSource.transaction(async (manager) => {
      const listings = await manager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.status = :available', {
          available: LivestockStatus.AVAILABLE,
        })
        .andWhere(
          'COALESCE(livestock.marketplaceExpiresAt, DATE_ADD(livestock.createdAt, INTERVAL 14 DAY)) <= :now',
          { now: new Date() },
        )
        .getMany();

      for (const listing of listings) {
        listing.status = LivestockStatus.UNAVAILABLE;
        await manager.save(listing);
        const listingName = [
          listing.attributes?.species,
          listing.attributes?.breed,
        ]
          .filter(Boolean)
          .join(' - ');
        await manager.save(
          manager.create(Notification, {
            userId: listing.farmerId,
            audience: NotificationAudience.FARMER,
            type: NotificationType.LISTING,
            title: 'Listing expired',
            body: `${listingName || 'Your livestock listing'} expired after 14 days and is now hidden from buyers. Review and renew it to return it to the marketplace.`,
            linkUrl: `/livestock/${listing.id}`,
            relatedType: 'livestock',
            relatedId: listing.id,
          }),
        );
      }
    });
  }
}
