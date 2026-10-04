import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity.js';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Order } from '../../database/entities/order.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { OrderStatus } from '../../database/enums.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type {
  GuestMenuView,
  GuestOrderView,
  GuestTableView,
} from './guest.types.js';

/** Orders a guest can still see for their table (not paid or cancelled). */
const OPEN_STATUSES = [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED];

/** Guest-facing reads and order submission, scoped by the table's `qrToken`. */
@Injectable()
export class GuestService {
  constructor(
    @InjectRepository(DiningTable)
    private readonly tables: Repository<DiningTable>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async getTable(qrToken: string): Promise<GuestTableView> {
    const table = await this.findTable(qrToken);
    return { id: table.id, name: table.name };
  }

  async getMenu(qrToken: string): Promise<GuestMenuView> {
    const { branchId } = await this.findTable(qrToken);
    const [categories, products] = await Promise.all([
      this.categories.find({
        where: { branchId },
        order: { createdAt: 'ASC' },
      }),
      this.products.find({
        where: { branchId, isActive: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      products: products.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
      })),
    };
  }

  async listOrders(qrToken: string): Promise<GuestOrderView[]> {
    const table = await this.findTable(qrToken);
    const orders = await this.orders.find({
      where: { tableId: table.id, status: In(OPEN_STATUSES) },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
    });
    return orders.map(toOrderView);
  }

  async createOrder(
    qrToken: string,
    dto: CreateOrderDto,
  ): Promise<GuestOrderView> {
    const table = await this.findTable(qrToken);

    // Same product listed twice: merge into one line (notes are joined).
    const lines = new Map<string, { quantity: number; notes: string[] }>();
    for (const item of dto.items) {
      const line = lines.get(item.productId) ?? { quantity: 0, notes: [] };
      line.quantity += item.quantity;
      if (item.notes?.trim()) line.notes.push(item.notes.trim());
      lines.set(item.productId, line);
    }

    const order = await this.dataSource.transaction(async (manager) => {
      const products = await manager.find(Product, {
        where: {
          id: In([...lines.keys()]),
          branchId: table.branchId,
          isActive: true,
        },
      });
      if (products.length !== lines.size) {
        throw new BadRequestException('Some products are not available');
      }

      // Prices always come from the database, never from the client.
      const total = products.reduce(
        (sum, p) => sum + p.price * lines.get(p.id)!.quantity,
        0,
      );
      const created = await manager.save(
        manager.create(Order, {
          branchId: table.branchId,
          tableId: table.id,
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
    return toOrderView(order);
  }

  private async findTable(qrToken: string): Promise<DiningTable> {
    const table = await this.tables.findOneBy({ qrToken });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }
}

function toOrderView(order: Order): GuestOrderView {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes,
    })),
  };
}
