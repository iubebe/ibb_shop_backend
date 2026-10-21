import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities/customer.entity.js';
import { OrderStatus } from '../../database/enums.js';
import { toCustomerInfo } from './customer-info.js';
import type { CustomerLookupView, CustomerView } from './customers.types.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';

interface CustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  orderCount: string;
  totalSpent: string;
  lastOrderAt: Date | null;
}

/**
 * Admin management of customers, scoped to the caller's branch. Customers are created
 * by orders (see `resolveCustomer`); deleting one keeps its orders, which carry their
 * own copy of the customer info.
 */
@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly customers: Repository<Customer>) {}

  async list(branchId: string, search?: string): Promise<CustomerView[]> {
    const query = this.baseQuery(branchId).orderBy('"lastOrderAt"', 'DESC', 'NULLS LAST');
    if (search) {
      query.andWhere(
        '(c.name ILIKE :q OR c.phone ILIKE :q OR c.address ILIKE :q)',
        { q: `%${search.replace(/[\\%_]/g, '\\$&')}%` },
      );
    }
    return (await query.getRawMany<CustomerRow>()).map(view);
  }

  /** Exact match on the normalized phone; `null` when nobody has it. */
  async findByPhone(branchId: string, phone: string): Promise<CustomerLookupView | null> {
    const customer = await this.customers.findOne({ where: { branchId, phone } });
    return customer
      ? { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address }
      : null;
  }

  async get(branchId: string, id: string): Promise<CustomerView> {
    const row = await this.baseQuery(branchId).andWhere('c.id = :id', { id }).getRawOne<CustomerRow>();
    if (!row) throw new NotFoundException('Customer not found');
    return view(row);
  }

  async update(branchId: string, id: string, dto: UpdateCustomerDto): Promise<CustomerView> {
    const customer = await this.customers.findOne({ where: { id, branchId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const info = toCustomerInfo({
      customerName: dto.name === undefined ? customer.name : dto.name,
      customerPhone: dto.phone === undefined ? customer.phone : dto.phone,
      customerAddress: dto.address === undefined ? customer.address : dto.address,
    });
    if (info.phone && info.phone !== customer.phone) {
      const taken = await this.customers.exists({ where: { branchId, phone: info.phone } });
      if (taken) throw new ConflictException('Another customer already uses this phone number');
    }
    await this.customers.update(id, { name: info.name, phone: info.phone, address: info.address });
    return this.get(branchId, id);
  }

  async remove(branchId: string, id: string): Promise<void> {
    const result = await this.customers.delete({ id, branchId });
    if (!result.affected) throw new NotFoundException('Customer not found');
  }

  private baseQuery(branchId: string) {
    return this.customers
      .createQueryBuilder('c')
      .leftJoin('orders', 'o', 'o."customerId" = c.id AND o.status <> :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      })
      .select([
        'c.id AS id',
        'c.name AS name',
        'c.phone AS phone',
        'c.address AS address',
        'c."createdAt" AS "createdAt"',
      ])
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect(`COALESCE(SUM(o.total) FILTER (WHERE o.status = :paid), 0)`, 'totalSpent')
      .addSelect('MAX(o."createdAt")', 'lastOrderAt')
      .setParameter('paid', OrderStatus.PAID)
      .where('c."branchId" = :branchId', { branchId })
      .groupBy('c.id');
  }
}

const view = (row: CustomerRow): CustomerView => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  address: row.address,
  orderCount: Number(row.orderCount),
  totalSpent: Number(row.totalSpent),
  lastOrderAt: row.lastOrderAt,
  createdAt: row.createdAt,
});
