import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '../entities';
import { CheckoutInput, OrdersService } from './orders.service';

// buyerId/farmerId are read from the query string / body until auth guards
// exist; once they do these should read from req.user.id + role instead.
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  checkout(@Body() body: { buyerId: string } & CheckoutInput) {
    const { buyerId, ...input } = body;
    return this.ordersService.checkout(buyerId, input);
  }

  @Get()
  findAll(@Query('buyerId') buyerId?: string, @Query('farmerId') farmerId?: string) {
    if (buyerId) return this.ordersService.findAllForBuyer(buyerId);
    if (farmerId) return this.ordersService.findAllForFarmer(farmerId);
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body()
    body: { status: OrderStatus; note?: string; images?: string[]; location?: string; userId?: string },
  ) {
    return this.ordersService.updateStatus(id, body.status, body);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: { reason: string; userId?: string }) {
    return this.ordersService.cancel(id, body.reason, body.userId);
  }

  @Patch(':id/received')
  markReceived(
    @Param('id') id: string,
    @Body() body: { proofImages: string[]; userId?: string },
  ) {
    return this.ordersService.markReceived(id, body.proofImages, body.userId);
  }

  @Patch(':id/refund-request')
  requestRefund(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.ordersService.requestRefund(id, body.reason);
  }

  @Patch(':id/refund-review')
  reviewRefund(
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewedByUserId: string; note?: string },
  ) {
    return this.ordersService.reviewRefund(id, body);
  }

  @Patch(':id/hide-from-buyer-history')
  hideFromBuyerHistory(@Param('id') id: string, @Body() body: { hidden: boolean }) {
    return this.ordersService.hideFromBuyerHistory(id, body.hidden);
  }
}
