import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { SpeciesRequest } from '../entities';
import { SpeciesRequestsService } from './species-requests.service';

@Controller('species-requests')
export class SpeciesRequestsController {
  constructor(private readonly speciesRequestsService: SpeciesRequestsService) {}

  @Post()
  create(@Body() body: DeepPartial<SpeciesRequest>) {
    return this.speciesRequestsService.create(body);
  }

  @Get()
  findAll(@Query('requestedByUserId') requestedByUserId?: string) {
    return requestedByUserId
      ? this.speciesRequestsService.findByUser(requestedByUserId)
      : this.speciesRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.speciesRequestsService.findOne(id);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewedByUserId: string; reviewNote?: string },
  ) {
    return this.speciesRequestsService.review(id, body);
  }
}
