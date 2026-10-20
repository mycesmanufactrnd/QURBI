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
import { DeliveryAssignmentStatus, UserRole } from '../entities';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ApprovedCourierGuard } from '../couriers/approved-courier.guard';
import type { CourierRequest } from '../couriers/approved-courier.guard';
import { CourierJobsService } from './courier-jobs.service';
import {
  AdminAssignDto,
  DeliverDto,
  FailDeliveryDto,
  PickupDto,
  ProofDto,
  ResolveFailedDto,
} from './dto/courier-job.dto';

// A wrong 6-digit handover code must not be brute-forceable.
const DELIVER_THROTTLE = { default: { limit: 6, ttl: 60_000 } };

@Controller('courier-jobs')
export class CourierJobsController {
  constructor(private readonly jobs: CourierJobsService) {}

  // ---- admin (registered first so "admin" is never read as an :orderId) ----

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin')
  adminList(
    @Query('status') status?: DeliveryAssignmentStatus,
    @Query('flagged') flagged?: string,
  ) {
    return this.jobs.adminList({ status, flagged: flagged === 'true' });
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Post('admin/:orderId/assign')
  adminAssign(
    @Param('orderId') orderId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminAssignDto,
  ) {
    return this.jobs.adminAssign(orderId, dto.courierProfileId, admin);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/assignments/:id/resolve')
  adminResolve(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ResolveFailedDto,
  ) {
    return this.jobs.adminResolve(id, admin, dto.note);
  }

  // ---- buyer / farmer / admin ----

  @Roles(UserRole.BUYER, UserRole.FARMER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get('order/:orderId/summary')
  orderSummary(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.orderSummary(orderId, user);
  }

  @Roles(UserRole.FARMER)
  @UseGuards(RolesGuard)
  @Patch('order/:orderId/farmer-handover')
  farmerHandover(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.farmerConfirmHandover(orderId, user);
  }

  // ---- approved couriers ----

  @UseGuards(ApprovedCourierGuard)
  @Get('available')
  available(@Req() req: CourierRequest) {
    return this.jobs.availableJobs(req.courierProfile!);
  }

  @UseGuards(ApprovedCourierGuard)
  @Get('earnings')
  earnings(@Req() req: CourierRequest) {
    return this.jobs.earnings(req.courierProfile!);
  }

  @UseGuards(ApprovedCourierGuard)
  @Get('mine')
  mine(@Req() req: CourierRequest, @Query('scope') scope?: string) {
    return this.jobs.myJobs(
      req.courierProfile!,
      scope === 'history' ? 'history' : 'active',
    );
  }

  @UseGuards(ApprovedCourierGuard)
  @Get(':orderId')
  detail(@Req() req: CourierRequest, @Param('orderId') orderId: string) {
    return this.jobs.jobDetail(orderId, req.courierProfile!);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post(':orderId/accept')
  accept(@Req() req: CourierRequest, @Param('orderId') orderId: string) {
    return this.jobs.accept(orderId, req.courierProfile!);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post(':orderId/release')
  release(
    @Req() req: CourierRequest,
    @Param('orderId') orderId: string,
    @Body('reason') reason?: string,
  ) {
    return this.jobs.release(orderId, req.courierProfile!, reason);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post(':orderId/pickup')
  pickup(
    @Req() req: CourierRequest,
    @Param('orderId') orderId: string,
    @Body() dto: PickupDto,
  ) {
    return this.jobs.pickup(orderId, req.courierProfile!, dto);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post(':orderId/transit')
  transit(
    @Req() req: CourierRequest,
    @Param('orderId') orderId: string,
    @Body() dto: ProofDto,
  ) {
    return this.jobs.startTransit(orderId, req.courierProfile!, dto);
  }

  @UseGuards(ApprovedCourierGuard)
  @Throttle(DELIVER_THROTTLE)
  @Post(':orderId/deliver')
  deliver(
    @Req() req: CourierRequest,
    @Param('orderId') orderId: string,
    @Body() dto: DeliverDto,
  ) {
    return this.jobs.deliver(orderId, req.courierProfile!, dto);
  }

  @UseGuards(ApprovedCourierGuard)
  @Post(':orderId/fail')
  fail(
    @Req() req: CourierRequest,
    @Param('orderId') orderId: string,
    @Body() dto: FailDeliveryDto,
  ) {
    return this.jobs.fail(orderId, req.courierProfile!, dto);
  }
}
