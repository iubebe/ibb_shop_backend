import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StaffSchedulesService } from '../staff-schedules.service.js';

const admin = { id: 'admin1', isAdmin: true };
const staffA = { id: 'staffA', isAdmin: false };

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    branchId: 'b1',
    weekStartDate: '2026-10-12',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    status: 'scheduled',
    proposedByUserId: null,
    ...overrides,
  };
}

function build(seed: any[] = [], byId: any = null) {
  const schedules = {
    create: vi.fn((data: unknown) => ({ id: 'new', ...(data as object) })),
    save: vi.fn(async (data: any) => data),
    find: vi.fn(async () => seed),
    findOne: vi.fn(async () => byId),
  };
  const registrations = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (data: any) => data),
    findOne: vi.fn(async () => null),
  };
  const service = new StaffSchedulesService(schedules as never, registrations as never);
  return { service, schedules, registrations };
}

describe('StaffSchedulesService.proposeShifts', () => {
  it('stores each shift as proposed and records who proposed it', async () => {
    const ctx = build();

    const created = await ctx.service.proposeShifts('b1', 'staffA', {
      weekStartDate: '2026-10-12',
      shifts: [
        { dayOfWeek: 2, startTime: '18:00', endTime: '22:00', position: 'cashier' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '22:00' },
      ],
    });

    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      branchId: 'b1',
      status: 'proposed',
      proposedByUserId: 'staffA',
      position: 'cashier',
      shiftType: null,
      assignedToUserId: 'staffA',
    });
  });

  it('assigns each proposed shift to the proposer', async () => {
    const ctx = build();
    const created = await ctx.service.proposeShifts('b1', 'staffA', {
      weekStartDate: '2026-10-12',
      shifts: [{ dayOfWeek: 4, startTime: '07:00', endTime: '11:00' }],
    });
    expect(created[0].assignedToUserId).toBe('staffA');
  });
});

describe('StaffSchedulesService visibility', () => {
  const week = [
    shift({ id: 'open', status: 'scheduled' }),
    shift({ id: 'pendingA', status: 'proposed', proposedByUserId: 'staffA' }),
    shift({ id: 'pendingB', status: 'proposed', proposedByUserId: 'staffB' }),
    shift({ id: 'rejectedB', status: 'rejected', proposedByUserId: 'staffB' }),
  ];

  it('staff see open shifts and only their own proposals', async () => {
    const ctx = build(week);
    const seen = await ctx.service.listSchedulesByWeek('b1', '2026-10-12', staffA);
    expect(seen.map((s) => s.id)).toEqual(['open', 'pendingA']);
  });

  it('admins see every shift and proposal', async () => {
    const ctx = build(week);
    const seen = await ctx.service.listSchedulesByWeek('b1', '2026-10-12', admin);
    expect(seen).toHaveLength(4);
  });

  it('404s when staff ask for another staff member\'s proposal', async () => {
    const ctx = build([], shift({ id: 'pendingB', status: 'proposed', proposedByUserId: 'staffB' }));
    await expect(ctx.service.getSchedule('b1', 'pendingB', staffA)).rejects.toThrow(NotFoundException);
  });

  it('lets the proposer open their own proposal', async () => {
    const ctx = build([], shift({ id: 'pendingA', status: 'proposed', proposedByUserId: 'staffA' }));
    await expect(ctx.service.getSchedule('b1', 'pendingA', staffA)).resolves.toMatchObject({ id: 'pendingA' });
  });

  it('keeps the behavior without a viewer (internal callers)', async () => {
    const ctx = build(week);
    expect(await ctx.service.listSchedulesByWeek('b1', '2026-10-12')).toHaveLength(4);
  });
});

describe('StaffSchedulesService review', () => {
  it('approving a proposal makes it an open shift', async () => {
    const ctx = build([], shift({ status: 'proposed', proposedByUserId: 'staffA', assignedToUserId: 'staffA' }));

    const approved = await ctx.service.approveProposal('b1', 's1', 'admin1', '  ok  ');

    expect(approved).toMatchObject({
      status: 'scheduled',
      reviewedByUserId: 'admin1',
      reviewNotes: 'ok',
    });
    expect(approved.reviewedAt).toBeInstanceOf(Date);
    expect(approved.assignedToUserId).toBe('staffA');
  });

  it('rejecting a proposal keeps it visible to the proposer with the notes', async () => {
    const ctx = build([], shift({ status: 'proposed', proposedByUserId: 'staffA' }));

    const rejected = await ctx.service.rejectProposal('b1', 's1', 'admin1', 'trùng ca khác');

    expect(rejected).toMatchObject({ status: 'rejected', reviewNotes: 'trùng ca khác', assignedToUserId: null });
  });

  it('only proposed shifts can be reviewed', async () => {
    const ctx = build([], shift({ status: 'scheduled' }));
    await expect(ctx.service.approveProposal('b1', 's1', 'admin1')).rejects.toThrow(ConflictException);
    await expect(ctx.service.rejectProposal('b1', 's1', 'admin1')).rejects.toThrow(ConflictException);
  });

  it('a proposal cannot be registered for before approval', async () => {
    const ctx = build([], shift({ status: 'proposed', proposedByUserId: 'staffA' }));
    await expect(ctx.service.registerForShift('b1', 's1', 'staffB')).rejects.toThrow(BadRequestException);
    expect(ctx.registrations.save).not.toHaveBeenCalled();
  });

  it('an approved proposal can be registered for', async () => {
    const ctx = build([], shift({ status: 'scheduled', proposedByUserId: 'staffA' }));
    await expect(ctx.service.registerForShift('b1', 's1', 'staffB')).resolves.toMatchObject({
      status: 'pending',
      staffUserId: 'staffB',
    });
  });
});
