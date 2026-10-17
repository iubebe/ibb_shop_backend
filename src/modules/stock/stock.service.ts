import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  And,
  DataSource,
  EntityManager,
  LessThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ImportReceiptLine } from '../../database/entities/import-receipt-line.entity.js';
import { ImportReceipt } from '../../database/entities/import-receipt.entity.js';
import { StockItemMovement } from '../../database/entities/stock-item-movement.entity.js';
import { StockItem } from '../../database/entities/stock-item.entity.js';
import { Supplier } from '../../database/entities/supplier.entity.js';
import {
  StockItemKind,
  StockItemMovementReason,
} from '../../database/enums.js';
import type {
  AdjustStockDto,
  CreateImportDto,
  CreateStockItemDto,
  UpdateStockItemDto,
  UpsertSupplierDto,
} from './dto/stock.dto.js';
import type {
  ImportReceiptView,
  StockItemView,
  StockMovementView,
  SupplierView,
} from './stock.types.js';

const DEFAULT_MOVEMENT_LIMIT = 50;
/** Max range for the import list, keeps the response bounded. */
const MAX_RANGE_DAYS = 93;

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/**
 * Goods/material stock for a branch: catalog, suppliers, instant import
 * receipts and manual adjustments. `StockItem.quantity` only ever changes
 * through `applyMovement`, which also appends the ledger row.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StockItem)
    private readonly items: Repository<StockItem>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(ImportReceipt)
    private readonly receipts: Repository<ImportReceipt>,
    @InjectRepository(StockItemMovement)
    private readonly movements: Repository<StockItemMovement>,
  ) {}

  // ---- Stock items -------------------------------------------------------

  async listItems(
    branchId: string,
    kind?: StockItemKind,
  ): Promise<StockItemView[]> {
    const rows = await this.items.find({
      where: { branchId, ...(kind ? { kind } : {}) },
      order: { name: 'ASC' },
    });
    return rows.map(itemView);
  }

  async createItem(
    branchId: string,
    dto: CreateStockItemDto,
  ): Promise<StockItemView> {
    await this.assertItemNameFree(branchId, dto.name);
    const saved = await this.items.save(
      this.items.create({
        branchId,
        name: dto.name,
        kind: dto.kind,
        unit: dto.unit,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
      }),
    );
    return itemView(saved);
  }

  async updateItem(
    branchId: string,
    id: string,
    dto: UpdateStockItemDto,
  ): Promise<StockItemView> {
    const item = await this.findItem(branchId, id);
    if (dto.name !== undefined && dto.name !== item.name) {
      await this.assertItemNameFree(branchId, dto.name, id);
    }
    Object.assign(item, dto);
    return itemView(await this.items.save(item));
  }

  /** Items with history can't be deleted (the ledger must stay readable): deactivate them instead. */
  async removeItem(branchId: string, id: string): Promise<void> {
    const item = await this.findItem(branchId, id);
    const used = await this.movements.exists({ where: { stockItemId: id } });
    if (used) {
      throw new ConflictException(
        'Item has stock history; deactivate it instead of deleting',
      );
    }
    await this.items.remove(item);
  }

  async itemMovements(
    branchId: string,
    id: string,
    limit = DEFAULT_MOVEMENT_LIMIT,
  ): Promise<StockMovementView[]> {
    await this.findItem(branchId, id);
    const rows = await this.movements.find({
      where: { stockItemId: id },
      relations: { receipt: true, createdByUser: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((m) => ({
      id: m.id,
      change: m.change,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      receiptCode: m.receipt?.code ?? null,
      note: m.note,
      createdAt: m.createdAt,
      createdByName: m.createdByUser?.name ?? null,
    }));
  }

  /** Stocktake/waste correction. Cannot take stock below zero. */
  async adjust(
    branchId: string,
    userId: string,
    id: string,
    dto: AdjustStockDto,
  ): Promise<StockItemView> {
    if (dto.change === 0) throw new BadRequestException('Change cannot be 0');
    const item = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockItem(manager, branchId, id);
      return this.applyMovement(manager, locked, {
        change: dto.change,
        reason: StockItemMovementReason.ADJUSTMENT,
        note: dto.note,
        userId,
      });
    });
    return itemView(item);
  }

  // ---- Suppliers ---------------------------------------------------------

  async listSuppliers(branchId: string): Promise<SupplierView[]> {
    const rows = await this.suppliers.find({
      where: { branchId },
      order: { name: 'ASC' },
    });
    return rows.map(supplierView);
  }

  async createSupplier(
    branchId: string,
    dto: UpsertSupplierDto,
  ): Promise<SupplierView> {
    const saved = await this.suppliers.save(
      this.suppliers.create({
        branchId,
        name: dto.name,
        phone: dto.phone ?? null,
        note: dto.note ?? null,
      }),
    );
    return supplierView(saved);
  }

  async updateSupplier(
    branchId: string,
    id: string,
    dto: UpsertSupplierDto,
  ): Promise<SupplierView> {
    const supplier = await this.findSupplier(branchId, id);
    supplier.name = dto.name;
    if (dto.phone !== undefined) supplier.phone = dto.phone;
    if (dto.note !== undefined) supplier.note = dto.note;
    return supplierView(await this.suppliers.save(supplier));
  }

  /** Past receipts keep their lines; the supplier link just becomes empty. */
  async removeSupplier(branchId: string, id: string): Promise<void> {
    const supplier = await this.findSupplier(branchId, id);
    await this.suppliers.remove(supplier);
  }

  // ---- Imports -----------------------------------------------------------

  async createImport(
    branchId: string,
    userId: string,
    dto: CreateImportDto,
  ): Promise<ImportReceiptView> {
    if (dto.supplierId) await this.findSupplier(branchId, dto.supplierId);

    const receiptId = await this.dataSource.transaction(async (manager) => {
      const importedAt = dto.importedAt ? new Date(dto.importedAt) : new Date();
      const code = await this.nextCode(manager, branchId, importedAt);
      const totalCost = round(
        dto.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0),
        2,
      );

      const receipt = await manager.save(
        manager.create(ImportReceipt, {
          branchId,
          code,
          supplierId: dto.supplierId ?? null,
          importedAt,
          note: dto.note ?? null,
          totalCost,
          createdByUserId: userId,
        }),
      );

      // Lock in a stable order so concurrent imports can't deadlock.
      const ids = [...new Set(dto.lines.map((l) => l.stockItemId))].sort();
      const locked = new Map<string, StockItem>();
      for (const itemId of ids) {
        locked.set(itemId, await this.lockItem(manager, branchId, itemId));
      }

      for (const line of dto.lines) {
        const item = locked.get(line.stockItemId)!;
        if (!item.isActive) {
          throw new BadRequestException(`"${item.name}" is deactivated`);
        }
        await manager.save(
          manager.create(ImportReceiptLine, {
            receiptId: receipt.id,
            stockItemId: item.id,
            quantity: line.quantity,
            unitCost: line.unitCost,
          }),
        );
        await this.applyMovement(manager, item, {
          change: line.quantity,
          reason: StockItemMovementReason.IMPORT,
          receiptId: receipt.id,
          userId,
        });
        item.lastUnitCost = line.unitCost;
        await manager.save(item);
      }
      return receipt.id;
    });

    return this.getImport(branchId, receiptId);
  }

  /** Receipts with `importedAt` in `[from, to)`, newest first. */
  async listImports(
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<ImportReceiptView[]> {
    if (!(from < to)) {
      throw new BadRequestException('`from` must be before `to`');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`Range is limited to ${MAX_RANGE_DAYS} days`);
    }
    const rows = await this.receipts.find({
      where: {
        branchId,
        importedAt: And(MoreThanOrEqual(from), LessThan(to)),
      },
      relations: {
        supplier: true,
        createdByUser: true,
        lines: { stockItem: true },
      },
      order: { importedAt: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(receiptView);
  }

  async getImport(branchId: string, id: string): Promise<ImportReceiptView> {
    const row = await this.receipts.findOne({
      where: { id, branchId },
      relations: {
        supplier: true,
        createdByUser: true,
        lines: { stockItem: true },
      },
    });
    if (!row) throw new NotFoundException('Import receipt not found');
    return receiptView(row);
  }

  // ---- Internals ---------------------------------------------------------

  private async findItem(branchId: string, id: string): Promise<StockItem> {
    const item = await this.items.findOne({ where: { id, branchId } });
    if (!item) throw new NotFoundException('Stock item not found');
    return item;
  }

  private async findSupplier(branchId: string, id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findOne({ where: { id, branchId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async assertItemNameFree(
    branchId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.items
      .createQueryBuilder('i')
      .where('i.branchId = :branchId', { branchId })
      .andWhere('LOWER(i.name) = LOWER(:name)', { name })
      .andWhere(exceptId ? 'i.id <> :exceptId' : '1=1', { exceptId })
      .getExists();
    if (clash) throw new ConflictException('Item name already exists');
  }

  private async lockItem(
    manager: EntityManager,
    branchId: string,
    id: string,
  ): Promise<StockItem> {
    const item = await manager.findOne(StockItem, {
      where: { id, branchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    return item;
  }

  /** Change the (already locked) item's quantity and append the ledger row. */
  private async applyMovement(
    manager: EntityManager,
    item: StockItem,
    m: {
      change: number;
      reason: StockItemMovementReason;
      userId: string;
      receiptId?: string;
      note?: string;
    },
  ): Promise<StockItem> {
    const next = round(item.quantity + m.change, 3);
    if (next < 0) {
      throw new BadRequestException(
        `Not enough stock for "${item.name}" (have ${item.quantity} ${item.unit})`,
      );
    }
    item.quantity = next;
    const saved = await manager.save(item);
    await manager.save(
      manager.create(StockItemMovement, {
        stockItemId: item.id,
        change: m.change,
        quantityAfter: next,
        reason: m.reason,
        receiptId: m.receiptId ?? null,
        note: m.note ?? null,
        createdByUserId: m.userId,
      }),
    );
    return saved;
  }

  /** `PN-YYYYMMDD-NNN`, numbered per branch and day; serialized by an advisory lock. */
  private async nextCode(
    manager: EntityManager,
    branchId: string,
    importedAt: Date,
  ): Promise<string> {
    const day = importedAt.toISOString().slice(0, 10).replaceAll('-', '');
    const prefix = `PN-${day}-`;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `import-code:${branchId}`,
    ]);
    const count = await manager
      .createQueryBuilder(ImportReceipt, 'r')
      .where('r.branchId = :branchId', { branchId })
      .andWhere('r.code LIKE :like', { like: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }
}

function itemView(i: StockItem): StockItemView {
  return {
    id: i.id,
    name: i.name,
    kind: i.kind,
    unit: i.unit,
    quantity: i.quantity,
    lowStockThreshold: i.lowStockThreshold,
    isLow: i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold,
    lastUnitCost: i.lastUnitCost,
    isActive: i.isActive,
  };
}

function supplierView(s: Supplier): SupplierView {
  return { id: s.id, name: s.name, phone: s.phone, note: s.note };
}

function receiptView(r: ImportReceipt): ImportReceiptView {
  return {
    id: r.id,
    code: r.code,
    importedAt: r.importedAt,
    supplier: r.supplier ? { id: r.supplier.id, name: r.supplier.name } : null,
    note: r.note,
    totalCost: r.totalCost,
    createdByName: r.createdByUser?.name ?? null,
    lines: [...r.lines]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((l) => ({
        stockItemId: l.stockItemId,
        name: l.stockItem.name,
        unit: l.stockItem.unit,
        quantity: l.quantity,
        unitCost: l.unitCost,
        lineTotal: round(l.quantity * l.unitCost, 2),
      })),
  };
}
