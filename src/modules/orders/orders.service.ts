import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { OrderStatus } from '../../database/enums.js';
import type { ServedItemView, StaffOrderView } from './orders.types.js';

/** Staff-side order reads and serving progress, always scoped to the user's branch. */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
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
