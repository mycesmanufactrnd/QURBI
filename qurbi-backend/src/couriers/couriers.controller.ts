import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CourierVerificationStatus,
  RequestStatus,
  UserRole,
} from '../entities';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { toPageInt } from '../common/pagination';
import { ApprovedCourierGuard } from './approved-courier.guard';
import type { CourierRequest } from './approved-courier.guard';
import { CouriersService } from './couriers.service';
import {
  ProposeRateDto,
  RegisterCourierDto,
  ReviewCourierVerificationDto,
  ReviewRateDto,
  SetOnlineDto,
  SubmitCourierVerificationDto,
  SuspendCourierDto,
  UpdateCourierProfileDto,
} from './dto/courier.dto';

// Same limit as the other credential-creating endpoints in AuthController.
const REGISTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Public()
  @Throttle(REGISTER_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterCourierDto) {
    return this.couriersService.register(dto);
  }

  // ---- the courier's own account (works while pending/rejected too) ----

  @Roles(UserRole.COURIER)
  @UseGuards(RolesGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.couriersService.getOwnProfile(user);
  }

  @Roles(UserRole.COURIER)
  @UseGuards(RolesGuard)
  @Post('me/verification')
  submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitCourierVerificationDto,
  ) {
    return this.couriersService.submitVerification(user, dto);
  }

  @Roles(UserRole.COURIER)
  @UseGuards(RolesGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierProfileDto,
  ) {
    return this.couriersService.updateProfile(user, dto);
  }

  // ---- approved couriers only ----

  @UseGuards(ApprovedCourierGuard)
  @Patch('me/online')
  setOnline(@Req() req: CourierRequest, @Body() dto: SetOnlineDto) {
    return this.couriersService.setOnline(req.courierProfile!, dto.online);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post('me/rate')
  proposeRate(@Req() req: CourierRequest, @Body() dto: ProposeRateDto) {
    return this.couriersService.proposeRate(req.courierProfile!, dto.fee);
  }

  // ---- admin ----

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin')
  findAll(
    @Query('status') status?: CourierVerificationStatus,
    @Query('rateStatus') rateStatus?: RequestStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.couriersService.findAllForAdmin({
      status,
      rateStatus,
      search,
      page: toPageInt(page),
      limit: toPageInt(limit),
    });
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/:id')
  findOne(@Param('id') id: string) {
    return this.couriersService.findOneForAdmin(id);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/verifications/:id/review')
  reviewVerification(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewCourierVerificationDto,
  ) {
    return this.couriersService.reviewVerification(id, admin.id, dto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/:id/suspend')
  suspend(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: SuspendCourierDto,
  ) {
    return this.couriersService.suspend(id, admin.id, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/:id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.couriersService.reactivate(id, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/:id/rate-review')
  reviewRate(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewRateDto,
  ) {
    return this.couriersService.reviewRate(id, admin.id, dto);
  }
}
