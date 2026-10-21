import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../database/enums.js';
import { WriteOffService } from '../write-off.service.js';

const NOW = new Date('2026-10-21T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function row(over: Record<string, unknown>) {
  return {
    id: 'i1',
    name: 'Item',
    kind: 'material',
    unit: 'kg',
    quantity: 2,
    lastUnitCost: 10000,
    shelfLifeDays: null,
    createdAt: daysAgo(1),
    lastImportedAt: null,
    lastOutflowAt: null,
    ...over,
  };
}

function build(rows: unknown[], writeOffRepo: Record<string, unknown> = {}) {
  const dataSource = { query: vi.fn().mockResolvedValue(rows) };
  return new WriteOffService(
    dataSource as never,
    {} as never,
    writeOffRepo as never,
    {} as never,
  );
}

describe('WriteOffService.atRisk', () => {
  it('flags expired, expiring soon and stale items; ignores healthy ones', async () => {
    const service = build([
      row({ id: 'expired', shelfLifeDays: 5, lastImportedAt: daysAgo(6) }),
      row({ id: 'soon', shelfLifeDays: 5, lastImportedAt: daysAgo(3) }),
      row({ id: 'fine', shelfLifeDays: 30, lastImportedAt: daysAgo(3) }),
      row({ id: 'stale', lastImportedAt: daysAgo(20) }),
      row({ id: 'moving', lastImportedAt: daysAgo(20), lastOutflowAt: daysAgo(1) }),
    ]);
    const result = await service.atRisk('b1', NOW);
    expect(result.map((r) => r.id)).toEqual(['expired', 'soon', 'stale']);
    expect(result[0]).toMatchObject({ expired: true, value: 20000 });
    expect(result[1]).toMatchObject({ expiringSoon: true, expired: false });
    expect(result[2]).toMatchObject({ stale: true, idleDays: 20 });
  });

  it('uses the last outflow over the last import, and creation date as a fallback', async () => {
    const service = build([
      row({ id: 'old', createdAt: daysAgo(30) }),
      row({ id: 'out', lastImportedAt: daysAgo(40), lastOutflowAt: daysAgo(15) }),
    ]);
    const result = await service.atRisk('b1', NOW);
    expect(result.map((r) => [r.id, r.idleDays])).toEqual(
      expect.arrayContaining([['old', 30], ['out', 15]]),
    );
  });

  it('values unknown-cost items at 0 and sorts by value within a group', async () => {
    const service = build([
      row({ id: 'cheap', lastImportedAt: daysAgo(20), lastUnitCost: 1000 }),
      row({ id: 'nocost', lastImportedAt: daysAgo(20), lastUnitCost: null }),
      row({ id: 'dear', lastImportedAt: daysAgo(20), lastUnitCost: 50000 }),
    ]);
    const result = await service.atRisk('b1', NOW);
    expect(result.map((r) => r.id)).toEqual(['dear', 'cheap', 'nocost']);
    expect(result[2].value).toBe(0);
  });
});

describe('WriteOffService.cancel', () => {
  it('hides another staff member’s proposal', async () => {
    const service = build([], {
      findOne: vi
        .fn()
        .mockResolvedValue({ id: 'w1', status: 'pending', createdByUserId: 'u1' }),
      remove: vi.fn(),
    });
    await expect(
      service.cancel('b1', { id: 'u2', role: UserRole.STAFF } as never, 'w1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
