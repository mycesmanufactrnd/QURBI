import { Controller, Delete, Get } from '@nestjs/common';
import { CartsService } from './carts.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('me')
  getMyCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartsService.getCartWithItemsForUser(user.id);
  }

  @Delete('me')
  clearMyCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartsService.clear(user.id);
  }
}
