import { Module } from '@nestjs/common';
import { CouriersModule } from '../couriers/couriers.module';
import { OrdersModule } from '../orders/orders.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CourierJobsController } from './courier-jobs.controller';
import { CourierJobsService } from './courier-jobs.service';
import { CourierDelayAlertsService } from './courier-delay-alerts.service';

@Module({
  imports: [CouriersModule, OrdersModule, UploadsModule],
  controllers: [CourierJobsController],
  providers: [CourierJobsService, CourierDelayAlertsService],
  exports: [CourierJobsService, CourierDelayAlertsService],
})
export class CourierJobsModule {}
