import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../../database/enums.js';
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

function buildOrder(status: OrderStatus | null) {
  const order =
    status === null
      ? null
      : {
          id: 'o1',
          status,
          confirmedAt: null,
          paidAt: null,
          paymentMethod: null,
        };
  const manager = {
    findOne: vi.fn().mockResolvedValue(order),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const service = new OrdersService({} as never, dataSource as never);
  return { service, manager };
}

describe('OrdersService.confirm', () => {
  it('moves a pending order to confirmed and stamps confirmedAt', async () => {
    const { service, manager } = buildOrder(OrderStatus.PENDING_CONFIRMATION);
    const result = await service.confirm('b1', 'o1');
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    expect(result.confirmedAt).toBeInstanceOf(Date);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      expect.objectContaining({ status: OrderStatus.CONFIRMED }),
    );
  });

  it.each([OrderStatus.CONFIRMED, OrderStatus.PAID, OrderStatus.CANCELLED])(
    '409s when the order is %s',
    async (status) => {
      const { service, manager } = buildOrder(status);
      await expect(service.confirm('b1', 'o1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it('404s for an order outside the branch', async () => {
    const { service } = buildOrder(null);
    await expect(service.confirm('b1', 'o1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('OrdersService.cancel', () => {
  it.each([OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED])(
    'cancels a %s order',
    async (status) => {
      const { service } = buildOrder(status);
      await expect(service.cancel('b1', 'o1')).resolves.toMatchObject({
        status: OrderStatus.CANCELLED,
      });
    },
  );

  it.each([OrderStatus.PAID, OrderStatus.CANCELLED])(
    '409s when the order is %s',
    async (status) => {
      const { service, manager } = buildOrder(status);
      await expect(service.cancel('b1', 'o1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.update).not.toHaveBeenCalled();
    },
  );
});

describe('OrdersService.pay', () => {
  it('marks a confirmed order paid with the chosen method', async () => {
    const { service, manager } = buildOrder(OrderStatus.CONFIRMED);
    const result = await service.pay('b1', 'o1', PaymentMethod.CASH);
    expect(result).toMatchObject({
      status: OrderStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
    });
    expect(result.paidAt).toBeInstanceOf(Date);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
    );
  });

  it.each([
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ])('409s when the order is %s (no double payment)', async (status) => {
    const { service, manager } = buildOrder(status);
    await expect(
      service.pay('b1', 'o1', PaymentMethod.QR_MANUAL),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
