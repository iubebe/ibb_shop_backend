import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { WifiSecurity } from '../../database/enums.js';
import { WifiNetwork } from '../../database/entities/wifi-network.entity.js';
import { S3Service } from '../../s3/s3.service.js';
import type { DownloadResult } from '../../s3/s3.types.js';
import type { WifiCredentialsDto } from './dto/wifi.dto.js';
import { buildWifiPayload } from './wifi-payload.js';
import type { WifiView } from './wifi.types.js';

const WIFI_BUCKET = 'wifi-qr';

const HEX = /^[0-9a-fA-F]+$/;

/**
 * Admin management of the guest WiFi QR. The password only lives in the request
 * that carries it: it is encoded into the QR image and never written to the
 * database, cache or logs. The image is the secret (anyone who decodes it gets
 * the password), so it stays in a private bucket and is served only to admins.
 */
@Injectable()
export class WifiService {
  constructor(
    @InjectRepository(WifiNetwork) private readonly networks: Repository<WifiNetwork>,
    private readonly dataSource: DataSource,
    private readonly s3: S3Service,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WifiService.name);
  }

  async list(branchId: string): Promise<WifiView[]> {
    const rows = await this.networks.find({ where: { branchId }, order: { createdAt: 'ASC' } });
    return rows.map(view);
  }

  /** The new network becomes the active one. */
  async create(branchId: string, dto: WifiCredentialsDto): Promise<WifiView> {
    const key = await this.storeQr(branchId, dto);
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        await manager.update(WifiNetwork, { branchId, isActive: true }, { isActive: false });
        return manager.save(
          manager.create(WifiNetwork, {
            branchId,
            ssid: dto.ssid,
            security: dto.security,
            hidden: dto.hidden ?? false,
            imagePath: key,
            isActive: true,
          }),
        );
      });
      return view(saved);
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  /** Password change (or SSID/security change): the QR is rebuilt from the full credentials. */
  async replaceCredentials(branchId: string, id: string, dto: WifiCredentialsDto): Promise<WifiView> {
    const network = await this.find(branchId, id);
    const oldKey = network.imagePath;
    const key = await this.storeQr(branchId, dto);
    try {
      network.ssid = dto.ssid;
      network.security = dto.security;
      network.hidden = dto.hidden ?? false;
      network.imagePath = key;
      const saved = await this.networks.save(network);
      await this.deleteObject(oldKey);
      return view(saved);
    } catch (err) {
      await this.deleteObject(key);
      throw err;
    }
  }

  async setActive(branchId: string, id: string, isActive: boolean): Promise<WifiView> {
    const network = await this.find(branchId, id);
    if (network.isActive === isActive) return view(network);
    const saved = await this.dataSource.transaction(async (manager) => {
      if (isActive) {
        await manager.update(WifiNetwork, { branchId, isActive: true }, { isActive: false });
      }
      network.isActive = isActive;
      return manager.save(network);
    });
    return view(saved);
  }

  async remove(branchId: string, id: string): Promise<void> {
    const network = await this.find(branchId, id);
    await this.networks.remove(network);
    await this.deleteObject(network.imagePath);
  }

  /** Streams the private QR through the backend; never cached in Redis because the image encodes the password. */
  async getImage(branchId: string, id: string): Promise<DownloadResult> {
    const network = await this.find(branchId, id);
    return this.s3.download(network.imagePath, WIFI_BUCKET);
  }

  /** PNG of the branch's active network for the table QR sheet, or null when none is set up. */
  async getActiveQr(branchId: string): Promise<{ ssid: string; png: Buffer } | null> {
    const network = await this.networks.findOneBy({ branchId, isActive: true });
    if (!network) return null;
    const { body } = await this.s3.download(network.imagePath, WIFI_BUCKET);
    return { ssid: network.ssid, png: await streamToBuffer(body) };
  }

  private async find(branchId: string, id: string): Promise<WifiNetwork> {
    const network = await this.networks.findOneBy({ id, branchId });
    if (!network) throw new NotFoundException('WiFi network not found');
    return network;
  }

  private async storeQr(branchId: string, dto: WifiCredentialsDto): Promise<string> {
    assertValid(dto);
    const png = await QRCode.toBuffer(buildWifiPayload(dto), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 600,
    });
    await this.s3.ensureBucket(WIFI_BUCKET);
    const key = `${branchId}/${randomUUID()}.png`;
    await this.s3.upload(key, png, {
      contentType: 'image/png',
      cacheControl: 'private, no-store',
      bucket: WIFI_BUCKET,
    });
    return key;
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      await this.s3.delete(key, WIFI_BUCKET);
    } catch (err) {
      this.logger.warn({ err, key }, 'Orphaned WiFi QR object, delete it manually');
    }
  }
}

/** Rules a phone enforces when joining: otherwise the printed QR would silently never connect. */
function assertValid({ ssid, security, password }: WifiCredentialsDto): void {
  if (Buffer.byteLength(ssid) > 32) throw new BadRequestException('SSID is longer than 32 bytes');
  if (security === WifiSecurity.OPEN) {
    if (password) throw new BadRequestException('An open network has no password');
    return;
  }
  const pw = password ?? '';
  if (security === WifiSecurity.WPA) {
    const ok = (pw.length >= 8 && pw.length <= 63) || (pw.length === 64 && HEX.test(pw));
    if (!ok) throw new BadRequestException('WPA password must be 8-63 characters (or 64 hex digits)');
  } else {
    const ok = [5, 13].includes(pw.length) || ([10, 26].includes(pw.length) && HEX.test(pw));
    if (!ok) throw new BadRequestException('WEP key must be 5 or 13 characters (or 10 or 26 hex digits)');
  }
}

function view(n: WifiNetwork): WifiView {
  return {
    id: n.id,
    ssid: n.ssid,
    security: n.security,
    hidden: n.hidden,
    isActive: n.isActive,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
