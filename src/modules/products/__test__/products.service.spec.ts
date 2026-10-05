import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductsService } from '../products.service.js';

function build(opts: { found?: unknown; categoryExists?: boolean; removeError?: unknown } = {}) {
  const products = {
    findOneBy: vi.fn().mockResolvedValue(opts.found ?? null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((v: object) => v),
    save: vi.fn((v: object) =>
      Promise.resolve({ id: 'p1', createdAt: new Date(0), updatedAt: new Date(0), ...v }),
    ),
    remove: opts.removeError
      ? vi.fn().mockRejectedValue(opts.removeError)
      : vi.fn().mockResolvedValue(undefined),
  };
  const categories = { existsBy: vi.fn().mockResolvedValue(opts.categoryExists ?? true) };
  return { service: new ProductsService(products as never, categories as never), products, categories };
}

describe('ProductsService', () => {
  it('creates an active, uncategorized product by default', async () => {
    const { service, products } = build();
    await service.create('b1', { name: 'Tea', price: 20000 });
    expect(products.create).toHaveBeenCalledWith({
      branchId: 'b1',
      name: 'Tea',
      price: 20000,
      categoryId: null,
      imageUrl: null,
      isActive: true,
    });
  });

  it('rejects a category from another branch', async () => {
    const { service, products } = build({ categoryExists: false });
    await expect(
      service.create('b1', { name: 'Tea', price: 1, categoryId: 'c9' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.save).not.toHaveBeenCalled();
  });

  it('patches only the provided fields, null clears category and image', async () => {
    const found = { id: 'p1', name: 'Tea', price: 1, categoryId: 'c1', imageUrl: 'https://x/y.png', isActive: true };
    const { service } = build({ found });
    await expect(
      service.update('b1', 'p1', { price: 5, categoryId: null, imageUrl: null }),
    ).resolves.toMatchObject({ name: 'Tea', price: 5, categoryId: null, imageUrl: null });
  });

  it('404s for a product outside the branch', async () => {
    const { service } = build();
    await expect(service.update('b1', 'x', { price: 1 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s on delete when orders reference the product', async () => {
    const error = new QueryFailedError('DELETE', [], Object.assign(new Error('fk'), { code: '23503' }));
    const { service } = build({ found: { id: 'p1' }, removeError: error });
    await expect(service.remove('b1', 'p1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes an unused product', async () => {
    const found = { id: 'p1' };
    const { service, products } = build({ found });
    await service.remove('b1', 'p1');
    expect(products.remove).toHaveBeenCalledWith(found);
  });
});
