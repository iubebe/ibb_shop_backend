import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { PaymentQrCode } from '../../database/entities/payment-qr-code.entity.js';
import { OrderStatus } from '../../database/enums.js';
import { resolveCustomer, toCustomerInfo } from '../customers/customer-info.js';
import type { AddOrderItemsDto } from './dto/add-order-items.dto.js';
import type { CreateOrderStaffDto } from './dto/create-order-staff.dto.js';
import type { UpdateOrderCustomerDto } from './dto/update-order-customer.dto.js';
import { buildDynamicPayload, readBank } from '../payment-qr-codes/vietqr.js';
import { isOnlineTable } from './online-table.js';
import type { OrderPaymentQrView, ServedItemView, StaffOrderView } from './orders.types.js';

/** Staff-side order reads and serving progress, always scoped to the user's branch. */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(DiningTable) private readonly tables: Repository<DiningTable>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(PaymentQrCode) private readonly qrCodes: Repository<PaymentQrCode>,
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
    return orders.map((o) => this.toStaffOrderView(o));
  }

  /** Every order created in `[from, to)`, newest first. Admin review by day. */
  async history(branchId: string, from: Date, to: Date): Promise<StaffOrderView[]> {
    if (!(from < to)) {
      throw new BadRequestException('`from` must be before `to`');
    }
    const orders = await this.orders.find({
      where: { branchId, createdAt: And(MoreThanOrEqual(from), LessThan(to)) },
      relations: { table: true, items: { product: true } },
      order: { createdAt: 'DESC' },
    });
    return orders.map((o) => this.toStaffOrderView(o));
  }

  /** Orders of any day whose number (id prefix, as printed on the receipt) starts with `code`. */
  async searchByNumber(branchId: string, code: string): Promise<StaffOrderView[]> {
    const matches = await this.orders
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .where('o.branchId = :branchId', { branchId })
      // uuid range instead of a text prefix match, so the primary key index serves it.
      .andWhere('o.id BETWEEN :lo::uuid AND :hi::uuid', uuidRange(code))
      .orderBy('o.createdAt', 'DESC')
      .limit(20)
      .getRawMany<{ id: string }>();
    if (matches.length === 0) return [];
    const orders = await this.orders.find({
      where: { id: In(matches.map((m) => m.id)) },
      relations: { table: true, items: { product: true } },
      order: { createdAt: 'DESC' },
    });
    return orders.map((o) => this.toStaffOrderView(o));
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
      const customer = toCustomerInfo(dto);
      if (dto.deliveryAt && !isOnlineTable(table.name)) {
        throw new BadRequestException('Delivery time is only for online orders');
      }
      const created = await manager.save(
        manager.create(Order, {
          branchId,
          tableId: table.id,
          customerId: await resolveCustomer(manager, branchId, customer),
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          deliveryAt: dto.deliveryAt ? new Date(dto.deliveryAt) : null,
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

    return this.toStaffOrderView(order);
  }

  /**
   * Adds products to an open order. A product already on the order with the same
   * price snapshot is merged into its line (served count kept); otherwise a new line is added.
   */
  async addItems(
    branchId: string,
    orderId: string,
    dto: AddOrderItemsDto,
  ): Promise<StaffOrderView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        relations: { table: true, items: { product: true } },
        lock: { mode: 'pessimistic_write', tables: ['orders'] },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (
        order.status !== OrderStatus.CONFIRMED &&
        order.status !== OrderStatus.PENDING_CONFIRMATION
      ) {
        throw new ConflictException('Items can only be added to an open order');
      }

      const lines = new Map<string, { quantity: number; notes: string[] }>();
      for (const item of dto.items) {
        const line = lines.get(item.productId) ?? { quantity: 0, notes: [] };
        line.quantity += item.quantity;
        if (item.notes?.trim()) line.notes.push(item.notes.trim());
        lines.set(item.productId, line);
      }

      const products = await manager.find(Product, {
        where: { id: In([...lines.keys()]), branchId, isActive: true },
      });
      if (products.length !== lines.size) {
        throw new BadRequestException('Some products are not available');
      }

      for (const p of products) {
        const line = lines.get(p.id)!;
        const notes = line.notes.join('; ') || null;
        const existing = order.items.find(
          (i) => i.productId === p.id && i.unitPrice === p.price,
        );
        if (existing) {
          existing.quantity += line.quantity;
          if (notes) existing.notes = existing.notes ? `${existing.notes}; ${notes}` : notes;
          await manager.update(OrderItem, existing.id, {
            quantity: existing.quantity,
            notes: existing.notes,
          });
        } else {
          const created = await manager.save(
            manager.create(OrderItem, {
              orderId,
              productId: p.id,
              product: p,
              quantity: line.quantity,
              unitPrice: p.price,
              notes,
            }),
          );
          created.product = p;
          order.items.push(created);
        }
      }

      order.total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      await manager.update(Order, orderId, { total: order.total });
      return this.toStaffOrderView(order);
    });
  }

  /** Edits the customer info of an order that is not paid (or cancelled) yet. */
  async updateCustomer(
    branchId: string,
    orderId: string,
    dto: UpdateOrderCustomerDto,
  ): Promise<StaffOrderView> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId, branchId },
        relations: { table: true, items: { product: true } },
        lock: { mode: 'pessimistic_write', tables: ['orders'] },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.PAID) {
        throw new ConflictException('Customer info cannot be changed on a paid order');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Customer info cannot be changed on a cancelled order');
      }

      const customer = toCustomerInfo({
        customerName: dto.customerName === undefined ? order.customerName : dto.customerName,
        customerPhone: dto.customerPhone === undefined ? order.customerPhone : dto.customerPhone,
        customerAddress:
          dto.customerAddress === undefined ? order.customerAddress : dto.customerAddress,
      });
      order.customerId = await resolveCustomer(manager, branchId, customer);
      order.customerName = customer.name;
      order.customerPhone = customer.phone;
      order.customerAddress = customer.address;
      if (dto.deliveryAt !== undefined) {
        if (dto.deliveryAt && !isOnlineTable(order.table?.name)) {
          throw new BadRequestException('Delivery time is only for online orders');
        }
        order.deliveryAt = dto.deliveryAt ? new Date(dto.deliveryAt) : null;
      }
      await manager.update(Order, orderId, {
        deliveryAt: order.deliveryAt,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
      });
      return this.toStaffOrderView(order);
    });
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
      // Guest orders carry customer info only as typed; link/create the customer now.
      order.customerId = await resolveCustomer(manager, branchId, toCustomerInfo(order));
      await manager.update(Order, orderId, {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        customerId: order.customerId,
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

  /** Get active payment QR codes for a branch. */
  async getPaymentQrCodes(branchId: string) {
    return this.qrCodes.find({
      where: { branchId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Active QR codes with a per-order transfer QR: the order total and a short order code are baked
   * into the payload, so the customer's bank app opens with amount and note filled in.
   * `dynamicPayload` is null for QR images that are not VietQR.
   */
  async getOrderPaymentQrs(branchId: string, orderId: string): Promise<OrderPaymentQrView[]> {
    const order = await this.orders.findOneBy({ id: orderId, branchId });
    if (!order) throw new NotFoundException('Order not found');
    const memo = `IBB ${order.id.slice(0, 8).toUpperCase()}`;
    const codes = await this.getPaymentQrCodes(branchId);
    return codes.map((qr) => ({
      id: qr.id,
      label: qr.label,
      dynamicPayload: qr.qrPayload ? buildDynamicPayload(qr.qrPayload, order.total, memo) : null,
      bank: qr.qrPayload ? readBank(qr.qrPayload) : null,
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

  private toStaffOrderView(order: Order): StaffOrderView {
    return {
      id: order.id,
      status: order.status,
      tableId: order.tableId,
      tableName: order.table?.name ?? null,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      deliveryAt: order.deliveryAt,
      total: order.total,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.product.name,
        quantity: i.quantity,
        servedQuantity: i.servedQuantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
      })),
    };
  }
}

/** Smallest and largest uuid starting with the hex `prefix` (3-8 chars, no dashes). */
export function uuidRange(prefix: string): { lo: string; hi: string } {
  const fill = (digit: string) => {
    const hex = prefix.toLowerCase().padEnd(32, digit);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  return { lo: fill('0'), hi: fill('f') };
}
