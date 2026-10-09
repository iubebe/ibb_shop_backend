import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProductsService } from '../products.service.js';

const MEDIA = 'https://media.example.vn';
const PNG = Buffer.from('89504e470d0a1a0a00', 'hex');

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
  const s3 = {
    upload: vi.fn((key: string) => Promise.resolve({ url: `${MEDIA}/${key}` })),
    delete: vi.fn().mockResolvedValue(undefined),
    keyFromPublicUrl: (url: string) =>
      url.startsWith(`${MEDIA}/`) ? url.slice(MEDIA.length + 1) : null,
  };

  const guestService = {
    revalidateMenuCache: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new ProductsService(products as never, categories as never, s3 as never, guestService as never),
    products,
    categories,
    s3,
  };
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

  it('uploads an image under the branch prefix and deletes the replaced one', async () => {
    const found = { id: 'p1', imageUrl: `${MEDIA}/products/b1/old.jpg` };
    const { service, s3 } = build({ found });
    const res = await service.setImage('b1', 'p1', PNG);
    expect(s3.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/b1\/[0-9a-f-]{36}\.png$/),
      PNG,
      expect.objectContaining({ contentType: 'image/png' }),
    );
    expect(res.imageUrl).toMatch(/^https:\/\/media\.example\.vn\/products\/b1\/.+\.png$/);
    expect(s3.delete).toHaveBeenCalledWith('products/b1/old.jpg');
  });

  it('rejects non-image bytes and missing files before touching S3', async () => {
    const { service, s3 } = build({ found: { id: 'p1' } });
    await expect(service.setImage('b1', 'p1', Buffer.from('<html>'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setImage('b1', 'p1', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it('404s on upload for a product outside the branch', async () => {
    const { service, s3 } = build();
    await expect(service.setImage('b1', 'x', PNG)).rejects.toBeInstanceOf(NotFoundException);
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it('removes the image, leaving foreign URLs alone', async () => {
    const own = build({ found: { id: 'p1', imageUrl: `${MEDIA}/products/b1/a.png` } });
    await expect(own.service.removeImage('b1', 'p1')).resolves.toMatchObject({ imageUrl: null });
    expect(own.s3.delete).toHaveBeenCalledWith('products/b1/a.png');

    const foreign = build({ found: { id: 'p1', imageUrl: 'https://cdn.other/x.png' } });
    await foreign.service.removeImage('b1', 'p1');
    expect(foreign.s3.delete).not.toHaveBeenCalled();
  });
});
