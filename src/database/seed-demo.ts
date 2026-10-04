import {
  DEMO_CATEGORIES,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TABLE_COUNT,
  demoTableToken,
} from './seed-data/demo-menu.js';
import dataSource from './data-source.js';
import { Branch } from './entities/branch.entity.js';
import { Category } from './entities/category.entity.js';
import { DiningTable } from './entities/dining-table.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { Product } from './entities/product.entity.js';
import { OrderStatus } from './enums.js';

/**
 * Idempotent demo data (run with `pnpm db:seed:demo`): categories, products,
 * tables and a few orders in the default branch. Existing rows are matched by
 * name/token and left alone, so re-running is safe. Local dev only.
 */
async function seedDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed-demo is for local development; refusing to run in production',
    );
  }

  await dataSource.initialize();
  try {
    const branches = dataSource.getRepository(Branch);
    const categories = dataSource.getRepository(Category);
    const products = dataSource.getRepository(Product);
    const tables = dataSource.getRepository(DiningTable);
    const orders = dataSource.getRepository(Order);
    const orderItems = dataSource.getRepository(OrderItem);

    const branchName = process.env.SEED_BRANCH_NAME || 'Main Branch';
    const branch =
      (await branches.findOneBy({ name: branchName })) ??
      (await branches.save(branches.create({ name: branchName })));
    const branchId = branch.id;

    // Saved one by one on purpose: createdAt orders the menu.
    const categoryIds = new Map<string, string>();
    for (const name of DEMO_CATEGORIES) {
      const row =
        (await categories.findOneBy({ branchId, name })) ??
        (await categories.save(categories.create({ branchId, name })));
      categoryIds.set(name, row.id);
    }

    const productRows = new Map<string, Product>();
    for (const demo of DEMO_PRODUCTS) {
      const row =
        (await products.findOneBy({ branchId, name: demo.name })) ??
        (await products.save(
          products.create({
            branchId,
            name: demo.name,
            price: demo.price,
            categoryId: categoryIds.get(demo.category)!,
          }),
        ));
      productRows.set(demo.name, row);
    }

    const tableRows = new Map<number, DiningTable>();
    for (let n = 1; n <= DEMO_TABLE_COUNT; n++) {
      const qrToken = demoTableToken(n);
      const row =
        (await tables.findOneBy({ qrToken })) ??
        (await tables.save(
          tables.create({ branchId, name: `Bàn ${n}`, qrToken }),
        ));
      tableRows.set(n, row);
    }

    let createdOrders = 0;
    for (const demo of DEMO_ORDERS) {
      const table = tableRows.get(demo.table)!;
      // Only seed orders for tables that have none, so re-runs don't duplicate.
      if (await orders.existsBy({ tableId: table.id })) continue;
      const lines = demo.items.map((i) => ({
        product: productRows.get(i.product)!,
        quantity: i.quantity,
      }));
      const order = await orders.save(
        orders.create({
          branchId,
          tableId: table.id,
          status: demo.status as OrderStatus,
          total: lines.reduce(
            (sum, l) => sum + l.product.price * l.quantity,
            0,
          ),
          confirmedAt: demo.status === 'confirmed' ? new Date() : null,
        }),
      );
      await orderItems.save(
        lines.map((l) =>
          orderItems.create({
            orderId: order.id,
            productId: l.product.id,
            quantity: l.quantity,
            unitPrice: l.product.price,
          }),
        ),
      );
      createdOrders++;
    }

    console.log(
      `Demo data ready in branch "${branch.name}": ${categoryIds.size} categories, ${productRows.size} products, ${tableRows.size} tables (tokens ${demoTableToken(1)}...), ${createdOrders} new orders.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

await seedDemo();
