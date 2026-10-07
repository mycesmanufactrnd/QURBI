import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../entities';
import { CreateChipCheckoutDto } from './dto/create-chip-checkout.dto';
import { PaymentsService } from './payments.service';
import type { ChipPurchase } from './providers/chip/chip.types';

@Controller('payments/chip')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(UserRole.BUYER)
  @UseGuards(RolesGuard)
  @Post('checkout')
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateChipCheckoutDto,
  ) {
    return this.paymentsService.createChipCheckout(user.id, body.orderIds);
  }

  @Roles(UserRole.BUYER)
  @UseGuards(RolesGuard)
  @Get('sessions/:id')
  getSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getSessionForBuyer(id, user.id);
  }

  @Roles(UserRole.BUYER)
  @UseGuards(RolesGuard)
  @Post('sessions/:id/reconcile')
  reconcileSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.reconcileSessionForBuyer(id, user.id);
  }

  @Public()
  @Post('webhook')
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string | undefined,
    @Body() payload: ChipPurchase,
  ) {
    return this.paymentsService.handleChipWebhook(request.rawBody, signature, payload);
  }
}
