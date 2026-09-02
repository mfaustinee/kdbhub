export interface ArrearsRow {
  m: number;
  month: string;
  litres: number;
  price: number;
  levy: number;
  penalty: number;
  penaltyRate: number;
  compoundingFactor: number;
  amount: number;
  cf: number;
  total: number;
}

export interface ArrearsTotals {
  levy: number;
  penalty: number;
  amount: number;
  cf: number;
  total: number;
  litres: number;
}

export type PricingMode = 'general' | 'individual';

export interface CalculatorState {
  baseMonth: string;
  arrearsCount: number;
  price: number;
  pricingMode: PricingMode;
  pricesMap: Record<number, number>;
  litresMap: Record<number, number>;
  dboName: string;
  officerName: string;
  signature: string | null;
}
