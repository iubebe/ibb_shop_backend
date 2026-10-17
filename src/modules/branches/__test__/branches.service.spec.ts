import { NotFoundException } from '@nestjs/common';
import { BranchesService } from '../branches.service.js';

function build(found: unknown = { id: 'b1', name: 'Old', address: 'Addr' }) {
  const branches = {
    findOneBy: vi.fn().mockResolvedValue(found),
    save: vi.fn((v: object) => Promise.resolve(v)),
  };
  const guest = { revalidateMenuCache: vi.fn().mockResolvedValue(undefined) };
  return { service: new BranchesService(branches as never, guest as never), branches, guest };
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
