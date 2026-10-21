import { CustomersService } from '../customers.service.js';

describe('CustomersService.findByPhone', () => {
  it('returns only the lookup fields, scoped to the branch', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue({
        id: 'c1',
        name: 'An',
        phone: '0901234567',
        address: '1 Le Loi',
        branchId: 'b1',
      }),
    };
    const service = new CustomersService(repo as never);
    await expect(service.findByPhone('b1', '0901234567')).resolves.toEqual({
      id: 'c1',
      name: 'An',
      phone: '0901234567',
      address: '1 Le Loi',
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { branchId: 'b1', phone: '0901234567' } });
  });

  it('returns null when nobody has the phone', async () => {
    const service = new CustomersService({ findOne: vi.fn().mockResolvedValue(null) } as never);
    await expect(service.findByPhone('b1', '0901234567')).resolves.toBeNull();
  });
});
