import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Livestock } from '../entities';
import { LivestockService } from './livestock.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../entities';

@Controller('livestock')
export class LivestockController {
  constructor(private readonly livestockService: LivestockService) {}

  @Post()
  @Roles(UserRole.FARMER)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeepPartial<Livestock>,
  ) {
    return this.livestockService.createForFarmer(user.sub, body);
  }

  @Get()
  @Public()
  findMarketplace() {
    return this.livestockService.findMarketplace();
  }

  @Get('mine')
  @Roles(UserRole.FARMER)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.livestockService.findMine(user.sub);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.livestockService.findMarketplaceOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.FARMER)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DeepPartial<Livestock>,
  ) {
    return this.livestockService.updateOwned(id, user.sub, body);
  }

  @Post(':id/renew')
  @Roles(UserRole.FARMER)
  renew(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DeepPartial<Livestock>,
  ) {
    return this.livestockService.renew(id, user.sub, body);
  }

  @Delete(':id')
  @Roles(UserRole.FARMER)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.livestockService.updateOwned(id, user.sub, {});
    return this.livestockService.remove(id);
  }
}
