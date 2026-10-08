import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../entities';
import { AnalyticsService } from './analytics.service';
import { TrackBuyerActivityDto } from './dto/track-buyer-activity.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('events')
  async track(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: TrackBuyerActivityDto,
  ): Promise<void> {
    await this.analyticsService.track(user, body);
  }

  @Roles(UserRole.FARMER)
  @UseGuards(RolesGuard)
  @Get('farmer/summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') rawDays?: string,
  ) {
    const requested = Number(rawDays || 30);
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    return this.analyticsService.farmerSummary(user.id, days);
  }
}
