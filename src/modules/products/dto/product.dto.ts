import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Empty string from a form means "no image". */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });

const MAX_PRICE = 100_000_000;
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  /** VND, whole number. */
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price?: number;

  /** `null` removes the product from its category. */
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  /** `null` or empty string removes the image. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  imageUrl?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
