import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FarmerProfilesService } from './farmer-profiles.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateFarmerProfileDto } from './dto/create-farmer-profile.dto';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';

@Controller('farmer-profiles')
export class FarmerProfilesController {
  constructor(private readonly farmerProfilesService: FarmerProfilesService) {}

  // No userId — the owner is always the authenticated caller.
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFarmerProfileDto) {
    return this.farmerProfilesService.create({ ...body, userId: user.id });
  }

  // Public directory — a farm's name/address/rating is marketing info a
  // buyer needs to see before ordering, same as species/breeds reference data.
  @Get()
  findAll() {
    return this.farmerProfilesService.findAll();
  }

  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.farmerProfilesService.findByUserId(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.farmerProfilesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: UpdateFarmerProfileDto) {
    return this.farmerProfilesService.updateOwned(id, user, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.farmerProfilesService.removeOwned(id, user);
  }
}
