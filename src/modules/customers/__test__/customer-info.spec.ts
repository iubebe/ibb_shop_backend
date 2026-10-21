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
