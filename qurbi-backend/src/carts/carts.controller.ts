import { Controller, Delete, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../entities';
import { CartsService } from './carts.service';

@Controller('carts')
@Roles(UserRole.BUYER)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('me')
  getMyCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartsService.getCartWithItemsForUser(user.sub);
  }

  @Delete('me')
  clearMyCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartsService.clear(user.sub);
  }
}
