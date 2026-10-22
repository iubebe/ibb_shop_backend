import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { WifiSecurity } from '../../../database/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Shared by create and password rotation: the QR can only be rebuilt from the full credentials. */
export class WifiCredentialsDto {
  /** Up to 32 bytes per 802.11; the byte length is checked in the service. */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  ssid: string;

  @IsEnum(WifiSecurity)
  security: WifiSecurity;

  /** Not trimmed (spaces can be part of a password). WPA: 8-63 chars; WEP: 5/13 chars; omitted for open networks. */
  @ValidateIf((o: WifiCredentialsDto) => o.security !== WifiSecurity.OPEN)
  @IsString()
  @MinLength(5)
  @MaxLength(63)
  password?: string;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

export class UpdateWifiDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
