export interface ProductView {
  id: string;
  categoryId: string | null;
  name: string;
  /** VND */
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
