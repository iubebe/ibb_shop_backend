import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePaymentQrCodeDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;
}

export class UpdatePaymentQrCodeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
