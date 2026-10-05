import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories.service.js';

function build(opts: { found?: unknown; clash?: unknown } = {}) {
  const qb = { where: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(opts.clash ?? null) };
  const repo = {
    findOneBy: vi.fn().mockResolvedValue(opts.found ?? null),
    createQueryBuilder: vi.fn(() => qb),
    create: vi.fn((v: object) => v),
    save: vi.fn((v: object) => Promise.resolve({ id: 'c1', createdAt: new Date(0), ...v })),
    remove: vi.fn().mockResolvedValue(undefined),
    manager: { countBy: vi.fn().mockResolvedValue(3) },
  };
  return { service: new CategoriesService(repo as never), repo };
}

describe('CategoriesService', () => {
  it('creates a category in the user branch', async () => {
    const { service, repo } = build();
    await expect(service.create('b1', 'Drinks')).resolves.toMatchObject({
      name: 'Drinks',
      productCount: 0,
    });
    expect(repo.create).toHaveBeenCalledWith({ branchId: 'b1', name: 'Drinks' });
  });

  it('409s on a duplicate name (case-insensitive check)', async () => {
    const { service, repo } = build({ clash: { id: 'other' } });
    await expect(service.create('b1', 'drinks')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows renaming to the same name of itself', async () => {
    const found = { id: 'c1', name: 'Drinks', createdAt: new Date(0) };
    const { service } = build({ found, clash: { id: 'c1' } });
    await expect(service.update('b1', 'c1', { name: 'DRINKS' })).resolves.toMatchObject({
      name: 'DRINKS',
      productCount: 3,
    });
  });

  it('404s when the category is not in the branch', async () => {
    const { service } = build();
    await expect(service.update('b1', 'x', { name: 'A' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('b1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an existing category', async () => {
    const found = { id: 'c1' };
    const { service, repo } = build({ found });
    await service.remove('b1', 'c1');
    expect(repo.remove).toHaveBeenCalledWith(found);
  });
});
