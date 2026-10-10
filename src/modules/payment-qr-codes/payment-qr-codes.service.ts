import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { detectImage } from '../products/product-image.js';
import { S3Service } from '../../s3/s3.service.js';
import type { UpdatePaymentQrCodeDto } from './dto/payment-qr-code.dto.js';

/** Admin management of the transfer QR images shown at checkout. Branch-scoped. */
@Injectable()
export class PaymentQrCodesService {
  constructor(
    @InjectRepository(PaymentQrCode) private readonly qrCodes: Repository<PaymentQrCode>,
    private readonly s3: S3Service,
  ) {}

  list(branchId: string): Promise<PaymentQrCode[]> {
    return this.qrCodes.find({ where: { branchId }, order: { createdAt: 'ASC' } });
  }

  /** Stores the image in S3 first, then the row. If the row write fails, the object is removed again. */
  async create(branchId: string, label: string, buffer: Buffer | undefined): Promise<PaymentQrCode> {
    const { url, key } = await this.storeImage(branchId, buffer);
    try {
      return await this.qrCodes.save(
        this.qrCodes.create({ branchId, label, imagePath: url, isActive: true }),
      );
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  async update(branchId: string, id: string, dto: UpdatePaymentQrCodeDto): Promise<PaymentQrCode> {
    const qr = await this.find(branchId, id);
    if (dto.label !== undefined) qr.label = dto.label;
    if (dto.isActive !== undefined) qr.isActive = dto.isActive;
    return this.qrCodes.save(qr);
  }

  async replaceImage(branchId: string, id: string, buffer: Buffer | undefined): Promise<PaymentQrCode> {
    const qr = await this.find(branchId, id);
    const oldUrl = qr.imagePath;
    const { url, key } = await this.storeImage(branchId, buffer);
    try {
      qr.imagePath = url;
      const saved = await this.qrCodes.save(qr);
      await this.deleteObject(this.s3.keyFromPublicUrl(oldUrl));
      return saved;
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  async remove(branchId: string, id: string): Promise<void> {
    const qr = await this.find(branchId, id);
    await this.qrCodes.remove(qr);
    await this.deleteObject(this.s3.keyFromPublicUrl(qr.imagePath));
  }

  private async find(branchId: string, id: string): Promise<PaymentQrCode> {
    const qr = await this.qrCodes.findOneBy({ id, branchId });
    if (!qr) throw new NotFoundException('Payment QR code not found');
    return qr;
  }

  private async storeImage(branchId: string, buffer: Buffer | undefined) {
    const { ext, contentType } = detectImage(buffer);
    const key = `payment-qr/${branchId}/${randomUUID()}.${ext}`;
    const { url } = await this.s3.upload(key, buffer!, {
      contentType,
      // Keys are unique per upload, so the object never changes.
      cacheControl: 'public, max-age=31536000, immutable',
    });
    return { key, url };
  }

  private async deleteObject(key: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.s3.delete(key);
    } catch {
      // orphaned object, harmless
    }
  }
}
