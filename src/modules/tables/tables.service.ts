import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { ILike, In, Repository } from 'typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import type { TableView } from './tables.types.js';

const DEFAULT_GUEST_URL = 'http://localhost:5176';
const A4 = { width: 595.28, height: 841.89 };
const PAGE_MARGIN = 28;

const newToken = () => randomBytes(18).toString('base64url');

/**
 * Admin CRUD for dining tables plus a printable QR sheet, always scoped to
 * the caller's branch. The `qrToken` is the guest's only credential, so
 * regenerating it invalidates the printed QR.
 */
@Injectable()
export class TablesService {
  private readonly guestUrl: string;

  constructor(
    @InjectRepository(DiningTable)
    private readonly tables: Repository<DiningTable>,
    config: ConfigService,
  ) {
    this.guestUrl = (config.get<string>('GUEST_APP_URL') || DEFAULT_GUEST_URL)
      .trim()
      .replace(/\/+$/, '');
  }

  async list(branchId: string): Promise<TableView[]> {
    const rows = await this.tables.find({
      where: { branchId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(view);
  }

  async create(branchId: string, dto: { name: string }): Promise<TableView> {
    await this.assertNameFree(branchId, dto.name);
    const saved = await this.tables.save(
      this.tables.create({ branchId, name: dto.name, qrToken: newToken() }),
    );
    return view(saved);
  }

  async update(
    branchId: string,
    id: string,
    dto: { name: string },
  ): Promise<TableView> {
    const table = await this.find(branchId, id);
    await this.assertNameFree(branchId, dto.name, id);
    table.name = dto.name;
    return view(await this.tables.save(table));
  }

  async regenerateToken(branchId: string, id: string): Promise<TableView> {
    const table = await this.find(branchId, id);
    table.qrToken = newToken();
    return view(await this.tables.save(table));
  }

  /** Orders keep their history: `orders.tableId` is `SET NULL`. */
  async remove(branchId: string, id: string): Promise<void> {
    await this.tables.remove(await this.find(branchId, id));
  }

  async qrPdf(
    branchId: string,
    opts: { columns?: number; rows?: number; ids?: string[] },
  ): Promise<Buffer> {
    const rows = opts.ids?.length
      ? await this.tables.find({
          where: { branchId, id: In(opts.ids) },
          order: { createdAt: 'ASC' },
        })
      : await this.tables.find({
          where: { branchId },
          order: { createdAt: 'ASC' },
        });
    if (rows.length === 0) {
      throw new BadRequestException('No tables to print');
    }

    const columns = opts.columns ?? 3;
    const perPage = columns * (opts.rows ?? 4);
    const cellW = (A4.width - PAGE_MARGIN * 2) / columns;
    const cellH = (A4.height - PAGE_MARGIN * 2) / (opts.rows ?? 4);
    const size = Math.min(cellW, cellH) - 16;

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    for (const [i, table] of rows.entries()) {
      const slot = i % perPage;
      if (i > 0 && slot === 0) doc.addPage();
      const png = await QRCode.toBuffer(`${this.guestUrl}/t/${table.qrToken}`, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 600,
      });
      const x = PAGE_MARGIN + (slot % columns) * cellW + (cellW - size) / 2;
      const y =
        PAGE_MARGIN + Math.floor(slot / columns) * cellH + (cellH - size) / 2;
      doc.image(png, x, y, { width: size, height: size });
    }

    doc.end();
    return done;
  }

  private async find(branchId: string, id: string): Promise<DiningTable> {
    const table = await this.tables.findOneBy({ id, branchId });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  private async assertNameFree(
    branchId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.tables.findOneBy({
      branchId,
      name: ILike(name.replace(/[\\%_]/g, '\\$&')),
    });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException('A table with this name already exists');
    }
  }
}

function view(t: DiningTable): TableView {
  return {
    id: t.id,
    name: t.name,
    qrToken: t.qrToken,
    createdAt: t.createdAt,
  };
}
