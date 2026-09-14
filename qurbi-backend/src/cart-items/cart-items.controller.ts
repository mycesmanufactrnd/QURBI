import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderItemType } from '../entities';
import { CartItemsService } from './cart-items.service';

// userId is read from the query string / body until auth guards exist.
@Controller('cart-items')
export class CartItemsController {
  constructor(private readonly cartItemsService: CartItemsService) {}

  @Get()
  findAllForUser(@Query('userId') userId: string) {
    return this.cartItemsService.findAllForUser(userId);
  }

  @Post()
  addItem(
    @Body()
    body: {
      userId: string;
      itemType: OrderItemType;
      livestockId?: string;
      bulkListingId?: string;
      quantity: number;
      metadata?: Record<string, any>;
    },
  ) {
    return this.cartItemsService.addItem(body);
  }

  @Patch(':id')
  updateQuantity(
    @Param('id') id: string,
    @Body() body: { userId: string; quantity: number },
  ) {
    return this.cartItemsService.updateQuantity(body.userId, id, body.quantity);
  }

  @Delete(':id')
  removeItem(@Param('id') id: string, @Query('userId') userId: string) {
    return this.cartItemsService.removeItem(userId, id);
  }
}
