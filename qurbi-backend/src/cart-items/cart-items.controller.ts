import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrderItemType, UserRole } from '../entities';
import { CartItemsService } from './cart-items.service';

@Controller('cart-items')
@Roles(UserRole.BUYER)
export class CartItemsController {
  constructor(private readonly cartItemsService: CartItemsService) {}

  @Get()
  findAllForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.cartItemsService.findAllForUser(user.sub);
  }

  @Post()
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      itemType: OrderItemType;
      livestockId?: string;
      bulkListingId?: string;
      quantity: number;
      metadata?: Record<string, any>;
    },
  ) {
    return this.cartItemsService.addItem({ ...body, userId: user.sub });
  }

  @Patch(':id')
  updateQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    return this.cartItemsService.updateQuantity(user.sub, id, body.quantity);
  }

  @Delete(':id')
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cartItemsService.removeItem(user.sub, id);
  }
}
