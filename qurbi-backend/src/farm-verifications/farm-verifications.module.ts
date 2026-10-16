import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FarmerProfile,
  FarmVerification,
  Notification,
  User,
} from '../entities';
import { FarmVerificationsController } from './farm-verifications.controller';
import { FarmVerificationsService } from './farm-verifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FarmVerification,
      FarmerProfile,
      User,
      Notification,
    ]),
  ],
  controllers: [FarmVerificationsController],
  providers: [FarmVerificationsService],
  exports: [FarmVerificationsService],
})
export class FarmVerificationsModule {}
