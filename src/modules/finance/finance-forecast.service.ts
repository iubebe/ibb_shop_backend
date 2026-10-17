import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FinanceForecast,
  type ForecastPayload,
} from '../../database/entities/finance-forecast.entity.js';
import type { CreateForecastDto } from './dto/forecast.dto.js';
import { assertDay } from './finance-dates.js';
import type { ForecastTotal, ForecastView } from './finance.types.js';

/** Older runs are dropped on each push; this many stay for comparison. */
const KEEP_RUNS = 30;
const MS_PER_DAY = 86_400_000;

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const zero = (): ForecastTotal => ({ p50: 0, high: 0 });
const round = (n: number) => Math.round(n);

/** Stores the model's forecast runs and turns the latest into a summary. */
@Injectable()
export class FinanceForecastService {
  constructor(
    @InjectRepository(FinanceForecast)
    private readonly forecasts: Repository<FinanceForecast>,
  ) {}

  async create(branchId: string, dto: CreateForecastDto): Promise<ForecastView> {
    const payload = this.validate(dto);
    const saved = await this.forecasts.save(
      this.forecasts.create({
        branchId,
        generatedAt: new Date(dto.generatedAt),
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
        dataThrough: dto.dataThrough,
        horizonDays: dto.horizonDays,
        payload,
      }),
    );
    await this.prune(branchId);
    return view(saved);
  }

  async latest(branchId: string): Promise<ForecastView> {
    const row = await this.forecasts.findOne({
      where: { branchId },
      order: { generatedAt: 'DESC', createdAt: 'DESC' },
    });
    if (!row) throw new NotFoundException('No forecast has been received yet');
    return view(row);
  }

  private validate(dto: CreateForecastDto): ForecastPayload {
    assertDay(dto.dataThrough);
    const first = dayMs(dto.dataThrough) + MS_PER_DAY;
    const last = dayMs(dto.dataThrough) + dto.horizonDays * MS_PER_DAY;
    const seen = new Set<string>();
    for (const p of dto.points) {
      assertDay(p.date);
      if (dayMs(p.date) < first || dayMs(p.date) > last) {
        throw new BadRequestException(
          `${p.metric} ${p.date} is outside dataThrough+1 .. dataThrough+horizonDays`,
        );
      }
      if (
        (p.p10 !== undefined && p.p10 > p.p50) ||
        (p.p90 !== undefined && p.p90 < p.p50)
      ) {
        throw new BadRequestException(
          `${p.metric} ${p.date}: expected p10 <= p50 <= p90`,
        );
      }
      const key = `${p.metric}|${p.date}`;
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate point ${p.metric} ${p.date}`);
      }
      seen.add(key);
    }
    return {
      points: dto.points.map((p) => ({
        metric: p.metric,
        date: p.date,
        p50: p.p50,
        p10: p.p10 ?? null,
        p90: p.p90 ?? null,
      })),
      backtest: (dto.backtest ?? []).map((b) => ({
        metric: b.metric,
        samples: b.samples,
        mape: b.mape ?? null,
        baselineMape: b.baselineMape ?? null,
      })),
      commentary: dto.commentary?.trim() || null,
    };
  }

  private async prune(branchId: string): Promise<void> {
    await this.forecasts.query(
      `DELETE FROM finance_forecasts WHERE "branchId" = $1 AND id NOT IN (
         SELECT id FROM finance_forecasts WHERE "branchId" = $1
         ORDER BY "generatedAt" DESC, "createdAt" DESC LIMIT $2)`,
      [branchId, KEEP_RUNS],
    );
  }
}

/** Sums one metric over the horizon; `high` falls back to p50 without a band. */
function total(points: ForecastPayload['points'], metric: string): ForecastTotal {
  const t = zero();
  for (const p of points) {
    if (p.metric !== metric) continue;
    t.p50 += p.p50;
    t.high += p.p90 ?? p.p50;
  }
  return { p50: round(t.p50), high: round(t.high) };
}

/** `operatingCost` itself, else the sum of its per-category lines. */
function operating(points: ForecastPayload['points']): ForecastTotal {
  if (points.some((p) => p.metric === 'operatingCost')) {
    return total(points, 'operatingCost');
  }
  const t = zero();
  for (const p of points) {
    if (!p.metric.startsWith('operatingCost:')) continue;
    t.p50 += p.p50;
    t.high += p.p90 ?? p.p50;
  }
  return { p50: round(t.p50), high: round(t.high) };
}

function view(row: FinanceForecast): ForecastView {
  const { points, backtest, commentary } = row.payload;
  const revenue = total(points, 'revenue');
  const importCost = total(points, 'importCost');
  const salaryCost = total(points, 'salaryCost');
  const operatingCost = operating(points);
  const totalCost = {
    p50: importCost.p50 + salaryCost.p50 + operatingCost.p50,
    high: importCost.high + salaryCost.high + operatingCost.high,
  };
  const dates = points.map((p) => p.date).sort();
  return {
    id: row.id,
    generatedAt: row.generatedAt,
    receivedAt: row.createdAt,
    modelName: row.modelName,
    modelVersion: row.modelVersion,
    dataThrough: row.dataThrough,
    horizonDays: row.horizonDays,
    points,
    backtest,
    commentary,
    summary: {
      from: dates[0],
      to: dates[dates.length - 1],
      revenue,
      importCost,
      salaryCost,
      operatingCost,
      totalCost,
      fundNeeded: totalCost,
      expectedNet: revenue.p50 - totalCost.p50,
    },
  };
}
