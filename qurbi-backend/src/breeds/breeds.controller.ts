import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Breed } from '../entities';
import { BreedsService } from './breeds.service';

@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Post()
  create(@Body() body: DeepPartial<Breed>) {
    return this.breedsService.create(body);
  }

  @Get()
  findAll(@Query('speciesId') speciesId?: string) {
    return speciesId ? this.breedsService.findBySpecies(speciesId) : this.breedsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.breedsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<Breed>) {
    return this.breedsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.breedsService.remove(id);
  }
}
