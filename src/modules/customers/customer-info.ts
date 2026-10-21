import { QueryFailedError, type EntityManager } from 'typeorm';
import { Customer } from '../../database/entities/customer.entity.js';

export interface CustomerInfo {
  name: string | null;
  phone: string | null;
  address: string | null;
}

/** Strips separators: "0901 234.567" -> "0901234567". */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.\-()]/g, '');
}

const blank = (value: string | null | undefined): string | null => value?.trim() || null;

/** Builds the stored info from DTO-style values; blank strings and `undefined` become `null`. */
export function toCustomerInfo(input: {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}): CustomerInfo {
  return {
    name: blank(input.customerName),
    phone: blank(input.customerPhone),
    address: blank(input.customerAddress),
  };
}

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION;

/**
 * Finds or creates the customer behind an order's info and returns its id (`null` when
 * the info is empty). A phone identifies a customer: a known phone reuses that customer
 * and fills in name/address it was missing or that were just provided; without a phone
 * a new customer is created.
 */
export async function resolveCustomer(
  manager: EntityManager,
  branchId: string,
  info: CustomerInfo,
): Promise<string | null> {
  if (!info.name && !info.phone && !info.address) return null;

  if (!info.phone) {
    const created = await manager.save(manager.create(Customer, { branchId, ...info }));
    return created.id;
  }

  const existing = await findByPhone(manager, branchId, info.phone);
  if (existing) return refresh(manager, existing, info);

  // A concurrent order may insert the same phone between the lookup and the insert. The
  // insert runs in a savepoint so the violation doesn't abort the surrounding transaction.
  try {
    const created = await manager.transaction((nested) =>
      nested.save(nested.create(Customer, { branchId, ...info })),
    );
    return created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await findByPhone(manager, branchId, info.phone);
    if (!winner) throw error;
    return refresh(manager, winner, info);
  }
}

const findByPhone = (manager: EntityManager, branchId: string, phone: string) =>
  manager.findOne(Customer, { where: { branchId, phone } });

/** Fills in a name/address that was just provided and differs; returns the customer id. */
async function refresh(manager: EntityManager, existing: Customer, info: CustomerInfo) {
  const patch: Partial<Customer> = {};
  if (info.name && info.name !== existing.name) patch.name = info.name;
  if (info.address && info.address !== existing.address) patch.address = info.address;
  if (Object.keys(patch).length > 0) await manager.update(Customer, existing.id, patch);
  return existing.id;
}
