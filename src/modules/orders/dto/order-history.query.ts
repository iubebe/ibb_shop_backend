import { IsISO8601 } from 'class-validator';

/** Half-open range `[from, to)`; the client sends its local day bounds. */
export class OrderHistoryQuery {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;
}
