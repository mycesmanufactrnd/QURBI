import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CourierAuditLog,
  CourierProfile,
  CourierVerification,
  User,
} from '../entities';
import { ApprovedCourierGuard } from './approved-courier.guard';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourierProfile,
      CourierVerification,
      CourierAuditLog,
      User,
    ]),
  ],
  controllers: [CouriersController],
  providers: [CouriersService, ApprovedCourierGuard],
  // The guard is exported (with TypeOrmModule) so CourierJobsModule can use
  // it on its own routes.
  exports: [CouriersService, ApprovedCourierGuard, TypeOrmModule],
})
export class CouriersModule {}
