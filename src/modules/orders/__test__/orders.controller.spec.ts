import { OrderStatus } from '../../../database/enums.js';
import type { AuthUser } from '../../../auth/auth.types.js';
import type { CreateOrderStaffDto } from '../dto/create-order-staff.dto.js';
import { OrdersController } from '../orders.controller.js';

describe('OrdersController', () => {
  describe('create', () => {
    it('calls OrdersService.createOrder with user branchId and id', async () => {
      const mockCreateOrder = vi.fn().mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PENDING_CONFIRMATION,
        tableId: 't1',
        tableName: 'Table 1',
        total: 30000,
        createdAt: new Date(),
        confirmedAt: null,
        items: [],
      });

      const mockService = {
        createOrder: mockCreateOrder,
        list: vi.fn(),
        setServed: vi.fn(),
      };

      const controller = new OrdersController(mockService as never);

      const user: AuthUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'staff',
        branchId: 'branch-456',
        mustChangePassword: false,
      };

      const dto: CreateOrderStaffDto = {
        tableId: 't1',
        items: [
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 1 },
        ],
      };

      const result = await controller.create(user, dto);

      expect(mockCreateOrder).toHaveBeenCalledWith('branch-456', 'user-123', dto);
      expect(result).toEqual(expect.objectContaining({
        id: 'o1',
        status: OrderStatus.PENDING_CONFIRMATION,
        tableId: 't1',
      }));
    });

    it('returns the created order from the service', async () => {
      const mockOrder = {
        id: 'o1',
        status: OrderStatus.PENDING_CONFIRMATION,
        tableId: 't1',
        tableName: 'Table 1',
        total: 30000,
        createdAt: new Date('2026-10-08'),
        confirmedAt: null,
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Product 1',
            quantity: 2,
            servedQuantity: 0,
            notes: null,
          },
        ],
      };

      const mockService = {
        createOrder: vi.fn().mockResolvedValue(mockOrder),
        list: vi.fn(),
        setServed: vi.fn(),
      };

      const controller = new OrdersController(mockService as never);

      const user: AuthUser = {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
        branchId: 'branch-789',
        mustChangePassword: false,
      };

      const dto: CreateOrderStaffDto = {
        tableId: 't1',
        items: [{ productId: 'p1', quantity: 2 }],
      };

      const result = await controller.create(user, dto);

      expect(result).toEqual(mockOrder);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Product 1');
    });

    it('passes through service errors', async () => {
      const mockService = {
        createOrder: vi
          .fn()
          .mockRejectedValue(new Error('Table not found')),
        list: vi.fn(),
        setServed: vi.fn(),
      };

      const controller = new OrdersController(mockService as never);

      const user: AuthUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'staff',
        branchId: 'branch-123',
        mustChangePassword: false,
      };

      const dto: CreateOrderStaffDto = {
        tableId: 'invalid',
        items: [{ productId: 'p1', quantity: 1 }],
      };

      await expect(controller.create(user, dto)).rejects.toThrow('Table not found');
    });

    it('works with both admin and staff roles', async () => {
      const mockService = {
        createOrder: vi.fn().mockResolvedValue({
          id: 'o1',
          status: OrderStatus.PENDING_CONFIRMATION,
          tableId: 't1',
          tableName: 'Table 1',
          total: 10000,
          createdAt: new Date(),
          confirmedAt: null,
          items: [],
        }),
        list: vi.fn(),
        setServed: vi.fn(),
      };

      const controller = new OrdersController(mockService as never);

      const adminUser: AuthUser = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        branchId: 'branch-123',
        mustChangePassword: false,
      };

      const staffUser: AuthUser = {
        id: 'staff-123',
        name: 'Staff User',
        email: 'staff@example.com',
        role: 'staff',
        branchId: 'branch-123',
        mustChangePassword: false,
      };

      const dto: CreateOrderStaffDto = {
        tableId: 't1',
        items: [{ productId: 'p1', quantity: 1 }],
      };

      const adminResult = await controller.create(adminUser, dto);
      const staffResult = await controller.create(staffUser, dto);

      expect(adminResult).toBeDefined();
      expect(staffResult).toBeDefined();
      expect(mockService.createOrder).toHaveBeenCalledTimes(2);
    });
  });
});
