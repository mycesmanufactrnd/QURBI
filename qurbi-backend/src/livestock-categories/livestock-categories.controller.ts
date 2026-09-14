import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { LivestockCategory } from '../entities';
import { LivestockCategoriesService } from './livestock-categories.service';

@Controller('livestock-categories')
export class LivestockCategoriesController {
  constructor(private readonly categoriesService: LivestockCategoriesService) {}

  @Post()
  create(@Body() body: DeepPartial<LivestockCategory>) {
    return this.categoriesService.create(body);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: DeepPartial<LivestockCategory>) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
