import { IsInt, Max, Min } from 'class-validator';

export class UpdateServedDto {
  /** Absolute count delivered so far (0..quantity); setting it again is a no-op. */
  @IsInt()
  @Min(0)
  @Max(99)
  servedQuantity: number;
}
