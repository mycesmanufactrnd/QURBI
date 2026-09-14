import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { FarmerProfile } from '../entities';
import { FarmerProfilesService } from './farmer-profiles.service';

@Controller('farmer-profiles')
export class FarmerProfilesController {
  constructor(private readonly farmerProfilesService: FarmerProfilesService) {}

  @Post()
  create(@Body() body: DeepPartial<FarmerProfile>) {
    return this.farmerProfilesService.create(body);
  }

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
  update(@Param('id') id: string, @Body() body: DeepPartial<FarmerProfile>) {
    return this.farmerProfilesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.farmerProfilesService.remove(id);
  }
}
