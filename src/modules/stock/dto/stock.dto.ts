import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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
