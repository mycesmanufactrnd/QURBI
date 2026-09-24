import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderTrackingEvent } from '../entities';
import { OrdersModule } from '../orders/orders.module';
import { OrderTrackingEventsController } from './order-tracking-events.controller';
import { OrderTrackingEventsService } from './order-tracking-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderTrackingEvent]), OrdersModule],
  controllers: [OrderTrackingEventsController],
  providers: [OrderTrackingEventsService],
  exports: [OrderTrackingEventsService],
})
export class OrderTrackingEventsModule {}
