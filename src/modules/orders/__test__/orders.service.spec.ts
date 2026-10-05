import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '../../../database/enums.js';
import { OrdersService } from '../orders.service.js';

function build(item: unknown) {
  const manager = {
    findOne: vi.fn().mockResolvedValue(item),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const service = new OrdersService({} as never, dataSource as never);
  return { service, manager };
}

const item = (status: OrderStatus, quantity = 2) => ({
  id: 'i1',
  quantity,
  order: { status },
});

describe('OrdersService.setServed', () => {
  it('stores the absolute served count on a confirmed order', async () => {
    const { service, manager } = build(item(OrderStatus.CONFIRMED));
    await expect(service.setServed('b1', 'o1', 'i1', 1)).resolves.toEqual({
      id: 'i1',
      quantity: 2,
      servedQuantity: 1,
    });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'i1', {
      servedQuantity: 1,
    });
  });

  it('404s when the item is not in the user branch/order', async () => {
    const { service } = build(null);
    await expect(service.setServed('b1', 'o1', 'x', 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409s unless the order is confirmed', async () => {
    const { service, manager } = build(item(OrderStatus.PENDING_CONFIRMATION));
    await expect(service.setServed('b1', 'o1', 'i1', 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('400s when served exceeds the ordered quantity', async () => {
    const { service, manager } = build(item(OrderStatus.CONFIRMED));
    await expect(service.setServed('b1', 'o1', 'i1', 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });
});
