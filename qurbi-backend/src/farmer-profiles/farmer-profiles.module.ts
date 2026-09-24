import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmerProfile } from '../entities';
import { FarmerProfilesController } from './farmer-profiles.controller';
import { FarmerProfilesService } from './farmer-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([FarmerProfile])],
  controllers: [FarmerProfilesController],
  providers: [FarmerProfilesService],
  exports: [FarmerProfilesService],
})
export class FarmerProfilesModule {}
