import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Species } from '../entities';
import { SpeciesService } from './species.service';

@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Post()
  create(@Body() body: DeepPartial<Species>) {
    return this.speciesService.create(body);
  }

  @Get()
  findAll() {
    return this.speciesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.speciesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<Species>) {
    return this.speciesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.speciesService.remove(id);
  }
}
