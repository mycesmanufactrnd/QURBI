import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrderStatus } from '../entities';
import { OrdersService } from '../orders/orders.service';
import { OrderTrackingEventsService } from './order-tracking-events.service';

@Controller('order-tracking-events')
export class OrderTrackingEventsController {
  constructor(
    private readonly orderTrackingEventsService: OrderTrackingEventsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  findAllForOrder(@Query('orderId') orderId: string) {
    return this.orderTrackingEventsService.findAllForOrder(orderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderTrackingEventsService.findOne(id);
  }

  // Adding an event always goes through OrdersService.updateStatus so the
  // order's `status` column and its tracking timeline can never drift apart —
  // even a same-status update (e.g. a new courier location) is a legitimate
  // additional row.
  @Post()
  create(
    @Body()
    body: {
      orderId: string;
      status: OrderStatus;
      note?: string;
      images?: string[];
      location?: string;
      userId?: string;
    },
  ) {
    const { orderId, ...opts } = body;
    return this.ordersService.updateStatus(orderId, body.status, opts);
  }
}
