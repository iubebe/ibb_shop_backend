export interface CategoryView {
  id: string;
  name: string;
  /** Products currently in the category (active or not). */
  productCount: number;
  createdAt: Date;
}
