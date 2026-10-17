import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Branch } from './branch.entity.js';

/** One forecast run pushed by the external model (see `finance_forecast_integration.md`). */
export interface ForecastPayload {
  points: {
    metric: string;
    date: string;
    p50: number;
    p10: number | null;
    p90: number | null;
  }[];
  backtest: {
    metric: string;
    samples: number;
    mape: number | null;
    baselineMape: number | null;
  }[];
  commentary: string | null;
}

@Entity('finance_forecasts')
@Index(['branchId', 'generatedAt'])
export class FinanceForecast extends BaseEntity {
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Relation<Branch>;

  /** When the model produced it (client clock). */
  @Column({ type: 'timestamptz' })
  generatedAt: Date;

  @Column({ length: 60 })
  modelName: string;

  @Column({ length: 40 })
  modelVersion: string;

  /** Last day of data the model saw, `YYYY-MM-DD`. */
  @Column({ type: 'date' })
  dataThrough: string;

  @Column({ type: 'int' })
  horizonDays: number;

  @Column({ type: 'jsonb' })
  payload: ForecastPayload;
}
