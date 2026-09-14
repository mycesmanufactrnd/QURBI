import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Livestock } from '../entities';
import { stripUndefined } from '../common/strip-undefined';
import { LivestockService } from './livestock.service';

@Controller('livestock')
export class LivestockController {
  constructor(private readonly livestockService: LivestockService) {}

  @Post()
  create(@Body() body: DeepPartial<Livestock>) {
    return this.livestockService.create(body);
  }

  @Get()
  findAll(
    @Query('farmerId') farmerId?: string,
    @Query('speciesId') speciesId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: Livestock['status'],
  ) {
    return this.livestockService.findAll(
      stripUndefined({ farmerId, speciesId, categoryId, status }),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.livestockService.findOneAndTrackView(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<Livestock>) {
    return this.livestockService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.livestockService.remove(id);
  }
}
