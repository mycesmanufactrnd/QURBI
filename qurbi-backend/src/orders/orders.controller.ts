import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrderStatus, UserRole } from '../entities';
import { OrdersService } from './orders.service';
import type { CheckoutInput } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @Roles(UserRole.BUYER)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CheckoutInput,
  ) {
    return this.ordersService.checkout(user.sub, input);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findAllForActor(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOneForActor(id, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.FARMER, UserRole.ADMIN)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      status: OrderStatus;
      note?: string;
      images?: string[];
      location?: string;
    },
  ) {
    if (user.role === UserRole.FARMER) {
      await this.ordersService.assertFarmerOwns(id, user.sub);
      const farmerStatuses = new Set([
        OrderStatus.PREPARING,
        OrderStatus.IN_TRANSIT,
        OrderStatus.DELIVERED,
      ]);
      if (!farmerStatuses.has(body.status)) {
        throw new ForbiddenException('Farmers cannot apply this order status');
      }
    }
    return this.ordersService.updateStatus(id, body.status, {
      ...body,
      userId: user.sub,
    });
  }

  @Patch(':id/cancel')
  @Roles(UserRole.BUYER)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.ordersService.assertBuyerOwns(id, user.sub);
    return this.ordersService.cancel(id, body.reason, user.sub);
  }

  @Patch(':id/received')
  @Roles(UserRole.BUYER)
  async markReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { proofImages: string[] },
  ) {
    await this.ordersService.assertBuyerOwns(id, user.sub);
    return this.ordersService.markReceived(id, body.proofImages, user.sub);
  }

  @Patch(':id/refund-request')
  @Roles(UserRole.BUYER)
  async requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.ordersService.assertBuyerOwns(id, user.sub);
    return this.ordersService.requestRefund(id, body.reason);
  }

  @Patch(':id/refund-review')
  @Roles(UserRole.ADMIN)
  reviewRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { approve: boolean; note?: string },
  ) {
    return this.ordersService.reviewRefund(id, {
      ...body,
      reviewedByUserId: user.sub,
    });
  }

  @Patch(':id/hide-from-buyer-history')
  @Roles(UserRole.BUYER)
  async hideFromBuyerHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { hidden: boolean },
  ) {
    await this.ordersService.assertBuyerOwns(id, user.sub);
    return this.ordersService.hideFromBuyerHistory(id, body.hidden);
  }
}
