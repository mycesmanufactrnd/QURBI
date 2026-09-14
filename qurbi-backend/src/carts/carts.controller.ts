import { Controller, Delete, Get, Query } from '@nestjs/common';
import { CartsService } from './carts.service';

// userId is read from the query string until auth guards exist; once they do
// this should read from req.user.id instead.
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('me')
  getMyCart(@Query('userId') userId: string) {
    return this.cartsService.getCartWithItemsForUser(userId);
  }

  @Delete('me')
  clearMyCart(@Query('userId') userId: string) {
    return this.cartsService.clear(userId);
  }
}
