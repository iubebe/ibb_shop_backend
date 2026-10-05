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
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../database/enums.js';
import type {
  OrderTransitionView,
  ServedItemView,
  StaffOrderView,
} from './orders.types.js';

/** Staff-side order reads, status transitions and serving progress, always scoped to the user's branch. */
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

  /** Reception accepts a guest order: pending -> confirmed. */
  confirm(branchId: string, orderId: string): Promise<OrderTransitionView> {
    return this.transition(
      branchId,
      orderId,
      [OrderStatus.PENDING_CONFIRMATION],
      'Only orders waiting for confirmation can be confirmed',
      () => ({ status: OrderStatus.CONFIRMED, confirmedAt: new Date() }),
    );
  }

  /** Rejects or cancels an order that has not been paid yet. */
  cancel(branchId: string, orderId: string): Promise<OrderTransitionView> {
    return this.transition(
      branchId,
      orderId,
      [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED],
      'Only unpaid orders can be cancelled',
      () => ({ status: OrderStatus.CANCELLED }),
    );
  }

  /** Cashier checkout: confirmed -> paid, recording how the guest paid. */
  pay(
    branchId: string,
    orderId: string,
    paymentMethod: PaymentMethod,
  ): Promise<OrderTransitionView> {
    return this.transition(
      branchId,
      orderId,
      [OrderStatus.CONFIRMED],
      'Only confirmed orders can be paid',
      () => ({
        status: OrderStatus.PAID,
        paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
      }),
    );
  }

  /** Moves an order between statuses under a row lock, so retries and double taps are rejected, not applied twice. */
  private transition(
    branchId: string,
    orderId: string,
    allowedFrom: OrderStatus[],
    conflictMessage: string,
    changes: () => Partial<Order>,
  ): Promise<OrderTransitionView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!allowedFrom.includes(order.status)) {
        throw new ConflictException(conflictMessage);
      }
      const patch = changes();
      await manager.update(Order, order.id, patch);
      const next = { ...order, ...patch };
      return {
        id: next.id,
        status: next.status,
        confirmedAt: next.confirmedAt,
        paidAt: next.paidAt,
        paymentMethod: next.paymentMethod,
      };
    });
  }
}
