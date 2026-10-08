import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { OrderStatus } from '../../database/enums.js';
import type { CreateOrderStaffDto } from './dto/create-order-staff.dto.js';
import type { ServedItemView, StaffOrderView } from './orders.types.js';

/** Staff-side order reads and serving progress, always scoped to the user's branch. */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(DiningTable) private readonly tables: Repository<DiningTable>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    branchId: string,
    status?: OrderStatus,
  ): Promise<StaffOrderView[]> {
    const orders = await this.orders.find({
      where: { branchId, ...(status ? { status } : {}) },
      relations: { table: true, items: { product: true } },
      order: { createdAt: 'ASC' },
    });
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      tableId: o.tableId,
      tableName: o.table?.name ?? null,
      total: o.total,
      createdAt: o.createdAt,
      confirmedAt: o.confirmedAt,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.product.name,
        quantity: i.quantity,
        servedQuantity: i.servedQuantity,
        notes: i.notes,
      })),
    }));
  }

  async createOrder(
    branchId: string,
    userId: string,
    dto: CreateOrderStaffDto,
  ): Promise<StaffOrderView> {
    const order = await this.dataSource.transaction(async (manager) => {
      const table = await manager.findOne(DiningTable, {
        where: { id: dto.tableId, branchId },
      });
      if (!table) throw new NotFoundException('Table not found');

      const lines = new Map<string, { quantity: number; notes: string[] }>();
      for (const item of dto.items) {
        const line = lines.get(item.productId) ?? { quantity: 0, notes: [] };
        line.quantity += item.quantity;
        if (item.notes?.trim()) line.notes.push(item.notes.trim());
        lines.set(item.productId, line);
      }

      const products = await manager.find(Product, {
        where: {
          id: In([...lines.keys()]),
          branchId,
          isActive: true,
        },
      });
      if (products.length !== lines.size) {
        throw new BadRequestException('Some products are not available');
      }

      const total = products.reduce(
        (sum, p) => sum + p.price * lines.get(p.id)!.quantity,
        0,
      );
      const created = await manager.save(
        manager.create(Order, {
          branchId,
          tableId: table.id,
          createdByUserId: userId,
          status: OrderStatus.PENDING_CONFIRMATION,
          total,
        }),
      );
      created.items = await manager.save(
        products.map((p) => {
          const line = lines.get(p.id)!;
          return manager.create(OrderItem, {
            orderId: created.id,
            productId: p.id,
            product: p,
            quantity: line.quantity,
            unitPrice: p.price,
            notes: line.notes.join('; ') || null,
          });
        }),
      );
      return created;
    });

    return {
      id: order.id,
      status: order.status,
      tableId: order.tableId,
      tableName: order.table?.name ?? null,
      total: order.total,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.product.name,
        quantity: i.quantity,
        servedQuantity: i.servedQuantity,
        notes: i.notes,
      })),
    };
  }

  /** Sets how many units of an item were delivered to the table. */
  async setServed(
    branchId: string,
    orderId: string,
    itemId: string,
    servedQuantity: number,
  ): Promise<ServedItemView> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the row so two staff updating the same line can't interleave.
      const item = await manager.findOne(OrderItem, {
        where: { id: itemId, orderId, order: { branchId } },
        relations: { order: true },
        lock: { mode: 'pessimistic_write', tables: ['order_items'] },
      });
      if (!item) throw new NotFoundException('Order item not found');
      if (item.order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException('Only confirmed orders can be served');
      }
      if (servedQuantity > item.quantity) {
        throw new BadRequestException(
          `servedQuantity cannot exceed the ordered quantity (${item.quantity})`,
        );
      }
      await manager.update(OrderItem, item.id, { servedQuantity });
      return { id: item.id, quantity: item.quantity, servedQuantity };
    });
  }
}
