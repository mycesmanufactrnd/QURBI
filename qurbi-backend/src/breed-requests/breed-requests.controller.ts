import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { BreedRequest } from '../entities';
import { BreedRequestsService } from './breed-requests.service';

@Controller('breed-requests')
export class BreedRequestsController {
  constructor(private readonly breedRequestsService: BreedRequestsService) {}

  @Post()
  create(@Body() body: DeepPartial<BreedRequest>) {
    return this.breedRequestsService.create(body);
  }

  @Get()
  findAll(
    @Query('requestedByUserId') requestedByUserId?: string,
    @Query('speciesId') speciesId?: string,
  ) {
    if (requestedByUserId) return this.breedRequestsService.findByUser(requestedByUserId);
    if (speciesId) return this.breedRequestsService.findBySpecies(speciesId);
    return this.breedRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.breedRequestsService.findOne(id);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewedByUserId: string; reviewNote?: string },
  ) {
    return this.breedRequestsService.review(id, body);
  }
}
