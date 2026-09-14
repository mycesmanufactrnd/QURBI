import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Livestock } from '../entities';
import { LivestockController } from './livestock.controller';
import { LivestockService } from './livestock.service';

@Module({
  imports: [TypeOrmModule.forFeature([Livestock])],
  controllers: [LivestockController],
  providers: [LivestockService],
  exports: [LivestockService],
})
export class LivestockModule {}
