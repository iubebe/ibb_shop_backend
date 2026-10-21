import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StockItemKind } from '../../../database/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Blank optional text becomes `null` (clears the field on update). */
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const MAX_QTY = 99_999_999;
const MAX_COST = 9_999_999_999;

export class CreateStockItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsEnum(StockItemKind)
  kind: StockItemKind;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QTY)
  lowStockThreshold?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  shelfLifeDays?: number | null;
}

export class UpdateStockItemDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(StockItemKind)
  kind?: StockItemKind;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QTY)
  lowStockThreshold?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  shelfLifeDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListStockItemsQuery {
  @IsOptional()
  @IsEnum(StockItemKind)
  kind?: StockItemKind;
}

export class AdjustStockDto {
  /** Signed: positive adds stock, negative removes it (waste, stocktake). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-MAX_QTY)
  @Max(MAX_QTY)
  change: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  note: string;
}

export class UpsertSupplierDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class ImportLineDto {
  @IsUUID()
  stockItemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(MAX_QTY)
  quantity: number;

  /** Cost per unit; 0 allowed (gifts / samples). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_COST)
  unitCost: number;
}

export class CreateImportDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  importedAt?: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ImportLineDto)
  lines: ImportLineDto[];
}

/** Multipart form: `lines` arrives as a JSON string next to the `image` file. */
export class CreateImportDraftDto {
  @IsOptional()
  @Transform(blankToNull)
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ImportLineDto)
  lines: ImportLineDto[];
}

/** Admin may correct the lines (e.g. unit costs) while confirming. */
export class ConfirmImportDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ImportLineDto)
  lines?: ImportLineDto[];
}

export class RejectImportDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;
}

export class ListImportsQuery {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}

export class ListMovementsQuery {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;
}
