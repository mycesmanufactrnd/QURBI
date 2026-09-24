import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LivestockCategory } from '../entities';
import { LivestockCategoriesController } from './livestock-categories.controller';
import { LivestockCategoriesService } from './livestock-categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([LivestockCategory])],
  controllers: [LivestockCategoriesController],
  providers: [LivestockCategoriesService],
  exports: [LivestockCategoriesService],
})
export class LivestockCategoriesModule {}
