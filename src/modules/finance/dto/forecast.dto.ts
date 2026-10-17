import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date in YYYY-MM-DD format';
/** `operatingCost:<category>` is the operating line split by expense category. */
export const FORECAST_METRIC =
  /^(revenue|importCost|salaryCost|operatingCost(:(rent|electricity|water|internet|gas|maintenance|marketing|other))?)$/;
const METRIC_MESSAGE =
  'metric must be revenue, importCost, salaryCost, operatingCost or operatingCost:<category>';

export const MAX_FORECAST_HORIZON_DAYS = 60;
const MAX_VALUE = 99_999_999_999;

export class ForecastPointDto {
  @Matches(FORECAST_METRIC, { message: METRIC_MESSAGE })
  metric: string;

  @Matches(DAY, { message: DAY_MESSAGE })
  date: string;

  /** Median prediction, VND. */
  @IsNumber()
  @Min(0)
  @Max(MAX_VALUE)
  p50: number;

  /** Low / high band (e.g. 10th / 90th percentile). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_VALUE)
  p10?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_VALUE)
  p90?: number;
}

export class ForecastBacktestDto {
  @Matches(FORECAST_METRIC, { message: METRIC_MESSAGE })
  metric: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  samples: number;

  /** Mean absolute percentage error of the model, 0.12 = 12%. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  mape?: number;

  /** Same error for the naive baseline, to prove the model is worth keeping. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  baselineMape?: number;
}

export class CreateForecastDto {
  @IsDateString()
  generatedAt: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  modelName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  modelVersion: string;

  /** Last day of data the model used. */
  @Matches(DAY, { message: DAY_MESSAGE })
  dataThrough: string;

  @IsInt()
  @Min(1)
  @Max(MAX_FORECAST_HORIZON_DAYS)
  horizonDays: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ForecastPointDto)
  points: ForecastPointDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ForecastBacktestDto)
  backtest?: ForecastBacktestDto[];

  /** Free text written by the local LLM; shown to the admin as-is. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  commentary?: string;
}

/** `[from, to)` days for the export. */
export class ExportQuery {
  @Matches(DAY, { message: DAY_MESSAGE })
  from: string;

  @Matches(DAY, { message: DAY_MESSAGE })
  to: string;
}
