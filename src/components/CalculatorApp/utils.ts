import { ArrearsRow, ArrearsTotals, PricingMode } from './types';

export const DEFAULT_PRICE = 0.40;
export const DEFAULT_CF = 50;

export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

/**
 * Formats Month- Year for statutory payment due dates (e.g. "Sept- 2026", "Oct- 2026")
 */
export const formatPaymentMonthYear = (date: Date = new Date()): string => {
  const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const m = monthAbbrs[date.getMonth()];
  const y = date.getFullYear();
  return `${m}- ${y}`;
};

/**
 * Parses month string to 0-indexed month number (0 for Jan, 11 for Dec).
 */
export const parseMonthToIndex = (mStr?: string): number => {
  if (!mStr) return -1;
  const clean = mStr.trim().toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (MONTH_NAMES[i] === clean || MONTH_NAMES[i].startsWith(clean) || clean.startsWith(MONTH_NAMES[i].slice(0, 3))) {
      return i;
    }
  }
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return num - 1;
  }
  return -1;
};

/**
 * Extracts validation day of month from date string (e.g. "2026-09-02" or "02/09/2026").
 */
export const parseValidationDay = (dateStr?: string): number => {
  if (!dateStr) return new Date().getDate();
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('-');
    return parseInt(parts[2], 10) || new Date().getDate();
  }
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(trimmed)) {
    const parts = trimmed.split(/[\/-]/);
    return parseInt(parts[0], 10) || new Date().getDate();
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.getDate();
  }
  return new Date().getDate();
};

/**
 * Helper to format and subtract months according to KDB compounding sequence:
 * m=0 and m=1 are the base month (e.g. Aug-26).
 * m=2 is base-1 (Jul-26), m=3 is base-2 (Jun-26), etc.
 */
export const getMonthLabel = (baseDate: Date, arrearsIndex: number): string => {
  const d = new Date(baseDate.getTime());
  const monthsToSubtract = arrearsIndex <= 1 ? 0 : arrearsIndex - 1;
  d.setMonth(d.getMonth() - monthsToSubtract);
  
  return d.toLocaleString('default', { month: 'short' }) + '-' + d.getFullYear().toString().slice(-2);
};

/**
 * Banded CF fee calculation based on amount (Levy + Penalty)
 */
export const getBandedCF = (amount: number): number => {
  if (amount <= 0) return 0;
  if (amount < 199) return 5;
  if (amount < 300) return 10;
  if (amount < 500) return 15;
  if (amount < 700) return 20;
  if (amount < 1000) return 25;
  return 50;
};

/**
 * Computes exact arrears position (m) for a selected sale month/year relative to base month and validation date
 */
export const getArrearsMForSale = (
  saleMonth: string,
  saleYear: string | number,
  baseMonthStr: string,
  validationDateStr?: string
): { m: number; monthLabel: string; diffInMonths: number } => {
  const baseDate = new Date(baseMonthStr + '-01');
  const baseYear = baseDate.getFullYear();
  const baseMonthIndex = baseDate.getMonth(); // 0-11

  const saleMonthIdx = parseMonthToIndex(saleMonth);
  const saleYearNum = typeof saleYear === 'number' ? saleYear : parseInt(String(saleYear).trim(), 10) || baseYear;

  const validDay = parseValidationDay(validationDateStr);

  if (saleMonthIdx === -1) {
    return { m: 1, monthLabel: saleMonth || getMonthLabel(baseDate, 1), diffInMonths: 0 };
  }

  const diffInMonths = (baseYear - saleYearNum) * 12 + (baseMonthIndex - saleMonthIdx);

  const monthShort = MONTH_NAMES[saleMonthIdx].slice(0, 3);
  const formattedMonthLabel = `${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}-${String(saleYearNum).slice(-2)}`;

  if (diffInMonths === 0) {
    // Base month: m=0 if validation day 1-10, m=1 if validation day >= 11
    const m = validDay <= 10 ? 0 : 1;
    return { m, monthLabel: formattedMonthLabel, diffInMonths: 0 };
  } else if (diffInMonths > 0) {
    // Historical month prior to base month: m = diffInMonths + 1
    const m = diffInMonths + 1;
    return { m, monthLabel: formattedMonthLabel, diffInMonths };
  } else {
    // Future month after base month
    return { m: 0, monthLabel: formattedMonthLabel, diffInMonths };
  }
};

/**
 * Computes all rows from 0 to effective arrears count, mapping localSales with under-declared volume to their exact m
 */
export const computeArrearsRows = (
  baseMonth: string,
  arrearsCount: number,
  price: number,
  pricingMode: PricingMode,
  pricesMap: Record<number, number>,
  litresMap: Record<number, number>,
  localSales?: { month: string; year: string; qtyDeclared?: string; underDeclared?: string; verifiedQty?: string }[],
  validationDate?: string
): ArrearsRow[] => {
  const baseDate = new Date(baseMonth + '-01');

  // Map any local sales with under-declared volume (or volume declared) to their calculated m index
  const salesMapByM: Record<number, { litres: number; monthLabel: string }> = {};
  let maxSaleM = 0;

  if (localSales && localSales.length > 0) {
    localSales.forEach(sale => {
      if (!sale.month || sale.month.trim() === '') return;
      const underDeclNum = parseFloat(sale.underDeclared || '0');
      const qtyDeclNum = parseFloat(sale.qtyDeclared || '0');
      // If underDeclared is present (> 0), use it; else fallback to qtyDeclared
      const volume = underDeclNum > 0 ? underDeclNum : (qtyDeclNum || 0);

      const { m, monthLabel } = getArrearsMForSale(sale.month, sale.year, baseMonth, validationDate);
      salesMapByM[m] = {
        litres: volume,
        monthLabel
      };
      if (m > maxSaleM) {
        maxSaleM = m;
      }
    });
  }

  const effectiveCount = Math.max(arrearsCount, maxSaleM);
  const result: ArrearsRow[] = [];

  for (let m = 0; m <= effectiveCount; m++) {
    const saleInfo = salesMapByM[m];
    
    let monthLabel = getMonthLabel(baseDate, m);
    if (saleInfo) {
      monthLabel = saleInfo.monthLabel;
    }

    const defaultLitres = saleInfo ? saleInfo.litres : 0;
    const litres = litresMap[m] !== undefined ? litresMap[m] : defaultLitres;
    const currentPrice = pricingMode === 'individual' ? (pricesMap[m] ?? price) : price;
    const levy = Math.ceil(litres * currentPrice);
    
    let penaltyRate = 0;
    let compoundingFactor = 0;
    
    if (m === 0) {
      // Base month unpenalized (days 1-10)
      penaltyRate = 0;
      compoundingFactor = 0;
    } else if (m === 1) {
      // Base month penalized (days 11-end) or standard single month
      penaltyRate = 0.25;
      compoundingFactor = 1.0;
    } else if (m > 1) {
      // Formula: (1.25 * (1.12 ^ (m-1))) - 1
      compoundingFactor = Math.pow(1.12, m - 1);
      penaltyRate = (1.25 * compoundingFactor) - 1;
    }

    const penalty = Math.ceil(levy * penaltyRate);
    const amount = levy + penalty;
    const rowCf = litres > 0 ? getBandedCF(amount) : 0;
    const total = litres > 0 ? amount + rowCf : 0;

    result.push({
      m,
      month: monthLabel,
      litres,
      price: currentPrice,
      levy,
      penalty,
      penaltyRate,
      compoundingFactor,
      amount,
      cf: rowCf,
      total
    });
  }

  return result;
};

/**
 * Computes aggregate totals across all rows
 */
export const computeArrearsTotals = (rows: ArrearsRow[]): ArrearsTotals => {
  return rows.reduce(
    (acc, row) => ({
      levy: acc.levy + row.levy,
      penalty: acc.penalty + row.penalty,
      amount: acc.amount + row.amount,
      cf: acc.cf + row.cf,
      total: acc.total + row.total,
      litres: acc.litres + row.litres,
    }),
    { levy: 0, penalty: 0, amount: 0, cf: 0, total: 0, litres: 0 }
  );
};
