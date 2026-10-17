import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { PaymentQrCodesController } from './payment-qr-codes.controller.js';
import { PaymentQrCodesService } from './payment-qr-codes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentQrCode])],
  controllers: [PaymentQrCodesController],
  providers: [PaymentQrCodesService],
})
export class PaymentQrCodesModule {}
