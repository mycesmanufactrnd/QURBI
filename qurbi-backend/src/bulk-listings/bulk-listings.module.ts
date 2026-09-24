import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkListing } from '../entities';
import { BulkListingsController } from './bulk-listings.controller';
import { BulkListingsService } from './bulk-listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([BulkListing])],
  controllers: [BulkListingsController],
  providers: [BulkListingsService],
  exports: [BulkListingsService],
})
export class BulkListingsModule {}
