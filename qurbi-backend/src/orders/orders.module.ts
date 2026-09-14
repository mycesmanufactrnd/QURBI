import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkListing, CartItem, Livestock, Order, OrderItem, OrderTrackingEvent } from '../entities';
import { CartsModule } from '../carts/carts.module';
import { LivestockModule } from '../livestock/livestock.module';
import { BulkListingsModule } from '../bulk-listings/bulk-listings.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderTrackingEvent, CartItem, Livestock, BulkListing]),
    CartsModule,
    LivestockModule,
    BulkListingsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
