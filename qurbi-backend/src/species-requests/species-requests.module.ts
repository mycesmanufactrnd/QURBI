import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Species, SpeciesRequest } from '../entities';
import { SpeciesRequestsController } from './species-requests.controller';
import { SpeciesRequestsService } from './species-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpeciesRequest, Species])],
  controllers: [SpeciesRequestsController],
  providers: [SpeciesRequestsService],
  exports: [SpeciesRequestsService],
})
export class SpeciesRequestsModule {}
