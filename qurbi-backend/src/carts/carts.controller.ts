import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { CartsService } from './carts.service';
import { UserRole } from '../entities';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('carts')
@Roles(UserRole.BUYER)
@UseGuards(RolesGuard)
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
