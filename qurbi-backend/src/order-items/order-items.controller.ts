import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrderItemsService } from './order-items.service';

@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly orderItemsService: OrderItemsService) {}

  @Get()
  findAllForOrder(@Query('orderId') orderId: string) {
    return this.orderItemsService.findAllForOrder(orderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderItemsService.findOne(id);
  }
}
