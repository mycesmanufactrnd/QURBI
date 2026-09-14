import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { FarmVerification } from '../entities';
import { FarmVerificationsService } from './farm-verifications.service';

@Controller('farm-verifications')
export class FarmVerificationsController {
  constructor(private readonly farmVerificationsService: FarmVerificationsService) {}

  @Post()
  submit(@Body() body: DeepPartial<FarmVerification>) {
    return this.farmVerificationsService.submit(body);
  }

  @Get()
  findAll(@Query('farmerProfileId') farmerProfileId?: string) {
    return farmerProfileId
      ? this.farmVerificationsService.findByFarmerProfile(farmerProfileId)
      : this.farmVerificationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.farmVerificationsService.findOne(id);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body()
    body: { approve: boolean; reviewedByUserId: string; rejectionReason?: string },
  ) {
    return this.farmVerificationsService.review(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.farmVerificationsService.remove(id);
  }
}
