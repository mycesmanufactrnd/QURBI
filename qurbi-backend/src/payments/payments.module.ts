import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, PaymentSession, PaymentSessionOrder } from '../entities';
import { OrdersModule } from '../orders/orders.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ChipClient } from './providers/chip/chip.client';
import { ChipSignatureService } from './providers/chip/chip-signature.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentSession, PaymentSessionOrder]),
    OrdersModule,
    ReservationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, ChipClient, ChipSignatureService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
