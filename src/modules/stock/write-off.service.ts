import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import type { AuthUser } from '../../auth/auth.types.js';
import { StockItem } from '../../database/entities/stock-item.entity.js';
import { WriteOff } from '../../database/entities/write-off.entity.js';
import {
  StockItemMovementReason,
  UserRole,
  WriteOffCause,
  WriteOffStatus,
} from '../../database/enums.js';
import type {
  ConfirmWriteOffDto,
  CreateWriteOffDto,
} from './dto/write-off.dto.js';
import { StockService } from './stock.service.js';
import type { AtRiskItemView, WriteOffView } from './stock.types.js';

/** Flag stock whose estimated expiry is within this many days. */
export const EXPIRING_SOON_DAYS = 3;
/** Flag stock with no outflow (or import) for this many days. */
export const STALE_DAYS = 14;

const MINE_LIMIT = 50;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

const AT_RISK_SQL = `
  SELECT s.id, s.name, s.kind, s.unit, s.quantity::float8 AS quantity,
         s."lastUnitCost"::float8 AS "lastUnitCost",
         s."shelfLifeDays", s."createdAt",
         (SELECT MAX(r."importedAt") FROM import_receipt_lines l
            JOIN import_receipts r ON r.id = l."receiptId"
            WHERE l."stockItemId" = s.id AND r.status = 'confirmed') AS "lastImportedAt",
         (SELECT MAX(m."createdAt") FROM stock_item_movements m
            WHERE m."stockItemId" = s.id AND m.change < 0) AS "lastOutflowAt"
  FROM stock_items s
  WHERE s."branchId" = $1 AND s."isActive" AND s.quantity > 0`;

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * Surplus stock that spoils: admin writes it off directly, staff propose and
 * an admin confirms. Quantity changes go through `StockService.applyMovement`
 * so the ledger stays complete.
 */
@Injectable()
export class WriteOffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stock: StockService,
    @InjectRepository(WriteOff)
    private readonly writeOffs: Repository<WriteOff>,
    @InjectRepository(StockItem)
    private readonly items: Repository<StockItem>,
  ) {}

  /** Items with stock on hand that are expired, near expiry or not moving. Admin only. */
  async atRisk(branchId: string, now = new Date()): Promise<AtRiskItemView[]> {
    const rows = await this.dataSource.query<
      {
        id: string;
        name: string;
        kind: AtRiskItemView['kind'];
        unit: string;
        quantity: number;
        lastUnitCost: number | null;
        shelfLifeDays: number | null;
        createdAt: Date;
        lastImportedAt: Date | null;
        lastOutflowAt: Date | null;
      }[]
    >(AT_RISK_SQL, [branchId]);

    const views = rows.map((r): AtRiskItemView => {
      const lastImportedAt = r.lastImportedAt && new Date(r.lastImportedAt);
      const lastOutflowAt = r.lastOutflowAt && new Date(r.lastOutflowAt);
      const expiry =
        lastImportedAt && r.shelfLifeDays !== null
          ? new Date(lastImportedAt.getTime() + r.shelfLifeDays * DAY_MS)
          : null;
      const reference = lastOutflowAt ?? lastImportedAt ?? new Date(r.createdAt);
      const idleDays = Math.floor((now.getTime() - reference.getTime()) / DAY_MS);
      return {
        id: r.id,
        name: r.name,
        kind: r.kind,
        unit: r.unit,
        quantity: r.quantity,
        lastUnitCost: r.lastUnitCost,
        value: round(r.quantity * (r.lastUnitCost ?? 0), 2),
        shelfLifeDays: r.shelfLifeDays,
        lastImportedAt,
        lastOutflowAt,
        estimatedExpiryAt: expiry,
        expired: expiry !== null && expiry <= now,
        expiringSoon:
          expiry !== null &&
          expiry > now &&
          expiry.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * DAY_MS,
        stale: idleDays >= STALE_DAYS,
        idleDays,
      };
    });
    return views
      .filter((v) => v.expired || v.expiringSoon || v.stale)
      .sort(
        (a, b) =>
          Number(b.expired) - Number(a.expired) ||
          Number(b.expiringSoon) - Number(a.expiringSoon) ||
          b.value - a.value,
      );
  }

  /** Admin: remove stock now. */
  async createDirect(
    branchId: string,
    adminId: string,
    dto: CreateWriteOffDto,
  ): Promise<WriteOffView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const item = await this.stock.lockItem(manager, branchId, dto.stockItemId);
      const now = new Date();
      const saved = await manager.save(
        manager.create(WriteOff, {
          branchId,
          stockItemId: item.id,
          quantity: dto.quantity,
          cause: dto.cause,
          note: dto.note || null,
          status: WriteOffStatus.CONFIRMED,
          createdByUserId: adminId,
          reviewedByUserId: adminId,
          reviewedAt: now,
        }),
      );
      await this.apply(manager, item, saved, dto.quantity, adminId, now);
      return saved.id;
    });
    return this.getView(branchId, id, false);
  }

  /** Staff: propose a write-off. Stock is not changed. */
  async propose(
    branchId: string,
    userId: string,
    dto: CreateWriteOffDto,
  ): Promise<WriteOffView> {
    const item = await this.items.findOne({
      where: { id: dto.stockItemId, branchId },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    if (!item.isActive) {
      throw new BadRequestException(`"${item.name}" is deactivated`);
    }
    const saved = await this.writeOffs.save(
      this.writeOffs.create({
        branchId,
        stockItemId: item.id,
        quantity: dto.quantity,
        cause: dto.cause,
        note: dto.note || null,
        status: WriteOffStatus.PENDING,
        createdByUserId: userId,
      }),
    );
    return this.getView(branchId, saved.id, true);
  }

  /** Admin: approve a proposal (optionally correcting the quantity) and remove the stock. */
  async confirm(
    branchId: string,
    adminId: string,
    id: string,
    dto: ConfirmWriteOffDto,
  ): Promise<WriteOffView> {
    await this.dataSource.transaction(async (manager) => {
      const writeOff = await this.lockPending(manager, branchId, id);
      const item = await this.stock.lockItem(
        manager,
        branchId,
        writeOff.stockItemId,
      );
      const now = new Date();
      writeOff.reviewedByUserId = adminId;
      writeOff.reviewedAt = now;
      writeOff.status = WriteOffStatus.CONFIRMED;
      await this.apply(
        manager,
        item,
        writeOff,
        dto.quantity ?? writeOff.quantity,
        adminId,
        now,
      );
    });
    return this.getView(branchId, id, false);
  }

  async reject(
    branchId: string,
    adminId: string,
    id: string,
    reason: string,
  ): Promise<WriteOffView> {
    await this.dataSource.transaction(async (manager) => {
      const writeOff = await this.lockPending(manager, branchId, id);
      writeOff.status = WriteOffStatus.REJECTED;
      writeOff.rejectReason = reason;
      writeOff.reviewedByUserId = adminId;
      writeOff.reviewedAt = new Date();
      await manager.save(writeOff);
    });
    return this.getView(branchId, id, false);
  }

  /** Withdraw a pending proposal (author or admin). */
  async cancel(branchId: string, user: AuthUser, id: string): Promise<void> {
    const writeOff = await this.writeOffs.findOne({ where: { id, branchId } });
    if (
      !writeOff ||
      (user.role !== UserRole.ADMIN && writeOff.createdByUserId !== user.id)
    ) {
      throw new NotFoundException('Write-off not found');
    }
    if (writeOff.status !== WriteOffStatus.PENDING) {
      throw new ConflictException('Only pending proposals can be withdrawn');
    }
    await this.writeOffs.remove(writeOff);
  }

  /** Admin: write-offs created in `[from, to)`, newest first. */
  async list(branchId: string, from: Date, to: Date): Promise<WriteOffView[]> {
    if (!(from < to)) {
      throw new BadRequestException('`from` must be before `to`');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
    }
    const rows = await this.writeOffs.find({
      where: { branchId, createdAt: And(MoreThanOrEqual(from), LessThan(to)) },
      relations: { stockItem: true, createdByUser: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => view(r, false));
  }

  /** Admin: proposals waiting for review, oldest first. */
  async listPending(branchId: string): Promise<WriteOffView[]> {
    const rows = await this.writeOffs.find({
      where: { branchId, status: WriteOffStatus.PENDING },
      relations: { stockItem: true, createdByUser: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => view(r, false));
  }

  /** The caller's own recent proposals and their outcome (no costs). */
  async listMine(branchId: string, userId: string): Promise<WriteOffView[]> {
    const rows = await this.writeOffs.find({
      where: { branchId, createdByUserId: userId },
      relations: { stockItem: true, createdByUser: true },
      order: { createdAt: 'DESC' },
      take: MINE_LIMIT,
    });
    return rows.map((r) => view(r, true));
  }

  private async getView(
    branchId: string,
    id: string,
    hideCost: boolean,
  ): Promise<WriteOffView> {
    const row = await this.writeOffs.findOne({
      where: { id, branchId },
      relations: { stockItem: true, createdByUser: true },
    });
    if (!row) throw new NotFoundException('Write-off not found');
    return view(row, hideCost);
  }

  /** Remove stock for a (locked) item and stamp the write-off as done. */
  private async apply(
    manager: Parameters<StockService['applyMovement']>[0],
    item: StockItem,
    writeOff: WriteOff,
    quantity: number,
    userId: string,
    now: Date,
  ): Promise<void> {
    if (!item.isActive) {
      throw new BadRequestException(`"${item.name}" is deactivated`);
    }
    await this.stock.applyMovement(manager, item, {
      change: -quantity,
      reason: StockItemMovementReason.WRITE_OFF,
      note: writeOff.note
        ? `${writeOff.cause}: ${writeOff.note}`
        : writeOff.cause,
      userId,
    });
    const unitCost = item.lastUnitCost ?? 0;
    writeOff.quantity = quantity;
    writeOff.unitCost = unitCost;
    writeOff.totalCost = round(quantity * unitCost, 2);
    writeOff.writtenOffAt = now;
    await manager.save(writeOff);
  }

  private async lockPending(
    manager: Parameters<StockService['applyMovement']>[0],
    branchId: string,
    id: string,
  ): Promise<WriteOff> {
    const writeOff = await manager.findOne(WriteOff, {
      where: { id, branchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!writeOff) throw new NotFoundException('Write-off not found');
    if (writeOff.status !== WriteOffStatus.PENDING) {
      throw new ConflictException('Write-off is already reviewed');
    }
    return writeOff;
  }
}

function view(w: WriteOff, hideCost: boolean): WriteOffView {
  return {
    id: w.id,
    stockItem: {
      id: w.stockItem.id,
      name: w.stockItem.name,
      unit: w.stockItem.unit,
    },
    quantity: w.quantity,
    cause: w.cause as WriteOffCause,
    note: w.note,
    status: w.status,
    unitCost: hideCost ? null : w.unitCost,
    totalCost: hideCost ? null : w.totalCost,
    writtenOffAt: w.writtenOffAt,
    rejectReason: w.rejectReason,
    createdByName: w.createdByUser?.name ?? null,
    createdByUserId: w.createdByUserId,
    createdAt: w.createdAt,
  };
}
