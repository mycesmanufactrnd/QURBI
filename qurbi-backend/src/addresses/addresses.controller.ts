import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Address } from '../entities';
import { AddressesService } from './addresses.service';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  create(@Body() body: DeepPartial<Address>) {
    return this.addressesService.create(body);
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    return userId ? this.addressesService.findByUser(userId) : this.addressesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.addressesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<Address>) {
    return this.addressesService.update(id, body);
  }

  @Patch(':id/set-default')
  setDefault(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.addressesService.setDefault(body.userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.addressesService.remove(id);
  }
}
