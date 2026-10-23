import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investment } from '../../database/entities/investment.entity.js';
import { InvestmentCategory } from '../../database/enums.js';
import { FinanceService } from './finance.service.js';
import type { InvestmentView, RoiSummary } from './finance.types.js';

const DAYS_PER_MONTH = 30;
const MS_PER_DAY = 86_400_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

interface InvestmentInput {
  name: string;
  category: InvestmentCategory;
  amount: number;
  investedOn: string;
  note?: string | null;
}

/** Capital investments (CRUD) and the shop's return on them. */
@Injectable()
export class InvestmentsService {
  constructor(
    @InjectRepository(Investment)
    private readonly investments: Repository<Investment>,
    private readonly finance: FinanceService,
  ) {}

  async list(branchId: string): Promise<InvestmentView[]> {
    const rows = await this.investments.find({
      where: { branchId },
      relations: { createdByUser: true },
      order: { investedOn: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(view);
  }

  async create(
    branchId: string,
    userId: string,
    dto: InvestmentInput,
  ): Promise<InvestmentView> {
    this.finance.assertDay(dto.investedOn);
    const saved = await this.investments.save(
      this.investments.create({
        branchId,
        name: dto.name,
        category: dto.category,
        amount: dto.amount,
        investedOn: dto.investedOn,
        note: dto.note ?? null,
        createdByUserId: userId,
      }),
    );
    return this.get(branchId, saved.id);
  }

  async update(
    branchId: string,
    id: string,
    patch: Partial<InvestmentInput>,
  ): Promise<InvestmentView> {
    const row = await this.find(branchId, id);
    if (patch.investedOn !== undefined) this.finance.assertDay(patch.investedOn);
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.investedOn !== undefined) row.investedOn = patch.investedOn;
    if (patch.note !== undefined) row.note = patch.note;
    await this.investments.save(row);
    return this.get(branchId, id);
  }

  async remove(branchId: string, id: string): Promise<void> {
    await this.investments.remove(await this.find(branchId, id));
  }

  /** ROI of the range `[from, to)` over the capital invested before `to`. */
  async roi(branchId: string, from: string, to: string): Promise<RoiSummary> {
    const [summary, all] = await Promise.all([
      this.finance.summary(branchId, from, to),
      this.list(branchId),
    ]);
    // `YYYY-MM-DD` strings compare correctly as text.
    const items = all.filter((i) => i.investedOn < to);
    const totalInvested = items.reduce((s, i) => s + i.amount, 0);
    const investedInRange = items
      .filter((i) => i.investedOn >= from)
      .reduce((s, i) => s + i.amount, 0);
    const { profit } = summary.totals;

    const days =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY;
    const monthlyProfit = (profit / days) * DAYS_PER_MONTH;

    const byCategory = new Map<InvestmentCategory, number>();
    for (const i of items) {
      byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.amount);
    }

    return {
      from,
      to,
      totalInvested,
      investedInRange,
      profit,
      roiPercent:
        totalInvested > 0 ? round1((profit / totalInvested) * 100) : null,
      paybackMonths:
        totalInvested > 0 && monthlyProfit > 0
          ? round1(totalInvested / monthlyProfit)
          : null,
      byCategory: [...byCategory]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      items: items.map((i) => ({
        ...i,
        sharePercent: round1((i.amount / totalInvested) * 100),
      })),
    };
  }

  private async get(branchId: string, id: string): Promise<InvestmentView> {
    const row = await this.investments.findOne({
      where: { id, branchId },
      relations: { createdByUser: true },
    });
    if (!row) throw new NotFoundException('Investment not found');
    return view(row);
  }

  private async find(branchId: string, id: string): Promise<Investment> {
    const row = await this.investments.findOne({ where: { id, branchId } });
    if (!row) throw new NotFoundException('Investment not found');
    return row;
  }
}

function view(row: Investment): InvestmentView {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    investedOn: row.investedOn,
    note: row.note,
    createdByName: row.createdByUser?.name ?? null,
    createdAt: row.createdAt,
  };
}
