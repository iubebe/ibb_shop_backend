import { IsOptional, IsUUID } from 'class-validator';

export class ListProductsQuery {
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
