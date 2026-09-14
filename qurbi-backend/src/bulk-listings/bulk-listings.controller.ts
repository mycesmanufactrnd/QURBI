import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { BulkListing } from '../entities';
import { stripUndefined } from '../common/strip-undefined';
import { BulkListingsService } from './bulk-listings.service';

@Controller('bulk-listings')
export class BulkListingsController {
  constructor(private readonly bulkListingsService: BulkListingsService) {}

  @Post()
  create(@Body() body: DeepPartial<BulkListing>) {
    return this.bulkListingsService.create(body);
  }

  @Get()
  findAll(@Query('farmerId') farmerId?: string, @Query('status') status?: BulkListing['status']) {
    return this.bulkListingsService.findAll(stripUndefined({ farmerId, status }));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bulkListingsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<BulkListing>) {
    return this.bulkListingsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bulkListingsService.remove(id);
  }
}
