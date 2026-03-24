export interface PortfolioPosition {
  id: number;
  isin: string | null;
  name: string;
  quantity: number;
  purchase_price: number;
  currency: string;
  created_at: string;
}
