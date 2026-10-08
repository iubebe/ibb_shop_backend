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
      order: { updatedAt: 'DESC' },
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
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
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

  /** Confirm a pending order (guest orders only). */
  async confirm(branchId: string, orderId: string): Promise<StaffOrderView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        relations: { table: true, items: { product: true } },
        lock: { mode: 'pessimistic_write', tables: ['orders'] },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
        throw new ConflictException('Only pending orders can be confirmed');
      }
      await manager.update(Order, orderId, {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
      });
      order.status = OrderStatus.CONFIRMED;
      order.confirmedAt = new Date();
      return this.toStaffOrderView(order);
    });
  }

  /** Cancel an order. */
  async cancel(branchId: string, orderId: string): Promise<StaffOrderView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        relations: { table: true, items: { product: true } },
        lock: { mode: 'pessimistic_write', tables: ['orders'] },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Order is already cancelled');
      }
      if (order.status === OrderStatus.PAID) {
        throw new ConflictException('Cannot cancel a paid order');
      }
      await manager.update(Order, orderId, { status: OrderStatus.CANCELLED });
      order.status = OrderStatus.CANCELLED;
      return this.toStaffOrderView(order);
    });
  }

  /** Mark order as paid. */
  async pay(branchId: string, orderId: string, paymentMethod: 'cash' | 'qr_manual'): Promise<StaffOrderView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        relations: { table: true, items: { product: true } },
        lock: { mode: 'pessimistic_write', tables: ['orders'] },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Cannot pay for a cancelled order');
      }
      if (order.status === OrderStatus.PAID) {
        throw new ConflictException('Order is already paid');
      }
      await manager.update(Order, orderId, {
        status: OrderStatus.PAID,
        paymentMethod: paymentMethod as any,
        paidAt: new Date(),
      });
      order.status = OrderStatus.PAID;
      order.paymentMethod = paymentMethod as any;
      order.paidAt = new Date();
      return this.toStaffOrderView(order);
    });
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

  private toStaffOrderView(order: Order): StaffOrderView {
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
}
