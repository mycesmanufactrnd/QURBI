import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Breed, BreedRequest } from '../entities';
import { BreedRequestsController } from './breed-requests.controller';
import { BreedRequestsService } from './breed-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([BreedRequest, Breed])],
  controllers: [BreedRequestsController],
  providers: [BreedRequestsService],
  exports: [BreedRequestsService],
})
export class BreedRequestsModule {}
