import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { detectImage } from '../products/product-image.js';
import { RedisService } from '../../redis/redis.service.js';
import { S3Service } from '../../s3/s3.service.js';
import type { DownloadResult } from '../../s3/s3.types.js';
import type { UpdatePaymentQrCodeDto } from './dto/payment-qr-code.dto.js';
import { decodeVietQr } from './qr-decode.js';

const QR_BUCKET = 'payment-qr';
const LIST_TTL_SECONDS = 300;
const IMAGE_TTL_SECONDS = 3600;

const listKey = (branchId: string) => `payment-qr:list:${branchId}`;
/** Keyed by the S3 key, which is unique per upload, so a replaced image never serves stale bytes. */
const imageKey = (s3Key: string) => `payment-qr:img:${s3Key}`;

/** Admin management of the transfer QR images shown at checkout. Branch-scoped. */
@Injectable()
export class PaymentQrCodesService {
  constructor(
    @InjectRepository(PaymentQrCode) private readonly qrCodes: Repository<PaymentQrCode>,
    private readonly s3: S3Service,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PaymentQrCodesService.name);
  }

  /** Cached in Redis per branch; every write below drops the entry. */
  async list(branchId: string): Promise<PaymentQrCode[]> {
    const cached = await this.cacheRead(() => this.redis.getJson<PaymentQrCode[]>(listKey(branchId)));
    if (cached) return cached;
    const rows = await this.qrCodes.find({ where: { branchId }, order: { createdAt: 'ASC' } });
    await this.cacheWrite(() => this.redis.setJson(listKey(branchId), rows, LIST_TTL_SECONDS));
    return rows;
  }

  /** Stores the image in S3 first, then the row. If the row write fails, the object is removed again. */
  async create(branchId: string, label: string, buffer: Buffer | undefined): Promise<PaymentQrCode> {
    const { key } = await this.storeImage(branchId, buffer);
    try {
      const qrPayload = await decodeVietQr(buffer!);
      const saved = await this.qrCodes.save(
        this.qrCodes.create({ branchId, label, imagePath: key, qrPayload, isActive: true }),
      );
      await this.invalidate(branchId);
      return saved;
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  async update(branchId: string, id: string, dto: UpdatePaymentQrCodeDto): Promise<PaymentQrCode> {
    const qr = await this.find(branchId, id);
    if (dto.label !== undefined) qr.label = dto.label;
    if (dto.isActive !== undefined) qr.isActive = dto.isActive;
    const saved = await this.qrCodes.save(qr);
    await this.invalidate(branchId);
    return saved;
  }

  async replaceImage(branchId: string, id: string, buffer: Buffer | undefined): Promise<PaymentQrCode> {
    const qr = await this.find(branchId, id);
    const oldKey = qr.imagePath;
    const { key } = await this.storeImage(branchId, buffer);
    try {
      qr.imagePath = key;
      qr.qrPayload = await decodeVietQr(buffer!);
      const saved = await this.qrCodes.save(qr);
      await this.invalidate(branchId, oldKey);
      await this.deleteObject(oldKey);
      return saved;
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  async remove(branchId: string, id: string): Promise<void> {
    const qr = await this.find(branchId, id);
    await this.qrCodes.remove(qr);
    await this.invalidate(branchId, qr.imagePath);
    await this.deleteObject(qr.imagePath);
  }

  /** Streams the private image through the backend; presigned URLs would carry the internal S3 host. */
  async getImage(branchId: string, id: string): Promise<DownloadResult> {
    const qr = (await this.list(branchId)).find((row) => row.id === id);
    if (!qr) throw new NotFoundException('Payment QR code not found');

    const key = imageKey(qr.imagePath);
    const hit = await this.cacheRead(() => this.redis.getBuffer(key));
    if (hit) {
      const contentType = detectImage(hit).contentType;
      return { body: Readable.from(hit), contentType, contentLength: hit.length };
    }

    const img = await this.s3.download(qr.imagePath, QR_BUCKET);
    const bytes = await streamToBuffer(img.body);
    await this.cacheWrite(() => this.redis.setBuffer(key, bytes, IMAGE_TTL_SECONDS));
    return { ...img, body: Readable.from(bytes), contentLength: bytes.length };
  }

  private async invalidate(branchId: string, oldS3Key?: string): Promise<void> {
    const keys = [listKey(branchId)];
    if (oldS3Key) keys.push(imageKey(oldS3Key));
    await this.cacheWrite(() => this.redis.del(...keys));
  }

  /** Redis is an optimization: a failure falls back to the database / S3. */
  private async cacheRead<T>(read: () => Promise<T | null>): Promise<T | null> {
    try {
      return await read();
    } catch (err) {
      this.logger.warn({ err }, 'Payment QR cache read failed');
      return null;
    }
  }

  private async cacheWrite(write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
    } catch (err) {
      this.logger.warn({ err }, 'Payment QR cache write failed');
    }
  }

  private async find(branchId: string, id: string): Promise<PaymentQrCode> {
    const qr = await this.qrCodes.findOneBy({ id, branchId });
    if (!qr) throw new NotFoundException('Payment QR code not found');
    return qr;
  }

  private async storeImage(branchId: string, buffer: Buffer | undefined) {
    const { ext, contentType } = detectImage(buffer);
    const key = `${branchId}/${randomUUID()}.${ext}`;
    await this.s3.upload(key, buffer!, {
      contentType,
      cacheControl: 'private, max-age=31536000, immutable',
      bucket: QR_BUCKET,
    });
    return { key };
  }

  private async deleteObject(key: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.s3.delete(key, QR_BUCKET);
    } catch {
      // orphaned object, harmless
    }
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
