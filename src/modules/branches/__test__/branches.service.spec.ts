import { NotFoundException } from '@nestjs/common';
import { BranchesService } from '../branches.service.js';

function build(found: unknown = { id: 'b1', name: 'Old', address: 'Addr' }, cached: unknown = null) {
  const branches = {
    findOneBy: vi.fn().mockResolvedValue(found),
    find: vi.fn().mockResolvedValue(found ? [found] : []),
    save: vi.fn((v: object) => Promise.resolve(v)),
  };
  const guest = { revalidateMenuCache: vi.fn().mockResolvedValue(undefined) };
  const redis = {
    getJson: vi.fn().mockResolvedValue(cached),
    setJson: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
  };
  return {
    service: new BranchesService(branches as never, guest as never, redis as never),
    branches,
    guest,
    redis,
  };
}

describe('BranchesService', () => {
  it('returns the caller branch', async () => {
    const { service } = build();
    await expect(service.get('b1')).resolves.toEqual({ id: 'b1', name: 'Old', address: 'Addr' });
  });

  it('renames, keeps the address when omitted, and busts the guest menu cache', async () => {
    const { service, guest } = build();
    await expect(service.update('b1', { name: 'Iubebe' })).resolves.toMatchObject({
      name: 'Iubebe',
      address: 'Addr',
    });
    expect(guest.revalidateMenuCache).toHaveBeenCalledWith('b1');
  });

  it('drops the public name cache on rename', async () => {
    const { service, redis } = build();
    await service.update('b1', { name: 'Iubebe' });
    expect(redis.del).toHaveBeenCalledWith('branch:public-name');
  });

  it('caches the public name after the first DB read', async () => {
    const { service, branches, redis } = build();
    await expect(service.getPublicName()).resolves.toEqual({ name: 'Old' });
    expect(branches.find).toHaveBeenCalledTimes(1);
    expect(redis.setJson).toHaveBeenCalledWith('branch:public-name', { name: 'Old' }, 1800);
  });

  it('serves the public name from cache without touching the DB', async () => {
    const { service, branches } = build(undefined, { name: 'Cached' });
    await expect(service.getPublicName()).resolves.toEqual({ name: 'Cached' });
    expect(branches.find).not.toHaveBeenCalled();
  });

  it('does not cache a missing branch', async () => {
    const { service, redis } = build(null);
    await expect(service.getPublicName()).rejects.toBeInstanceOf(NotFoundException);
    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('clears the address with an empty string', async () => {
    const { service } = build();
    await expect(service.update('b1', { name: 'X', address: '' })).resolves.toMatchObject({ address: null });
  });

  it('404s for an unknown branch', async () => {
    const { service } = build(null);
    await expect(service.get('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('x', { name: 'A' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
