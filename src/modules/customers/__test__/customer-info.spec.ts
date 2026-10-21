import { QueryFailedError } from 'typeorm';
import { resolveCustomer, toCustomerInfo, normalizePhone } from '../customer-info.js';

describe('customer info helpers', () => {
  it('normalizes phone separators', () => {
    expect(normalizePhone('0901 234.567')).toBe('0901234567');
    expect(normalizePhone('+84 (901) 234-567')).toBe('+84901234567');
  });

  it('turns blank and missing values into null', () => {
    expect(toCustomerInfo({ customerName: '  ', customerPhone: '', customerAddress: undefined })).toEqual({
      name: null,
      phone: null,
      address: null,
    });
  });
});

describe('resolveCustomer', () => {
  function build(existing: unknown) {
    const manager = {
      findOne: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((_e: unknown, data: unknown) => data),
      save: vi.fn(async (data: object) => ({ id: 'new', ...data })),
      transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    return manager;
  }

  it('returns null and touches nothing for empty info', async () => {
    const manager = build(null);
    await expect(
      resolveCustomer(manager as never, 'b1', { name: null, phone: null, address: null }),
    ).resolves.toBeNull();
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('reuses the customer with the same phone and fills in changed fields', async () => {
    const manager = build({ id: 'c1', name: 'An', phone: '0901234567', address: null });
    const id = await resolveCustomer(manager as never, 'b1', {
      name: 'An',
      phone: '0901234567',
      address: '1 Le Loi',
    });
    expect(id).toBe('c1');
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'c1', { address: '1 Le Loi' });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('creates a customer for an unknown phone or when there is no phone', async () => {
    const withPhone = build(null);
    await expect(
      resolveCustomer(withPhone as never, 'b1', { name: 'An', phone: '0901234567', address: null }),
    ).resolves.toBe('new');

    const noPhone = build(null);
    await expect(
      resolveCustomer(noPhone as never, 'b1', { name: 'An', phone: null, address: null }),
    ).resolves.toBe('new');
    expect(noPhone.findOne).not.toHaveBeenCalled();
  });

  it('reuses the customer inserted by a concurrent order (unique violation)', async () => {
    const manager = build(null);
    const winner = { id: 'c-winner', name: null, phone: '0901234567', address: null };
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    manager.transaction.mockRejectedValueOnce(
      new QueryFailedError('insert', [], Object.assign(new Error('dup'), { code: '23505' })),
    );
    const id = await resolveCustomer(manager as never, 'b1', {
      name: 'An',
      phone: '0901234567',
      address: null,
    });
    expect(id).toBe('c-winner');
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'c-winner', { name: 'An' });
  });

  it('rethrows other insert errors', async () => {
    const manager = build(null);
    manager.transaction.mockRejectedValueOnce(new Error('boom'));
    await expect(
      resolveCustomer(manager as never, 'b1', { name: 'An', phone: '0901234567', address: null }),
    ).rejects.toThrow('boom');
  });
});

describe('resolveCustomer concurrency', () => {
  /**
   * In-memory customers table with the (branchId, phone) unique index. Every call yields to
   * the event loop first, so two concurrent resolves both miss the lookup before either inserts.
   */
  function buildSharedStore() {
    const rows: { id: string; branchId: string; name: string | null; phone: string | null; address: string | null }[] = [];
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    const manager = {
      findOne: vi.fn(async (_entity: unknown, opts: { where: { branchId: string; phone: string } }) => {
        await tick();
        return rows.find((r) => r.branchId === opts.where.branchId && r.phone === opts.where.phone) ?? null;
      }),
      update: vi.fn(async (_entity: unknown, id: string, patch: object) => {
        Object.assign(rows.find((r) => r.id === id)!, patch);
      }),
      create: vi.fn((_entity: unknown, data: object) => data),
      save: vi.fn(async (data: { branchId: string; phone: string | null }) => {
        await tick();
        if (data.phone && rows.some((r) => r.branchId === data.branchId && r.phone === data.phone)) {
          throw new QueryFailedError('insert', [], Object.assign(new Error('duplicate key'), { code: '23505' }));
        }
        const row = { id: `c${rows.length + 1}`, name: null, address: null, ...data };
        rows.push(row);
        return row;
      }),
      transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    return { manager, rows };
  }

  it('two orders with the same new phone share one customer', async () => {
    const { manager, rows } = buildSharedStore();
    const info = (name: string) => ({ name, phone: '0901234567', address: null });

    const [first, second] = await Promise.all([
      resolveCustomer(manager as never, 'b1', info('An')),
      resolveCustomer(manager as never, 'b1', info('Binh')),
    ]);

    expect(first).toBe(second);
    expect(rows).toHaveLength(1);
    // Both lookups missed, both inserts were attempted, and the loser re-read the winner.
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.findOne).toHaveBeenCalledTimes(3);
    // The loser's different name was applied to the shared customer.
    expect(rows[0].name).toBe('Binh');
  });

  it('many concurrent orders on one new phone still create a single customer', async () => {
    const { manager, rows } = buildSharedStore();
    const ids = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        resolveCustomer(manager as never, 'b1', { name: `N${i}`, phone: '0911222333', address: null }),
      ),
    );
    expect(new Set(ids).size).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it('does not merge the same phone across branches', async () => {
    const { manager, rows } = buildSharedStore();
    const info = { name: 'An', phone: '0901234567', address: null };
    const [a, b] = await Promise.all([
      resolveCustomer(manager as never, 'b1', info),
      resolveCustomer(manager as never, 'b2', info),
    ]);
    expect(a).not.toBe(b);
    expect(rows).toHaveLength(2);
  });
});
