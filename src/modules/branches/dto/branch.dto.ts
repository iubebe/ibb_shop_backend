import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateBranchDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** Empty string clears the address. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string;
}
