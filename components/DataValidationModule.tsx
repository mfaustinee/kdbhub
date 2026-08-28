import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import { supabase, viewPdf as sharedViewPdf, resolvePdfUrl } from './lib/supabase';
import { DBService } from '../services/db';
import { PreviousValidationsTracker } from './PreviousValidationsTracker';
import { LicensedClient, ClientReturn, DataValidation, ValidationDraft, formatDateToDDMMYYYY, formatPermitNumber, clampYear, AuthoritySignature } from '../types';
import { 
  ClipboardCheck, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  FileText,
  ChevronRight,
  ChevronLeft,
  Save,
  Trash2,
  PenTool,
  Image as ImageIcon,
  History,
  Info,
  Edit2,
  Building2,
  RotateCcw,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Store,
  GitBranch,
  FolderOpen,
  Search,
  X,
  Plus,
  RefreshCw,
  Check,
  Upload
} from 'lucide-react';

// Replace this with your actual Supabase public URL
const KDB_LOGO_URL = "https://odolazcniphinupgyaqo.supabase.co/storage/v1/object/sign/Pdf%20logo/KDB-LOGOx100h.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zNDNkNjNiOC1jY2RlLTQwYTgtOGVmMS1lN2UyY2NjNzQ0NjUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJQZGYgbG9nby9LREItTE9HT3gxMDBoLnBuZyIsImlhdCI6MTc3NDQwODY3MywiZXhwIjoyMDg5NzY4NjczfQ.r_8Gre72kWfCNdIGpiNEePogU0ieuPOJYqAyvqJ7YsQ";

let cachedLogoImage: HTMLImageElement | null = null;
let logoFetchPromise: Promise<HTMLImageElement | null> | null = null;

const getCachedLogo = async (): Promise<HTMLImageElement | null> => {
  if (cachedLogoImage) return cachedLogoImage;
  if (logoFetchPromise) return logoFetchPromise;

  logoFetchPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timer = setTimeout(() => {
      resolve(null); // Fast 1.2s timeout so PDF generation never hangs
    }, 1200);

    img.onload = () => {
      clearTimeout(timer);
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = KDB_LOGO_URL;
  });

  return logoFetchPromise;
};

// Start preloading logo immediately
if (typeof window !== 'undefined') {
  getCachedLogo();
}

interface IntakeEntry {
  month: string;
  year: string;
  quantity: string;
  farmerPrice: string;
  processor: string;
  processorPrice: string;
  avgVolPerDay: string;
}

interface SalesEntry {
  month: string;
  year: string;
  qtyDeclared: string;
  verifiedQty: string;
  projectedQty: string;
  underDeclared: string;
  buyingPrice: string;
  sellingPrice: string;
  avgVolPerDay: string;
}

interface NonComplianceEntry {
  month: string;
  litres: string;
  amount: string;
  paymentMonthYear: string;
  mpesaRef: string;
}

interface OutletEntry {
  location: string;
  volPerDay: string;
  permitStatus: 'Valid' | 'Expired' | 'None';
  levyInfo: string;
}

interface DistributorEntry {
  name: string;
  contacts: string;
  volPerDay: string;
  permitNo: string;
  areaOfSale: string;
  outlets: OutletEntry[];
  natureOfProduce: string[];
  prices: Record<string, string>;
}

interface FormData {
  branch: string;
  date: string;
  startTime: string;
  endTime: string;
  permitNo: string;
  expiryDate: string;
  dboName: string;
  premiseName: string;
  category: string;
  contacts: string;
  validationPeriod: string;
  location: string;
  county: string;
  // Table Data (Now part of sales)
  traceability: string;
  natureOfProduce: string[];
  source: string;
  complianceOfficer: string;
  complianceSignature: string; // Base64
  confirmationName: string;
  dboSignature: string; // Base64
  dboStamp: string; // Base64
  designation: string;
  hasLocalSales: boolean;
  // Dynamic sections
  intakes: IntakeEntry[];
  sales: SalesEntry[];
  nonCompliance: NonComplianceEntry[];
  comments: string;
  // Distribution Details (Mini Dairy & Cottage Industry)
  distName: string;
  distContacts: string;
  distVolPerDay: string;
  distPermitNo: string;
  distAreaOfSale: string;
  distOutlets: OutletEntry[];
  distNatureOfProduce: string[];
  distPrice: string;
  distributors: DistributorEntry[];
}

const parseSellingPrices = (sellingPriceStr: string): Record<string, string> => {
  const prices: Record<string, string> = {};
  if (!sellingPriceStr) return prices;
  
  try {
    const parsed = JSON.parse(sellingPriceStr);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    // Ignore JSON error
  }

  const parts = sellingPriceStr.split(/[|,]/);
  parts.forEach(part => {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const product = part.substring(0, colonIdx).trim();
      const price = part.substring(colonIdx + 1).trim();
      if (product) {
        prices[product] = price;
      }
    }
  });
  return prices;
};

const formatSellingPrices = (prices: Record<string, string>): string => {
  return Object.entries(prices)
    .filter(([_, val]) => val !== undefined && val !== '')
    .map(([prod, val]) => `${prod}: ${val}`)
    .join(' | ');
};

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const isClosedStatus = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s === 'closed' ||
    s === 'closed down' ||
    s === 'closeddown' ||
    s === 'cessation' ||
    s === 'ceased' ||
    s === 'inactive' ||
    s === 'non-operational' ||
    s === 'non operational' ||
    s.includes('close') ||
    s.includes('ceas')
  );
};

const getCategoryShortCode = (cat: string): string => {
  if (!cat) return '';
  const s = cat.toLowerCase().trim();
  if (s.includes('cooling plant') || s.includes('coolingplant') || s.includes('cp>') || s.includes('cp<') || s.includes('cp ')) return 'coolingplant';
  if (s.includes('importer') || s.includes('imp')) return 'importer';
  if (s.includes('distributor') || s.includes('dist')) return 'distributor';
  if (s.includes('contractor') || s.includes('cont')) return 'contractor';
  if (s.includes('manufacturer') || s.includes('mfr')) return 'manufacturer';
  return s.replace(/[^a-z0-9]/g, '');
};

const formatToYYYYMMDD = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === 'not filed' || trimmed.toLowerCase() === 'n/a') return '';

  let day = '01';
  let month = '01';
  let yearNum = new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('T')[0].split('-');
    yearNum = parseInt(parts[0], 10);
    month = parts[1].padStart(2, '0');
    day = parts[2].padStart(2, '0');
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    yearNum = parseInt(parts[2], 10);
  } else if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    yearNum = parseInt(parts[2], 10);
  } else {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      day = String(parsed.getDate()).padStart(2, '0');
      month = String(parsed.getMonth() + 1).padStart(2, '0');
      yearNum = parsed.getFullYear();
    } else {
      return '';
    }
  }

  const clampedYear = clampYear(yearNum);
  return `${clampedYear}-${month}-${day}`;
};

const normStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const MONTH_MAP: Record<string, string> = {
  jan: 'january', january: 'january', '1': 'january', '01': 'january',
  feb: 'february', february: 'february', '2': 'february', '02': 'february',
  mar: 'march', march: 'march', '3': 'march', '03': 'march',
  apr: 'april', april: 'april', '4': 'april', '04': 'april',
  may: 'may', '5': 'may', '05': 'may',
  jun: 'june', june: 'june', '6': 'june', '06': 'june',
  jul: 'july', july: 'july', '7': 'july', '07': 'july',
  aug: 'august', august: 'august', '8': 'august', '08': 'august',
  sep: 'september', sept: 'september', september: 'september', '9': 'september', '09': 'september',
  oct: 'october', october: 'october', '10': 'october',
  nov: 'november', november: 'november', '11': 'november',
  dec: 'december', december: 'december', '12': 'december'
};

export const toSentenceCase = (str?: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const normMonth = (m?: string | number) => {
  if (!m) return '';
  const str = m.toString().toLowerCase().trim();
  const firstToken = str.split(/[\s_\-/]+/)[0];
  return MONTH_MAP[firstToken] || MONTH_MAP[str] || str;
};

export function getNextValidationMonth(latestPeriod?: string): string | null {
  if (!latestPeriod) return null;
  const clean = latestPeriod.trim();
  if (!clean) return null;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthAbbrs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Extract year if present
  const yearMatch = clean.match(/\b(20\d\d)\b/);
  let year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  if (isNaN(year)) {
    year = new Date().getFullYear();
  }

  // Find month index
  let monthIndex = -1;
  const lower = clean.toLowerCase();
  for (let i = 0; i < 12; i++) {
    const mName = months[i].toLowerCase();
    const mAbbr = monthAbbrs[i];
    const regex = new RegExp(`\\b(${mName}|${mAbbr})\\b`, 'i');
    if (regex.test(clean) || lower.includes(mName)) {
      monthIndex = i;
      break;
    }
  }

  if (monthIndex === -1) {
    const tokens = clean.split(/[\s_\-/,]+/);
    for (const tok of tokens) {
      const tNorm = tok.toLowerCase().trim();
      const idx = months.findIndex(m => m.toLowerCase() === tNorm || m.toLowerCase().startsWith(tNorm));
      if (idx !== -1 && tNorm.length >= 3) {
        monthIndex = idx;
        break;
      }
    }
  }

  if (monthIndex !== -1) {
    let nextMonthIndex = monthIndex + 1;
    let nextYear = isNaN(year) ? new Date().getFullYear() : year;
    if (nextMonthIndex > 11) {
      nextMonthIndex = 0;
      nextYear += 1;
    }
    return `${months[nextMonthIndex]} ${nextYear}`;
  }

  return null;
}

// Helper to determine the latest operational month from a historical validation record
// Guided by the last entered month of local sales where local sales exist, or total intakes where local sales do not exist.
const getLatestOperationalMonthFromRecord = (raw: any, fallbackPeriod: string = ''): string => {
  if (!raw) return fallbackPeriod;

  // 1. If hasLocalSales is true (or sales entries exist with data), check sales entries
  const sales = Array.isArray(raw.sales) ? raw.sales : [];
  const hasLocalSales = raw.hasLocalSales !== undefined ? !!raw.hasLocalSales : sales.length > 0;

  if (hasLocalSales && sales.length > 0) {
    const validSales = sales.filter((s: any) => s && s.month && String(s.month).trim() !== '');
    if (validSales.length > 0) {
      // Find the latest sale entry chronologically
      let bestSale = validSales[validSales.length - 1];
      let bestTimestamp = -1;

      validSales.forEach((s: any) => {
        const periodStr = `${s.month} ${s.year || ''}`.trim();
        const ts = getPeriodTimestamp(periodStr);
        if (ts >= bestTimestamp) {
          bestTimestamp = ts;
          bestSale = s;
        }
      });

      if (bestSale && bestSale.month) {
        return `${bestSale.month} ${bestSale.year || ''}`.trim();
      }
    }
  }

  // 2. If local sales do not exist (or no valid sales entries), check intakes entries
  const intakes = Array.isArray(raw.intakes) ? raw.intakes : [];
  if (intakes.length > 0) {
    const validIntakes = intakes.filter((i: any) => i && i.month && String(i.month).trim() !== '');
    if (validIntakes.length > 0) {
      let bestIntake = validIntakes[validIntakes.length - 1];
      let bestTimestamp = -1;

      validIntakes.forEach((i: any) => {
        const periodStr = `${i.month} ${i.year || ''}`.trim();
        const ts = getPeriodTimestamp(periodStr);
        if (ts >= bestTimestamp) {
          bestTimestamp = ts;
          bestIntake = i;
        }
      });

      if (bestIntake && bestIntake.month) {
        return `${bestIntake.month} ${bestIntake.year || ''}`.trim();
      }
    }
  }

  // 3. Fallback to validationPeriod or period
  return fallbackPeriod || raw.validationPeriod || raw.period || '';
};

const getNextMonthToValidate = (latestPeriodOrRecord: any): string | null => {
  if (!latestPeriodOrRecord) return null;
  if (typeof latestPeriodOrRecord === 'string') {
    return getNextValidationMonth(latestPeriodOrRecord);
  }
  // If an object with rawData is passed
  const targetPeriod = getLatestOperationalMonthFromRecord(latestPeriodOrRecord.rawData || latestPeriodOrRecord, latestPeriodOrRecord.fullPeriod || latestPeriodOrRecord.displayString || '');
  return getNextValidationMonth(targetPeriod);
};

const getPeriodTimestamp = (periodStr: string, fallbackDate?: string): number => {
  if (periodStr) {
    const clean = periodStr.trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      const month = parts[0];
      const year = parts[parts.length - 1];
      const parsed = new Date(`${month} 1, ${year}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }
    const parsed = new Date(`${clean} 1`);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
    const yearMatch = clean.match(/\b(20\d\d)\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10) * 10000;
    }
  }
  if (fallbackDate) {
    const t = new Date(fallbackDate).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

const cleanPermitNumber = (s?: string) => (s || '').toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');

const parsePeriodMonthYear = (periodStr?: string | number, yearVal?: string | number): { month: string; year: number } => {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const abbrs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let resMonth = '';
  let resYear = 0;

  if (yearVal !== undefined && yearVal !== null && yearVal !== '') {
    const yNum = Number(String(yearVal).replace(/[^0-9]/g, ''));
    if (!isNaN(yNum) && yNum >= 1980 && yNum <= 2050) {
      resYear = yNum;
    }
  }

  if (periodStr !== undefined && periodStr !== null) {
    const raw = String(periodStr).trim();
    
    // Check if period contains 4-digit year if year was not set
    if (!resYear) {
      const yMatch = raw.match(/\b(19\d\d|20\d\d)\b/);
      if (yMatch) {
        resYear = parseInt(yMatch[1], 10);
      }
    }

    // Check if period is ISO or date format e.g. 2026-01 or 01/2026 or 15/01/2026
    const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})/);
    if (isoMatch) {
      if (!resYear) resYear = parseInt(isoMatch[1], 10);
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) resMonth = months[mIdx];
    }

    const slashMatch = raw.match(/^(\d{1,2})[-/](\d{4})/);
    if (slashMatch) {
      if (!resYear) resYear = parseInt(slashMatch[2], 10);
      const mIdx = parseInt(slashMatch[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) resMonth = months[mIdx];
    }

    if (!resMonth) {
      const lower = raw.toLowerCase();
      // Check full month names
      for (let i = 0; i < 12; i++) {
        if (lower.includes(months[i])) {
          resMonth = months[i];
          break;
        }
      }
      // Check abbreviations
      if (!resMonth) {
        for (let i = 0; i < 12; i++) {
          const reg = new RegExp(`\\b${abbrs[i]}\\b`, 'i');
          if (reg.test(lower) || lower.startsWith(abbrs[i])) {
            resMonth = months[i];
            break;
          }
        }
      }
      // Check numeric 1-12
      if (!resMonth) {
        const numOnly = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numOnly) && numOnly >= 1 && numOnly <= 12) {
          resMonth = months[numOnly - 1];
        }
      }
    }
  }

  return { month: resMonth, year: resYear };
};

const findMatchingReturn = (
  saleMonth: string,
  saleYear: string,
  dboName: string,
  premiseName: string,
  permitNo: string,
  client: LicensedClient | null,
  returnsList: ClientReturn[]
): ClientReturn | undefined => {
  if (!returnsList || returnsList.length === 0) return undefined;

  const targetPeriod = parsePeriodMonthYear(saleMonth, saleYear);
  if (!targetPeriod.month || !targetPeriod.year) return undefined;

  // Filter returns matching the exact period month and year first
  const periodMatchingReturns = returnsList.filter(r => {
    const rPeriod = parsePeriodMonthYear(r.period, r.year);
    return rPeriod.month === targetPeriod.month && rPeriod.year === targetPeriod.year;
  });

  if (periodMatchingReturns.length === 0) return undefined;

  // Extract client identity signatures
  const dboNorm = normStr(dboName);
  const premiseNorm = normStr(premiseName);
  const permitClean = cleanPermitNumber(permitNo);
  const clientNameNorm = normStr(client?.clientName);
  const clientPremiseNorm = normStr(client?.premiseName);
  const clientPermitClean = cleanPermitNumber(client?.permitNumber);
  const clientIdClean = cleanPermitNumber(client?.id);

  // Branch permits & premise names
  const branchPermitsClean = (client?.branches || []).map(b => cleanPermitNumber(b.permitNumber || b.id)).filter(Boolean);
  const branchPremisesNorm = (client?.branches || []).map(b => normStr(b.premiseName)).filter(Boolean);

  // 1. Tier 1: Highest Priority — Exact Permit / Client ID Match
  if (permitClean || clientPermitClean || clientIdClean || branchPermitsClean.length > 0) {
    const permitMatch = periodMatchingReturns.find(r => {
      const rIdClean = cleanPermitNumber(r.clientId);
      if (!rIdClean) return false;
      return (
        (permitClean && rIdClean === permitClean) ||
        (clientPermitClean && rIdClean === clientPermitClean) ||
        (clientIdClean && rIdClean === clientIdClean) ||
        branchPermitsClean.includes(rIdClean)
      );
    });
    if (permitMatch) return permitMatch;
  }

  // 2. Tier 2: Exact DBO / Client Name Match
  if (dboNorm || clientNameNorm) {
    const nameMatch = periodMatchingReturns.find(r => {
      const rClientNorm = normStr(r.clientName);
      if (!rClientNorm) return false;
      return (
        (dboNorm && rClientNorm === dboNorm) ||
        (clientNameNorm && rClientNorm === clientNameNorm)
      );
    });
    if (nameMatch) return nameMatch;
  }

  // 3. Tier 3: Exact Premise / Branch Premise Name Match
  if (premiseNorm || clientPremiseNorm || branchPremisesNorm.length > 0) {
    const premiseMatch = periodMatchingReturns.find(r => {
      const rClientNorm = normStr(r.clientName);
      if (!rClientNorm) return false;
      return (
        (premiseNorm && rClientNorm === premiseNorm) ||
        (clientPremiseNorm && rClientNorm === clientPremiseNorm) ||
        branchPremisesNorm.includes(rClientNorm)
      );
    });
    if (premiseMatch) return premiseMatch;
  }

  // 4. Tier 4: Distinctive Stem Match (ignoring generic entity words like LTD, COOPERATIVE, etc.)
  const stripSuffixes = (s: string) => s.replace(/(limited|ltd|cooperative|coop|society|group|enterprises|plant|depot|station|dairy|dairies|bar|milk)/g, '').trim();
  const dboStem = stripSuffixes(dboNorm || clientNameNorm);
  if (dboStem && dboStem.length >= 5) {
    const stemMatches = periodMatchingReturns.filter(r => {
      const rClientNorm = normStr(r.clientName);
      const rStem = stripSuffixes(rClientNorm);
      return rStem && rStem.length >= 5 && rStem === dboStem;
    });
    if (stemMatches.length === 1) return stemMatches[0];
  }

  return undefined;
};

const initialData: FormData = {
  branch: 'Kericho',
  date: getLocalDate(),
  startTime: '',
  endTime: '',
  permitNo: '',
  expiryDate: '',
  dboName: '',
  premiseName: '',
  category: '',
  contacts: '',
  validationPeriod: '',
  location: '',
  county: 'Kericho',
  traceability: 'Yes',
  natureOfProduce: [],
  source: '',
  complianceOfficer: '',
  complianceSignature: '',
  confirmationName: '',
  dboSignature: '',
  dboStamp: '',
  designation: '',
  hasLocalSales: true,
  intakes: [{ month: new Date().toLocaleString('default', { month: 'long' }), year: new Date().getFullYear().toString(), quantity: '', farmerPrice: '', processor: '', processorPrice: '', avgVolPerDay: '' }],
  sales: [{ 
    month: new Date().toLocaleString('default', { month: 'long' }), 
    year: new Date().getFullYear().toString(),
    qtyDeclared: '', 
    verifiedQty: '', 
    projectedQty: '', 
    underDeclared: '0', 
    buyingPrice: '', 
    sellingPrice: '', 
    avgVolPerDay: '' 
  }],
  nonCompliance: [],
  comments: '',
  distName: '',
  distContacts: '',
  distVolPerDay: '',
  distPermitNo: '',
  distAreaOfSale: '',
  distOutlets: [{ location: '', volPerDay: '', permitStatus: 'None', levyInfo: 'Does not Qualify' }],
  distNatureOfProduce: [],
  distPrice: '',
  distributors: [{
    name: '',
    contacts: '',
    volPerDay: '',
    permitNo: '',
    areaOfSale: '',
    outlets: [{ location: '', volPerDay: '', permitStatus: 'None', levyInfo: 'Does not Qualify' }],
    natureOfProduce: [],
    prices: {}
  }]
};

const getMirroredSellingPrice = (product: string, sales: SalesEntry[]): string => {
  if (!sales || sales.length === 0) return '';
  const lastSale = sales[sales.length - 1];
  if (lastSale && lastSale.sellingPrice) {
    const prices = parseSellingPrices(lastSale.sellingPrice);
    if (prices[product]) {
      return prices[product];
    }
  }
  for (let i = sales.length - 1; i >= 0; i--) {
    const prices = parseSellingPrices(sales[i].sellingPrice || '');
    if (prices[product]) {
      return prices[product];
    }
  }
  return '';
};

export function DataValidationModule() {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [clients, setClients] = useState<LicensedClient[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LicensedClient | null>(null);
  const [validationPremiseMode, setValidationPremiseMode] = useState<string>('main');
  const [dboHasBranches, setDboHasBranches] = useState<boolean | null>(null);

  // Unified branch facility detection: branch premise selected or new branch being created
  const isBranchFacility = Boolean(
    (dboHasBranches === true && (
      validationPremiseMode.startsWith('branch-') ||
      validationPremiseMode === 'new'
    )) ||
    validationPremiseMode.startsWith('branch-') ||
    validationPremiseMode === 'new'
  );

  const [mismatchFields, setMismatchFields] = useState<{
    key: string;
    label: string;
    validationVal: string;
    clientVal: string;
    selectedVal?: 'validation' | 'client';
  }[]>([]);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationResolved, setReconciliationResolved] = useState(true);
  const [returnsData, setReturnsData] = useState<ClientReturn[]>([]);

  const [isConnected, setIsConnected] = useState(true); // Default to true for Service Account mode
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [step, setStep] = useState(0);

  // Scroll to top of the page smoothly whenever the user changes step (next / back)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [step]);

  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [lastCollections, setLastCollections] = useState<{
    month: string;
    year: string;
    date: string;
    fullPeriod: string;
    displayString: string;
    matchedPremise?: string;
    matchedPermit?: string;
    matchedLocation?: string;
    matchedBranch?: string;
    isBranchFacility?: boolean;
    pdfPath?: string;
    rawData?: any;
  }[]>([]);
  const [historyFilterMode, setHistoryFilterMode] = useState<'all' | 'branch' | 'main'>('all');
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Section-level default buying (universal) and selling prices for selected products to auto-populate added months
  const [defaultProductPrices, setDefaultProductPrices] = useState<{
    buyingPrice: string;
    sellingPrices: Record<string, string>;
  }>({
    buyingPrice: '',
    sellingPrices: {}
  });
  
  const [lastDboRecords, setLastDboRecords] = useState<any[]>([]);
  const [isCheckingDbo, setIsCheckingDbo] = useState(false);
  const [dboError, setDboError] = useState<string | null>(null);

  const [distributorRecords, setDistributorRecords] = useState<Record<number, any[]>>({});
  const [isCheckingDist, setIsCheckingDist] = useState<Record<number, boolean>>({});
  const [declarations, setDeclarations] = useState({
    accurate: false,
    offense: false,
    awareness: false
  });

  const [isValidationPeriodEdited, setIsValidationPeriodEdited] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{
    clientOrDbo?: string;
    premise?: string;
    period?: string;
    step?: number;
    savedTime?: string;
  } | null>(null);
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const isRestoringRef = useRef(false);
  const [failedFields, setFailedFields] = useState<string[]>([]);
  const [isAmendment, setIsAmendment] = useState(false);
  const [hasAutofilledDbo, setHasAutofilledDbo] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftsList, setDraftsList] = useState<ValidationDraft[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');

  // Authority signatures state & modal management
  const [authoritySignatures, setAuthoritySignatures] = useState<AuthoritySignature[]>([]);
  const [showAddAuthorityModal, setShowAddAuthorityModal] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerTitle, setNewOfficerTitle] = useState('');
  const [newSigPreview, setNewSigPreview] = useState<string>('');
  const [newSigMode, setNewSigMode] = useState<'upload' | 'draw'>('upload');
  const [isSavingNewSig, setIsSavingNewSig] = useState(false);
  const authSigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [isSelectingAuthoritySig, setIsSelectingAuthoritySig] = useState(false);
  const [isReorderingSignatures, setIsReorderingSignatures] = useState(false);

  // Load and listen for authority signatures updates
  useEffect(() => {
    let isCancelled = false;
    const loadAuthoritySignatures = async () => {
      try {
        const sigs = await DBService.getAuthoritySignatures();
        if (!isCancelled) {
          setAuthoritySignatures(sigs);
        }
      } catch (err) {
        console.warn('Error loading authority signatures:', err);
      }
    };
    loadAuthoritySignatures();

    const handleSigUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setAuthoritySignatures(e.detail);
      } else {
        loadAuthoritySignatures();
      }
    };
    window.addEventListener('kdb_authority_signatures_updated', handleSigUpdate);
    return () => {
      isCancelled = true;
      window.removeEventListener('kdb_authority_signatures_updated', handleSigUpdate);
    };
  }, []);

  const [globalUnit, setGlobalUnit] = useState<'L' | 'Kg'>('L');

  const handleGlobalUnitChange = (targetUnit: 'L' | 'Kg') => {
    if (globalUnit === targetUnit) return;

    const conversionFactor = targetUnit === 'Kg' ? 1.03 : (1 / 1.03);

    setFormData(prev => {
      // Convert intakes quantity
      const updatedIntakes = prev.intakes.map(intake => {
        const qty = parseFloat(intake.quantity);
        if (isNaN(qty) || intake.quantity.trim() === '') return intake;
        const convertedQty = (qty * conversionFactor).toFixed(2).replace(/\.?0+$/, '');
        const convertedAvg = (parseFloat(convertedQty) / 30).toFixed(2).replace(/\.?0+$/, '');
        return {
          ...intake,
          quantity: convertedQty,
          avgVolPerDay: convertedAvg
        };
      });

      // Convert sales quantities
      const updatedSales = prev.sales.map(sale => {
        const convertField = (val: string) => {
          const num = parseFloat(val);
          if (isNaN(num) || val.trim() === '') return val;
          return (num * conversionFactor).toFixed(2).replace(/\.?0+$/, '');
        };

        const qtyDeclared = convertField(sale.qtyDeclared);
        const verifiedQty = convertField(sale.verifiedQty);
        const projectedQty = convertField(sale.projectedQty);
        const underDeclared = convertField(sale.underDeclared);
        const avgVolPerDay = (parseFloat(verifiedQty) / 30).toFixed(2).replace(/\.?0+$/, '');

        return {
          ...sale,
          qtyDeclared,
          verifiedQty,
          projectedQty,
          underDeclared,
          avgVolPerDay
        };
      });

      return {
        ...prev,
        intakes: updatedIntakes,
        sales: updatedSales
      };
    });

    setGlobalUnit(targetUnit);
  };

  const getInputClass = (name: string, extraClasses: string = '', basePadding: string = 'px-4 py-2 rounded-xl') => {
    const isFailed = failedFields.includes(name);
    const borderClass = isFailed
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200';
    return `w-full border transition-all outline-none ${basePadding} ${borderClass} ${extraClasses}`;
  };

  useEffect(() => {
    // Auto calculate under declared volume and mirror farmerPrice to buyingPrice for each sales entry
    const isMirroredCategory = formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor';

    const updatedSales = formData.sales.map(sale => {
      if (isBranchFacility) {
        return {
          ...sale,
          qtyDeclared: '',
          underDeclared: '',
          projectedQty: ''
        };
      }

      const declared = parseFloat(sale.qtyDeclared) || 0;
      const verified = parseFloat(sale.verifiedQty) || 0;
      const diff = Math.max(0, verified - declared);
      
      // Mirror farmerPrice to buyingPrice if there is a matching intake month and year and the category is mirrored
      const match = isMirroredCategory ? formData.intakes.find(
        i => i.month && i.year && i.month === sale.month && i.year === sale.year
      ) : null;
      const buyingPrice = match ? match.farmerPrice : sale.buyingPrice;

      return { 
        ...sale, 
        underDeclared: diff.toString(),
        buyingPrice
      };
    });

    // Auto populate non-compliance based on under-declaration (never for branch facilities)
    const newNonCompliance = (!isBranchFacility && formData.hasLocalSales)
      ? updatedSales
        .filter(sale => parseFloat(sale.underDeclared) > 0 && sale.month.trim() !== '')
        .map(sale => {
          const displayMonth = `${sale.month} ${sale.year}`;
          // Find existing entry to preserve data
          const existing = formData.nonCompliance.find(nc => nc.month === displayMonth);
          
          return {
            month: displayMonth,
            litres: sale.underDeclared,
            amount: existing?.amount || '', // Manual entry now
            paymentMonthYear: existing?.paymentMonthYear || '',
            mpesaRef: existing?.mpesaRef || ''
          };
        })
      : [];

    const salesChanged = JSON.stringify(updatedSales) !== JSON.stringify(formData.sales);
    const ncChanged = JSON.stringify(newNonCompliance) !== JSON.stringify(formData.nonCompliance);

    if (salesChanged || ncChanged) {
      setFormData(prev => ({ 
        ...prev, 
        sales: updatedSales,
        nonCompliance: newNonCompliance 
      }));
    }
  }, [formData.sales, formData.intakes, formData.category, isBranchFacility, formData.hasLocalSales]);

  const totalPenalty = formData.nonCompliance.reduce((sum, nc) => sum + (parseFloat(nc.amount) || 0), 0);

  useEffect(() => {
    const verifyApi = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data: any = await res.json();
          console.log('API is healthy', data);
          setIsConnected(data.configured);
        } else {
          console.log('API health check failed:', res.status);
          setIsConnected(false);
        }
      } catch (err) {
        console.error('API unreachable:', err);
        setIsConnected(false);
      }
    };
    verifyApi();
  }, []);

  // Fast helper to compute premise validation history from any list of records
  const extractPremiseHistory = (vals: any[], pName: string, pNo: string, dbo: string) => {
    const pNorm = normStr(pName);
    const pNoNorm = normStr(pNo);
    const dboNorm = normStr(dbo);

    const allExtractedMonths: {
      period: string;
      pdfPath?: string;
      score: number;
      rawData?: any;
      matchedPremise?: string;
      matchedPermit?: string;
      matchedLocation?: string;
      matchedBranch?: string;
      isBranchFacility?: boolean;
    }[] = [];

    const safeVals = Array.isArray(vals) ? vals : [];
    if (safeVals.length > 0) {
      safeVals.forEach(v => {
        if (!v) return;
        const raw = typeof v.raw_data === 'string' ? (() => { try { return JSON.parse(v.raw_data); } catch { return {}; } })() : (v.rawData || v.raw_data || {});
        const vPName = normStr(v.premiseName || v.premise_name || raw.premiseName || raw.premise_name);
        const vPNo = normStr(v.permitNo || v.permit_no || v.clientId || raw.permitNo || raw.permit_no);
        const vDbo = normStr(v.clientName || v.dbo_name || raw.dboName || raw.dbo_name || raw.clientName);
        const vBranch = v.branch || raw.branch || '';
        const vLocation = v.location || raw.location || '';
        const rawPName = v.premiseName || v.premise_name || raw.premiseName || '';
        const rawPNo = v.permitNo || v.permit_no || raw.permitNo || '';

        // Strict Premise Matching: When a premise name is entered, match the exact premise name
        let isMatch = false;
        if (pNorm) {
          isMatch = vPName === pNorm;
        } else if (pNoNorm) {
          isMatch = vPNo === pNoNorm;
        } else if (dboNorm) {
          isMatch = vDbo === dboNorm;
        }

        if (isMatch) {
          const pdfRef = v.pdfPath || v.pdf_path || raw.pdf_path || raw.pdfPath || raw.pdf;
          let fullPeriod = v.period || v.validation_period || raw.validationPeriod || raw.period || '';
          if (fullPeriod) {
            fullPeriod = fullPeriod.trim();
            if (v.year && !fullPeriod.includes(String(v.year))) {
              fullPeriod = `${fullPeriod} ${v.year}`;
            }
          } else if (v.validatedAt || v.date || raw.date) {
            const d = new Date(v.validatedAt || v.date || raw.date);
            if (!isNaN(d.getTime())) {
              fullPeriod = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
            }
          }

          // Detect whether this historical record belongs to a branch or main facility
          const hasBranchIndicator = !!(
            raw.isBranch ||
            v.isBranch ||
            (raw.validationPremiseMode && raw.validationPremiseMode !== 'main') ||
            (rawPName && (rawPName.toLowerCase().includes('branch') || rawPName.toLowerCase().includes('outlet'))) ||
            (vPNo && vPNo.includes('-br')) ||
            (vPNo && vPNo.includes('/br'))
          );

          if (fullPeriod) {
            allExtractedMonths.push({
              period: fullPeriod,
              pdfPath: pdfRef,
              score: getPeriodTimestamp(fullPeriod, v.validatedAt || v.date || raw.date),
              rawData: raw,
              matchedPremise: rawPName || pName,
              matchedPermit: rawPNo || pNo,
              matchedLocation: vLocation,
              matchedBranch: vBranch,
              isBranchFacility: hasBranchIndicator
            });
          }
        }
      });
    }

    // Deduplicate by normalized period + premise name to preserve distinct branch histories
    const deduplicated: Record<string, any> = {};
    allExtractedMonths.forEach(m => {
      const key = `${m.period.toLowerCase().trim()}_${(m.matchedPremise || '').toLowerCase().trim()}`;
      if (!deduplicated[key] || (!deduplicated[key].pdfPath && m.pdfPath) || m.score > deduplicated[key].score) {
        deduplicated[key] = m;
      }
    });

    const sortedList = Object.values(deduplicated).sort((a: any, b: any) => b.score - a.score);
    return sortedList.slice(0, 6).map((m: any) => ({
      month: '', year: '', date: '',
      fullPeriod: m.period,
      displayString: m.period.replace(/(\b\d{4}\b)\s+\1/g, '$1'),
      matchedPremise: m.matchedPremise || pName,
      matchedPermit: m.matchedPermit || pNo,
      matchedLocation: m.matchedLocation || '',
      matchedBranch: m.matchedBranch || '',
      isBranchFacility: !!m.isBranchFacility,
      pdfPath: m.pdfPath,
      rawData: m.rawData
    }));
  };

  // Fast helper to compute DBO record matches from clients registry & cached validations
  const extractDboMatches = (searchTerm: string, clientsList: LicensedClient[], cachedVals: any[]) => {
    const uniqueMap: Record<string, any> = {};
    const cleanSearch = searchTerm.replace(/["']/g, '').trim();
    const searchTokens = cleanSearch.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    const normSearch = normStr(searchTerm);

    const safeClients = Array.isArray(clientsList) ? clientsList : [];
    const safeVals = Array.isArray(cachedVals) ? cachedVals : [];

    const closedSet = new Set(
      safeClients
        .filter(c => isClosedStatus(c.operationalStatus) || isClosedStatus(c.permitStatus))
        .flatMap(c => [
          normStr(c.clientName),
          normStr(c.premiseName),
          normStr(c.id),
          normStr(c.permitNumber)
        ])
        .filter(Boolean)
    );

    // 1. Search cached validations
    if (safeVals.length > 0) {
      safeVals.forEach(v => {
        if (!v) return;
        const raw = typeof v.raw_data === 'string' ? (() => { try { return JSON.parse(v.raw_data); } catch { return {}; } })() : (v.rawData || v.raw_data || {});
        const vDbo = normStr(v.clientName || v.dbo_name || raw.dboName || raw.dbo_name);
        const vPName = normStr(v.premiseName || v.premise_name || raw.premiseName || raw.premise_name);
        const vPermit = normStr(v.permitNo || v.permit_no || v.clientId || raw.permitNo || raw.permit_no);

        if (closedSet.has(vDbo) || closedSet.has(vPName) || closedSet.has(vPermit)) {
          return;
        }

        const isMatch = (normSearch && (vDbo.includes(normSearch) || normSearch.includes(vDbo))) ||
                        (searchTokens.length > 0 && searchTokens.some(tok => vDbo.includes(tok)));

        if (isMatch) {
          const key = `${v.premiseName || v.premise_name || raw.premiseName || ''}-${v.permitNo || v.permit_no || raw.permitNo || ''}`.toLowerCase().trim();
          if (!uniqueMap[key]) {
            // Prioritize the actual validation timestamp / date when the validation was done
            const validationDoneDate = v.validatedAt || v.date || raw.validatedAt || raw.date || raw.savedAt || '';
            uniqueMap[key] = {
              dbo_name: v.clientName || v.dbo_name || raw.dboName || raw.dbo_name,
              premise_name: v.premiseName || v.premise_name || raw.premiseName || raw.premise_name,
              category: v.category || raw.category,
              permit_no: v.permitNo || v.permit_no || raw.permitNo,
              location: v.location || raw.location,
              county: toSentenceCase((raw && raw.county) || 'Kericho'),
              raw_data: raw,
              date: validationDoneDate || new Date().toISOString(),
              isFromValidation: true
            };
          }
        }
      });
    }

    // 2. Search active clients registry
    if (safeClients.length > 0) {
      safeClients.forEach(c => {
        if (!c || isClosedStatus(c.operationalStatus) || isClosedStatus(c.permitStatus)) return;

        const cDbo = normStr(c.clientName);
        const isMatch = (normSearch && (cDbo.includes(normSearch) || normSearch.includes(cDbo))) ||
                        (searchTokens.length > 0 && searchTokens.some(tok => cDbo.includes(tok)));

        if (isMatch) {
          const key = `${c.premiseName || ''}-${c.id || ''}`.toLowerCase().trim();
          if (!uniqueMap[key]) {
            uniqueMap[key] = {
              dbo_name: c.clientName,
              premise_name: c.premiseName,
              category: c.premiseCategory,
              permit_no: c.id,
              location: c.location,
              county: toSentenceCase(c.county || 'Kericho'),
              raw_data: {
                dboName: c.clientName,
                premiseName: c.premiseName,
                category: c.premiseCategory,
                permitNo: c.id,
                location: c.location,
                county: toSentenceCase(c.county || 'Kericho'),
                contacts: c.tel,
                expiryDate: c.expiryDate
              },
              date: c.startDate || new Date().toISOString()
            };
          }
        }
      });
    }

    return Object.values(uniqueMap).slice(0, 8);
  };

  // Instant & debounced background Fetch for Premise Validation & PDF History
  useEffect(() => {
    let isMounted = true;
    const pName = (formData.premiseName || '').trim();
    const pNo = (formData.permitNo || '').trim();
    const dbo = (formData.dboName || '').trim();

    if (!pName && !pNo && !dbo) {
      setLastCollections([]);
      setHistoryError(null);
      setIsCheckingHistory(false);
      return;
    }

    // Phase 1: Instant Synchronous Lookup from in-memory cache (0ms latency)
    const cachedVals = DBService.getCachedValidations();
    const immediateHistory = extractPremiseHistory(Array.isArray(cachedVals) ? cachedVals : [], pName, pNo, dbo);
    if (immediateHistory.length > 0) {
      setLastCollections(immediateHistory);
    }

    // Phase 2: Debounced background check for remote Supabase updates
    const fetchRemoteHistory = async () => {
      if (!isMounted) return;
      setIsCheckingHistory(true);
      setHistoryError(null);

      try {
        const allVals = await DBService.getValidations();
        let sbVals: any[] = [];
        if (supabase) {
          try {
            const searchTerms: string[] = [];
            if (pName && pName.length >= 2) searchTerms.push(`premise_name.ilike.%${pName.replace(/["']/g, '').trim()}%`);
            if (pNo && pNo.length >= 2) searchTerms.push(`permit_no.ilike.%${pNo.replace(/["']/g, '').trim()}%`);
            if (dbo && dbo.length >= 2) searchTerms.push(`dbo_name.ilike.%${dbo.replace(/["']/g, '').trim()}%`);
            
            if (searchTerms.length > 0) {
              const { data: sbData } = await supabase
                .from('kdb_validations')
                .select('*')
                .or(searchTerms.join(','))
                .order('date', { ascending: false })
                .limit(25);
              if (Array.isArray(sbData)) sbVals = sbData;
            }
          } catch (spErr) {
            console.warn('[fetchHistory] Supabase direct query note:', spErr);
          }
        }

        if (!isMounted) return;
        const safeAllVals = Array.isArray(allVals) ? allVals : [];
        const safeSbVals = Array.isArray(sbVals) ? sbVals : [];
        const combined = [...safeAllVals, ...safeSbVals];
        const computedHistory = extractPremiseHistory(combined, pName, pNo, dbo);
        setLastCollections(computedHistory);
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching history:', err);
          setHistoryError(err.message || 'Failed to fetch history');
        }
      } finally {
        if (isMounted) {
          setIsCheckingHistory(false);
        }
      }
    };

    const timer = setTimeout(fetchRemoteHistory, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.premiseName, formData.permitNo, formData.dboName]);

  // Instant & debounced background Fetch for DBO Search History
  useEffect(() => {
    let isMounted = true;
    if (hasAutofilledDbo) {
      setIsCheckingDbo(false);
      return;
    }

    const searchTerm = (formData.dboName || '').trim();
    if (!searchTerm || searchTerm.length < 2) {
      setLastDboRecords([]);
      setDboError(null);
      setIsCheckingDbo(false);
      return;
    }

    // Phase 1: Instant Synchronous Lookup from memory (0ms latency)
    const cachedVals = DBService.getCachedValidations();
    const safeClients = Array.isArray(clients) ? clients : [];
    const safeCached = Array.isArray(cachedVals) ? cachedVals : [];
    const immediateMatches = extractDboMatches(searchTerm, safeClients, safeCached);
    if (immediateMatches.length > 0) {
      setLastDboRecords(immediateMatches);
    }

    // Phase 2: Debounced background check for remote Supabase updates
    const fetchRemoteDbo = async () => {
      if (!isMounted) return;
      setIsCheckingDbo(true);
      setDboError(null);

      try {
        const cleanSearch = searchTerm.replace(/["']/g, '').trim();
        let remoteRecords: any[] = [];

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('kdb_validations')
              .select('dbo_name, premise_name, category, permit_no, location, county, raw_data, date')
              .ilike('dbo_name', `%${cleanSearch}%`)
              .order('date', { ascending: false })
              .limit(15);

            if (!error && Array.isArray(data)) {
              remoteRecords = data;
            }
          } catch (spErr) {
            console.warn('[DboHistory] Supabase query warning:', spErr);
          }
        }

        if (!isMounted) return;
        const allVals = await DBService.getValidations();
        const safeAllVals = Array.isArray(allVals) ? allVals : [];
        const safeRemoteRecords = Array.isArray(remoteRecords) ? remoteRecords : [];
        const combined = [...safeAllVals, ...safeRemoteRecords];
        const computedDboRecords = extractDboMatches(searchTerm, safeClients, combined);
        setLastDboRecords(computedDboRecords);
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching DBO history:', err);
          setDboError(err.message || 'Failed to fetch DBO history');
        }
      } finally {
        if (isMounted) {
          setIsCheckingDbo(false);
        }
      }
    };

    const timer = setTimeout(fetchRemoteDbo, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.dboName, clients, hasAutofilledDbo]);

  const isFormDirtyOrPopulated = (data: FormData, decls?: { accurate: boolean; offense: boolean; awareness: boolean }) => {
    if (!data) return false;
    if (data.dboName && data.dboName.trim() !== '') return true;
    if (data.premiseName && data.premiseName.trim() !== '') return true;
    if (data.permitNo && data.permitNo.trim() !== '') return true;
    if (data.location && data.location.trim() !== '') return true;
    if (data.contacts && data.contacts.trim() !== '') return true;
    if (data.category && data.category.trim() !== '') return true;
    if (data.comments && data.comments.trim() !== '') return true;
    if (data.complianceOfficer && data.complianceOfficer.trim() !== '') return true;
    if (data.confirmationName && data.confirmationName.trim() !== '') return true;
    if (data.designation && data.designation.trim() !== '') return true;
    if (data.dboSignature && data.dboSignature.trim() !== '') return true;
    if (data.complianceSignature && data.complianceSignature.trim() !== '') return true;
    if (data.nonCompliance && data.nonCompliance.length > 0) return true;
    if (data.sales && data.sales.some(s => (s.qtyDeclared && s.qtyDeclared.trim() !== '') || (s.verifiedQty && s.verifiedQty.trim() !== '') || (s.buyingPrice && s.buyingPrice.trim() !== '') || (s.sellingPrice && s.sellingPrice.trim() !== ''))) return true;
    if (data.intakes && data.intakes.some(i => (i.quantity && i.quantity.trim() !== '') || (i.farmerPrice && i.farmerPrice.trim() !== '') || (i.processor && i.processor.trim() !== ''))) return true;
    if (data.distributors && data.distributors.some(d => (d.name && d.name.trim() !== '') || (d.contacts && d.contacts.trim() !== ''))) return true;
    if (decls && (decls.accurate || decls.offense || decls.awareness)) return true;
    return false;
  };

  const refreshDraftsList = async () => {
    try {
      const drafts = await DBService.getValidationDrafts(true);
      if (Array.isArray(drafts)) {
        setDraftsList(drafts);
      }
      return drafts;
    } catch (e) {
      console.warn('Failed to load drafts from Supabase:', e);
      return [];
    }
  };

  const saveDraftToStorage = (
    customFormData?: FormData,
    customStep?: number,
    showNotification = false
  ) => {
    const currentForm = customFormData || formData;
    const currentStep = customStep !== undefined ? customStep : step;

    let sig = currentForm.dboSignature;
    if (dboSigPad.current && !dboSigPad.current.isEmpty()) {
      try {
        sig = dboSigPad.current.getTrimmedCanvas().toDataURL('image/png');
      } catch (_) {}
    }
    const formToSave = { ...currentForm, dboSignature: sig || currentForm.dboSignature };

    const now = new Date();
    const draftData = {
      formData: formToSave,
      step: currentStep,
      declarations,
      selectedClient,
      validationPremiseMode,
      globalUnit,
      isAmendment,
      isValidationPeriodEdited,
      hasAutofilledDbo,
      draftId: activeDraftId,
      savedAt: now.toISOString()
    };

    try {
      localStorage.setItem('kdb_validation_form_draft_v2', JSON.stringify(draftData));
      localStorage.setItem('kdb_validation_form_draft', JSON.stringify(formToSave));
      localStorage.setItem('kdb_validation_form_draft_step', currentStep.toString());
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDraftLastSaved(timeFormatted);
      if (showNotification) {
        setStatus({ 
          type: 'success', 
          message: `Draft saved successfully at ${timeFormatted}.` 
        });
      }
    } catch (err) {
      console.error('Failed to save draft to localStorage:', err);
    }
  };

  // Submit and save draft to Supabase only (no Google Sheets sync)
  const handleSubmitDraftToSupabase = async (customFormData?: FormData, customStep?: number, silent = false) => {
    const currentForm = customFormData || formData;
    const currentStep = customStep !== undefined ? customStep : step;

    if (!isFormDirtyOrPopulated(currentForm, declarations)) {
      if (!silent) {
        setStatus({ type: 'error', message: 'Form is empty. Enter some information before submitting a draft.' });
      }
      return;
    }

    if (!silent) setIsSubmittingDraft(true);

    let sig = currentForm.dboSignature;
    if (dboSigPad.current && !dboSigPad.current.isEmpty()) {
      try {
        sig = dboSigPad.current.getTrimmedCanvas().toDataURL('image/png');
      } catch (_) {}
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Lock end time in the draft state: preserve if already set, or lock at this exact moment
    const lockedEndTime = currentForm.endTime || timeFormatted;

    const formToSave = { 
      ...currentForm, 
      endTime: lockedEndTime,
      dboSignature: sig || currentForm.dboSignature 
    };

    // Update active component state so the form UI immediately reflects the locked End Time
    setFormData(prev => ({ ...prev, endTime: lockedEndTime }));

    const draftId = activeDraftId || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }));

    const nowIso = now.toISOString();

    const rawData = {
      formData: formToSave,
      step: currentStep,
      declarations,
      selectedClient,
      validationPremiseMode,
      globalUnit,
      isAmendment,
      isValidationPeriodEdited,
      hasAutofilledDbo,
      draftId,
      savedAt: nowIso
    };

    const draftPayload: ValidationDraft = {
      id: draftId,
      permitNo: formToSave.permitNo || '',
      permit_no: formToSave.permitNo || '',
      dboName: formToSave.dboName || '',
      dbo_name: formToSave.dboName || '',
      premiseName: formToSave.premiseName || '',
      premise_name: formToSave.premiseName || '',
      validationPeriod: formToSave.validationPeriod || '',
      validation_period: formToSave.validationPeriod || '',
      category: formToSave.category || '',
      location: formToSave.location || '',
      county: formToSave.county || 'Kericho',
      branch: formToSave.county || 'Kericho',
      step: currentStep,
      status: 'draft',
      rawData,
      raw_data: rawData,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    try {
      const saved = await DBService.saveValidationDraft(draftPayload);
      setActiveDraftId(saved.id);

      // Also keep local storage copy for instantaneous backup
      saveDraftToStorage(formToSave, currentStep, false);

      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDraftLastSaved(timeFormatted);

      await refreshDraftsList();

      if (!silent) {
        setStatus({
          type: 'success',
          message: `Draft successfully submitted to Supabase at ${timeFormatted}! You can retrieve and modify it later, then submit & sync to Sheet.`
        });
      }
    } catch (err: any) {
      console.error('Failed to save draft to Supabase:', err);
      // Fallback: save to local storage
      saveDraftToStorage(formToSave, currentStep, false);
      if (!silent) {
        setStatus({
          type: 'success',
          message: `Draft saved locally (Supabase offline). You can continue working.`
        });
      }
    } finally {
      if (!silent) setIsSubmittingDraft(false);
    }
  };

  const handleManualSaveDraft = () => {
    handleSubmitDraftToSupabase(formData, step, false);
  };

  // Load saved draft on mount from Supabase and local storage
  useEffect(() => {
    const initDrafts = async () => {
      try {
        // 1. Fetch Supabase drafts
        const drafts = await DBService.getValidationDrafts(true);
        if (Array.isArray(drafts) && drafts.length > 0) {
          setDraftsList(drafts);
          const latest = drafts[0];
          const raw = latest.rawData || latest.raw_data || {};
          const form = raw.formData || latest;
          let timeStr = '';
          if (latest.updatedAt || latest.updated_at || latest.createdAt) {
            try {
              const d = new Date(latest.updatedAt || latest.updated_at || latest.createdAt || '');
              timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (_) {}
          }
          setHasDraft(true);
          setDraftInfo({
            clientOrDbo: latest.dboName || latest.dbo_name || form.dboName || 'Saved Draft',
            premise: latest.premiseName || latest.premise_name || form.premiseName || '',
            period: latest.validationPeriod || latest.validation_period || form.validationPeriod || '',
            step: latest.step ?? (raw.step ?? 0),
            savedTime: timeStr
          });
          return;
        }

        // 2. Fallback to localStorage draft if no Supabase draft found
        const draftV2Raw = localStorage.getItem('kdb_validation_form_draft_v2');
        const legacyDraftRaw = localStorage.getItem('kdb_validation_form_draft');
        
        let parsedDraft: any = null;
        if (draftV2Raw) {
          parsedDraft = JSON.parse(draftV2Raw);
        } else if (legacyDraftRaw) {
          const legacyData = JSON.parse(legacyDraftRaw);
          const legacyStep = localStorage.getItem('kdb_validation_form_draft_step');
          parsedDraft = {
            formData: legacyData,
            step: legacyStep ? parseInt(legacyStep, 10) : 0,
            savedAt: new Date().toISOString()
          };
        }

        if (parsedDraft && parsedDraft.formData && isFormDirtyOrPopulated(parsedDraft.formData, parsedDraft.declarations)) {
          setHasDraft(true);
          const form = parsedDraft.formData;
          let timeStr = '';
          if (parsedDraft.savedAt) {
            try {
              const d = new Date(parsedDraft.savedAt);
              timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (_) {}
          }
          setDraftInfo({
            clientOrDbo: form.dboName || form.confirmationName || form.premiseName || 'Active Validation',
            premise: form.premiseName || '',
            period: form.validationPeriod || '',
            step: parsedDraft.step ?? 0,
            savedTime: timeStr
          });
        }
      } catch (e) {
        console.error('Error reading saved draft on mount:', e);
      } finally {
        setTimeout(() => {
          isMountedRef.current = true;
        }, 150);
      }
    };

    initDrafts();

    const handleDraftsUpdated = () => {
      DBService.getValidationDrafts(true).then(setDraftsList).catch(() => {});
    };
    window.addEventListener('validation_drafts_updated', handleDraftsUpdated);
    return () => {
      window.removeEventListener('validation_drafts_updated', handleDraftsUpdated);
    };
  }, []);

  // Save draft automatically when form data changes
  useEffect(() => {
    if (!isMountedRef.current || isRestoringRef.current) return;
    
    // If the draft restore banner is currently showing, don't overwrite stored draft with fresh empty state
    if (hasDraft) return;

    if (!isFormDirtyOrPopulated(formData, declarations)) {
      return;
    }

    const timer = setTimeout(() => {
      saveDraftToStorage(formData, step, false);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    formData, 
    step, 
    declarations, 
    selectedClient, 
    validationPremiseMode, 
    globalUnit, 
    isAmendment, 
    isValidationPeriodEdited, 
    hasAutofilledDbo, 
    hasDraft
  ]);

  const handleRestoreDraft = (draftObj?: ValidationDraft) => {
    isRestoringRef.current = true;
    try {
      let parsed: any = null;
      let restoredDraftId: string | null = null;

      if (draftObj) {
        // Restoring from a Supabase draft record
        const raw = draftObj.rawData || draftObj.raw_data || draftObj;
        parsed = {
          formData: raw.formData || {
            ...initialData,
            dboName: draftObj.dboName || draftObj.dbo_name || '',
            premiseName: draftObj.premiseName || draftObj.premise_name || '',
            permitNo: draftObj.permitNo || draftObj.permit_no || '',
            validationPeriod: draftObj.validationPeriod || draftObj.validation_period || '',
            category: draftObj.category || '',
            location: draftObj.location || '',
            county: draftObj.county || 'Kericho'
          },
          step: raw.step !== undefined ? raw.step : (draftObj.step ?? 1),
          declarations: raw.declarations || declarations,
          selectedClient: raw.selectedClient || null,
          validationPremiseMode: raw.validationPremiseMode || 'main',
          globalUnit: raw.globalUnit || 'L',
          isAmendment: raw.isAmendment || false,
          isValidationPeriodEdited: raw.isValidationPeriodEdited || false,
          hasAutofilledDbo: raw.hasAutofilledDbo || false,
          savedAt: draftObj.updatedAt || draftObj.updated_at || draftObj.createdAt
        };
        restoredDraftId = draftObj.id;
      } else {
        // Restoring from local draft or most recent Supabase draft
        const draftV2Raw = localStorage.getItem('kdb_validation_form_draft_v2');
        const legacyDraftRaw = localStorage.getItem('kdb_validation_form_draft');
        
        if (draftV2Raw) {
          parsed = JSON.parse(draftV2Raw);
          restoredDraftId = parsed.draftId || activeDraftId || null;
        } else if (legacyDraftRaw) {
          const legacyData = JSON.parse(legacyDraftRaw);
          const legacyStep = localStorage.getItem('kdb_validation_form_draft_step');
          parsed = {
            formData: legacyData,
            step: legacyStep ? parseInt(legacyStep, 10) : 0,
            savedAt: new Date().toISOString()
          };
        } else if (draftsList.length > 0) {
          const latest = draftsList[0];
          return handleRestoreDraft(latest);
        }
      }

      if (parsed && parsed.formData) {
        setFormData(parsed.formData);
        if (parsed.declarations) setDeclarations(parsed.declarations);
        if (parsed.selectedClient) setSelectedClient(parsed.selectedClient);
        if (parsed.validationPremiseMode) setValidationPremiseMode(parsed.validationPremiseMode);
        if (parsed.globalUnit) setGlobalUnit(parsed.globalUnit);
        if (parsed.isAmendment !== undefined) setIsAmendment(parsed.isAmendment);
        if (parsed.isValidationPeriodEdited !== undefined) setIsValidationPeriodEdited(parsed.isValidationPeriodEdited);
        if (parsed.hasAutofilledDbo !== undefined) setHasAutofilledDbo(parsed.hasAutofilledDbo);
        
        if (restoredDraftId) {
          setActiveDraftId(restoredDraftId);
        }

        const restoredStep = typeof parsed.step === 'number' && parsed.step > 0 ? parsed.step : 1;
        setStep(restoredStep);
        setFailedFields([]);
        
        if (parsed.savedAt) {
          try {
            const d = new Date(parsed.savedAt);
            setDraftLastSaved(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          } catch (_) {}
        }

        setStatus({ 
          type: 'success', 
          message: `Draft restored from Supabase! You can modify it and click 'Submit & Sync to Sheet' when ready, or 'Submit Draft' to update.` 
        });
        setIsDraftsModalOpen(false);
      }
    } catch (err) {
      console.error('Error restoring draft:', err);
      setStatus({ type: 'error', message: 'Failed to restore draft data.' });
    } finally {
      setHasDraft(false);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 250);
    }
  };

  const handleDiscardDraft = async () => {
    localStorage.removeItem('kdb_validation_form_draft_v2');
    localStorage.removeItem('kdb_validation_form_draft');
    localStorage.removeItem('kdb_validation_form_draft_step');
    if (activeDraftId) {
      try {
        await DBService.deleteValidationDraft(activeDraftId);
      } catch (_) {}
      setActiveDraftId(null);
    }
    setHasDraft(false);
    setDraftInfo(null);
    setDraftLastSaved(null);
    refreshDraftsList();
    setStatus({ type: 'success', message: 'Saved draft discarded.' });
  };

  const handleDeleteDraft = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this draft from Supabase?")) return;
    try {
      await DBService.deleteValidationDraft(id);
      if (activeDraftId === id) {
        setActiveDraftId(null);
      }
      await refreshDraftsList();
      setStatus({ type: 'success', message: 'Draft deleted from Supabase.' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `Failed to delete draft: ${err.message || err}` });
    }
  };

  const handleDboAutofill = (record: any) => {
    const raw = record.raw_data || {};
    const permitNo = raw.permitNo || record.permit_no || '';
    const formattedExpiry = formatToYYYYMMDD(raw.expiryDate || formData.expiryDate || '');
    const currentMonthYear = `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`;
    
    const nextForm = {
      ...formData,
      dboName: record.dbo_name || formData.dboName,
      permitNo: permitNo || formData.permitNo,
      premiseName: raw.premiseName || record.premise_name || formData.premiseName,
      category: raw.category || record.category || formData.category,
      contacts: raw.contacts || formData.contacts,
      county: toSentenceCase(raw.county || record.county || formData.county || 'Kericho'),
      location: raw.location || record.location || formData.location,
      expiryDate: formattedExpiry,
      validationPeriod: isAmendment ? (raw.validationPeriod || formData.validationPeriod || currentMonthYear) : (formData.validationPeriod || currentMonthYear),
      distPermitNo: raw.distPermitNo || permitNo || formData.distPermitNo || '',
    };
    setFormData(nextForm);
    
    // Only lock validationPeriod override if amending
    if (isAmendment) {
      setIsValidationPeriodEdited(true);
    }

    // Mark as autofilled to stop checking previous validations
    setHasAutofilledDbo(true);
    setIsCheckingDbo(false);
    setLastDboRecords([]);
    
    // Clear any failed fields
    setFailedFields(prev => prev.filter(f => ![
      'dboName', 'permitNo', 'premiseName', 'category', 'contacts', 'county', 'location', 'expiryDate'
    ].includes(f)));

    // Match selected client for manual reconciliation trigger
    if (clients.length > 0) {
      const matched = findMatchingClient(permitNo, record.dbo_name || '');
      if (matched) {
        setSelectedClient(matched);
        setValidationPremiseMode('main');
        setDboHasBranches(!!(matched.branches && matched.branches.length > 0));
      }
    }
  };

  const handleInputBlur = () => {
    if (clients.length === 0) return;
    
    const termPermit = (formData.permitNo || '').trim();
    const termDbo = (formData.dboName || '').trim();

    if (!termPermit && !termDbo) {
      setSelectedClient(null);
      setValidationPremiseMode('main');
      return;
    }

    const matched = findMatchingClient(termPermit, termDbo);

    if (matched) {
      setSelectedClient(matched);
      setValidationPremiseMode('main');
      if (dboHasBranches === null) {
        setDboHasBranches(!!(matched.branches && matched.branches.length > 0));
      }
    }
  };

  const handleBranchPromptChange = (hasBranches: boolean) => {
    setDboHasBranches(hasBranches);
    if (!hasBranches) {
      // Single standalone premise
      setValidationPremiseMode('main');
      if (selectedClient) {
        handlePremiseModeChange('main');
      }
    } else {
      // Has multiple branches
      if (selectedClient && selectedClient.branches && selectedClient.branches.length > 0) {
        if (!validationPremiseMode || validationPremiseMode === 'main') {
          // Keep main as default or user can select specific branch
        }
      }
    }
  };

  const handlePremiseModeChange = (mode: string) => {
    setValidationPremiseMode(mode);
    if (!selectedClient) return;

    if (mode === 'main') {
      const clientExpiry = formatToYYYYMMDD((selectedClient as any).expiryDate || (selectedClient as any).expiry_date || '');
      // Revert form fields to main client profile
      setFormData(prev => ({
        ...prev,
        premiseName: selectedClient.premiseName || '',
        permitNo: selectedClient.id || '',
        category: selectedClient.premiseCategory || 'Milk Bar',
        location: selectedClient.location || '',
        county: toSentenceCase(selectedClient.county || 'Kericho'),
        expiryDate: clientExpiry
      }));
    } else if (mode.startsWith('branch-')) {
      // Find branch
      const branchId = mode.replace('branch-', '');
      const branch = (selectedClient.branches || []).find(b => b.id === branchId);
      if (branch) {
        setFormData(prev => ({
          ...prev,
          premiseName: branch.premiseName,
          permitNo: branch.permitNumber,
          category: branch.premiseCategory,
          location: branch.location,
          county: toSentenceCase(branch.county || 'Kericho'),
          expiryDate: formatToYYYYMMDD(branch.expiryDate || ''),
          sales: prev.sales.map(s => ({ ...s, qtyDeclared: '', underDeclared: '', projectedQty: '' })),
          nonCompliance: []
        }));
      }
      // Since it's an existing branch being validated, clear reconciliation screen for parent profile
      setShowReconciliation(false);
      setReconciliationResolved(true);
    } else if (mode === 'new') {
      // It's a new branch, clear fields or keep them so they can edit
      setFormData(prev => ({
        ...prev,
        sales: prev.sales.map(s => ({ ...s, qtyDeclared: '', underDeclared: '', projectedQty: '' })),
        nonCompliance: []
      }));
      setShowReconciliation(false);
      setReconciliationResolved(true);
    }
  };

  const handleDistributorAutofill = (idx: number, record: any) => {
    const raw = record.raw_data || {};
    const permitNo = raw.permitNo || record.permit_no || '';
    const contacts = raw.contacts || record.contacts || '';
    const name = record.dbo_name || record.premise_name || '';

    setFormData(prev => {
      const updatedDistributors = [...prev.distributors];
      if (updatedDistributors[idx]) {
        updatedDistributors[idx] = {
          ...updatedDistributors[idx],
          name: name,
          contacts: contacts,
          permitNo: permitNo,
        };
      }
      return {
        ...prev,
        distributors: updatedDistributors
      };
    });

    // Clear matches for this index to hide suggestions
    setDistributorRecords(prev => ({ ...prev, [idx]: [] }));
    setFailedFields(prev => prev.filter(f => ![
      `dist-${idx}-name`, `dist-${idx}-contacts`, `dist-${idx}-permitNo`
    ].includes(f)));
  };

  const handleRecallSubmission = (rawData: any) => {
    if (rawData) {
      setFormData({
        ...initialData,
        ...rawData,
        distOutlets: rawData.distOutlets || [{ location: '', volPerDay: '', permitStatus: 'None', levyInfo: '' }],
        distNatureOfProduce: rawData.distNatureOfProduce || []
      });
      setIsAmendment(true);
      setIsValidationPeriodEdited(true);
      setStep(1); // Go to general info step for amendment
      setFailedFields([]);
      setStatus({ 
        type: 'success', 
        message: `Amending validation for ${rawData.validationPeriod}. You can now correct and resubmit.` 
      });
    }
  };

  // Auto-populate validation period from table data
  useEffect(() => {
    if (isValidationPeriodEdited) return;

    const isCoolingPlant = formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor';
    
    let period = '';
    if (isCoolingPlant) {
      // For cooling plants, prioritize intakes if local sales are disabled
      if (!formData.hasLocalSales && formData.intakes.length > 0) {
        const lastIntake = formData.intakes[formData.intakes.length - 1];
        if (lastIntake.month && lastIntake.year) period = `${lastIntake.month} ${lastIntake.year}`;
      } else if (formData.sales.length > 0) {
        const lastSale = formData.sales[formData.sales.length - 1];
        if (lastSale.month && lastSale.year) period = `${lastSale.month} ${lastSale.year}`;
      }
    } else {
      // For other categories, check sales
      if (formData.sales.length > 0) {
        const lastSale = formData.sales[formData.sales.length - 1];
        if (lastSale.month && lastSale.year) period = `${lastSale.month} ${lastSale.year}`;
      }
    }

    if (period && period !== formData.validationPeriod) {
      setFormData(prev => ({ ...prev, validationPeriod: period }));
    } else if (!formData.validationPeriod && formData.date) {
      // If period is empty, default to the month of the validation date
      const d = new Date(formData.date);
      if (!isNaN(d.getTime())) {
        const m = d.toLocaleString('default', { month: 'long' });
        const y = d.getFullYear().toString();
        setFormData(prev => ({ ...prev, validationPeriod: `${m} ${y}` }));
      }
    }
  }, [formData.sales, formData.intakes, formData.hasLocalSales, formData.category, formData.date, isValidationPeriodEdited]);

  // Fetch licensed clients and returns data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingClients(true);
      try {
        const [clientsList, returnsList] = await Promise.all([
          DBService.getClients(),
          DBService.getReturns()
        ]);
        setClients(clientsList);
        setReturnsData(returnsList);
      } catch (e) {
        console.error('[DataValidationModule] Error fetching initial data:', e);
      } finally {
        setIsLoadingClients(false);
      }
    };
    fetchInitialData();
  }, []);

  const findMatchingClient = (pNo: string, name: string) => {
    if (clients.length === 0) return null;
    const activeClients = clients.filter(c => !isClosedStatus(c.operationalStatus) && !isClosedStatus(c.permitStatus));
    const cleanStr = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const cleanPermit = (s: string) => (s || '').toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');

    const pTerm = cleanPermit(pNo);
    const nTerm = cleanStr(name);

    if (!pTerm && !nTerm) return null;

    // 1. Try exact permit match
    if (pTerm) {
      const match = activeClients.find(c => cleanPermit(c.id) === pTerm || cleanPermit(c.permitNumber) === pTerm);
      if (match) return match;
    }

    // 2. Try EXACT DBO name match (case-insensitive, normalized whitespace)
    if (nTerm) {
      const match = activeClients.find(c => cleanStr(c.clientName) === nTerm);
      if (match) return match;
    }

    // 3. Try partial/relaxed permit match
    if (pTerm) {
      const match = activeClients.find(c => {
        const cP = cleanPermit(c.id) || cleanPermit(c.permitNumber);
        return cP && (cP.includes(pTerm) || pTerm.includes(cP));
      });
      if (match) return match;
    }

    return null;
  };

  // 7-point split-screen mismatch checker logic
  const checkReconciliation = (client: LicensedClient, currentForm: FormData) => {
    // Automatically populate any blank form fields from client profile
    const formToUse = { ...currentForm };
    let formUpdated = false;

    if (!formToUse.dboName && client.clientName) {
      formToUse.dboName = client.clientName;
      formUpdated = true;
    }
    if (!formToUse.premiseName && client.premiseName) {
      formToUse.premiseName = client.premiseName;
      formUpdated = true;
    }
    if (!formToUse.permitNo && (client.permitNumber || client.id)) {
      formToUse.permitNo = client.permitNumber || client.id;
      formUpdated = true;
    }
    if (!formToUse.location && client.location) {
      formToUse.location = client.location;
      formUpdated = true;
    }
    if (!formToUse.category && client.premiseCategory) {
      formToUse.category = client.premiseCategory;
      formUpdated = true;
    }
    if (!formToUse.contacts && (client.tel || client.contactPerson)) {
      formToUse.contacts = client.tel || client.contactPerson || '';
      formUpdated = true;
    }
    if (!formToUse.expiryDate && (client.expiryDate || (client as any).expiry_date)) {
      formToUse.expiryDate = formatToYYYYMMDD(client.expiryDate || (client as any).expiry_date || '');
      formUpdated = true;
    }

    if (formUpdated) {
      setFormData(formToUse);
    }

    const isMatch = (key: string, vVal: string, cVal: string) => {
      const v = (vVal || '').trim();
      const c = (cVal || '').trim();
      
      // If either side is empty or both are empty, treat as match (blank field takes client/form value)
      if (!v || !c) return true;
      
      const cleanStr = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const cleanPermit = (s: string) => s.toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');

      if (key === 'category') {
        const codeV = getCategoryShortCode(v);
        const codeC = getCategoryShortCode(c);
        if (codeV === codeC) return true;
        return cleanStr(v) === cleanStr(c);
      }
      
      if (key === 'permitNo') {
        const pV = cleanPermit(v);
        const pC = cleanPermit(c);
        if (!pV || !pC) return true;
        return pV === pC || pV.includes(pC) || pC.includes(pV);
      }

      if (key === 'contacts') {
        const pV = v.replace(/[^0-9]/g, '');
        const pC = c.replace(/[^0-9]/g, '');
        if (pV.length >= 7 && pC.length >= 7) {
          if (pV.slice(-9) === pC.slice(-9)) return true;
        }
        const cV = cleanStr(v);
        const cC = cleanStr(c);
        return cV === cC || cV.includes(cC) || cC.includes(cV);
      }

      if (key === 'expiryDate') {
        const normV = formatToYYYYMMDD(v);
        const normC = formatToYYYYMMDD(c);
        if (normV && normC) return normV === normC;
        return cleanStr(v) === cleanStr(c);
      }

      if (key === 'location') {
        const cV = cleanStr(v);
        const cC = cleanStr(c);
        return cV === cC || cV.includes(cC) || cC.includes(cV);
      }

      const cV = cleanStr(v);
      const cC = cleanStr(c);
      return cV === cC || cV.includes(cC) || cC.includes(cV);
    };

    const points = [
      { key: 'dboName', label: '1. Name of DBO (clientname)', validationVal: formToUse.dboName || '', clientVal: client.clientName || '' },
      { key: 'premiseName', label: '2. Premise / Branch Name (premisename)', validationVal: formToUse.premiseName || '', clientVal: client.premiseName || '' },
      { key: 'permitNo', label: '3. Permit Number (permitnumber)', validationVal: formToUse.permitNo || '', clientVal: client.permitNumber || client.id || '' },
      { key: 'location', label: '4. Location / Branch Address (location)', validationVal: formToUse.location || '', clientVal: client.location || '' },
      { key: 'category', label: '5. Category (premisecategory)', validationVal: formToUse.category || '', clientVal: client.premiseCategory || '' },
      { key: 'contacts', label: '6. Contacts (tel / contactperson)', validationVal: formToUse.contacts || '', clientVal: client.tel || client.contactPerson || '' },
      { key: 'expiryDate', label: '7. Expiry Date (expirydate)', validationVal: formToUse.expiryDate || '', clientVal: client.expiryDate || (client as any).expiry_date || '' }
    ];

    const mismatches = points.filter(p => !isMatch(p.key, p.validationVal, p.clientVal));
    
    if (mismatches.length > 0) {
      setMismatchFields(mismatches.map(m => ({ ...m, selectedVal: 'client' })));
      setShowReconciliation(true);
      setReconciliationResolved(false);
    } else {
      setMismatchFields([]);
      setShowReconciliation(false);
      setReconciliationResolved(true);
    }
  };

  const handleTriggerManualReconciliation = () => {
    const cleanPermitHelper = (s: string) => (s || '').toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');
    let matched = selectedClient || findMatchingClient(formData.permitNo, formData.dboName);
    if (!matched && clients.length > 0) {
      const pTerm = cleanPermitHelper(formData.permitNo);
      const dboTerm = (formData.dboName || '').toLowerCase().trim();
      const premTerm = (formData.premiseName || '').toLowerCase().trim();
      
      matched = clients.find(c => {
        const cPermit = cleanPermitHelper(c.permitNumber || c.id);
        const cName = (c.clientName || '').toLowerCase().trim();
        const cPremise = (c.premiseName || '').toLowerCase().trim();
        if (pTerm && cPermit && (cPermit.includes(pTerm) || pTerm.includes(cPermit))) return true;
        if (dboTerm && cName && (cName.includes(dboTerm) || dboTerm.includes(cName))) return true;
        if (premTerm && cPremise && (cPremise.includes(premTerm) || premTerm.includes(cPremise))) return true;
        return false;
      }) || clients[0];
    }

    if (!matched) {
      setStatus({ 
        type: 'error', 
        message: 'No registered client profile found. Please select or enter a client name/permit number to reconcile.' 
      });
      return;
    }

    setSelectedClient(matched);
    const points = [
      { key: 'dboName', label: '1. Name of DBO (clientname)', validationVal: formData.dboName || '', clientVal: matched.clientName || '' },
      { key: 'premiseName', label: '2. Premise / Branch Name (premisename)', validationVal: formData.premiseName || '', clientVal: matched.premiseName || '' },
      { key: 'permitNo', label: '3. Permit Number (permitnumber)', validationVal: formData.permitNo || '', clientVal: matched.permitNumber || matched.id || '' },
      { key: 'location', label: '4. Location / Branch Address (location)', validationVal: formData.location || '', clientVal: matched.location || '' },
      { key: 'category', label: '5. Category (premisecategory)', validationVal: formData.category || '', clientVal: matched.premiseCategory || '' },
      { key: 'contacts', label: '6. Contacts (tel / contactperson)', validationVal: formData.contacts || '', clientVal: matched.tel || matched.contactPerson || '' },
      { key: 'expiryDate', label: '7. Expiry Date (expirydate)', validationVal: formData.expiryDate || '', clientVal: matched.expiryDate || (matched as any).expiry_date || '' }
    ];

    setMismatchFields(points.map(m => ({ ...m, selectedVal: 'client' })));
    setShowReconciliation(true);
    setReconciliationResolved(false);
    setStatus({ 
      type: 'success', 
      message: `Initiated 7-Point Reconciliation for "${matched.clientName || 'Client Profile'}". Review both data sources below.` 
    });
  };

  const handleSelectBranchForReconciliation = (branch: LicensedClient) => {
    setSelectedClient(branch);
    checkReconciliation(branch, formData);
  };

  const handleResolveReconciliation = async () => {
    if (!selectedClient) return;

    const unresolved = mismatchFields.some(m => !m.selectedVal);
    if (unresolved) {
      alert("Please select the latest source of truth for all mismatch fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedForm = { ...formData };
      const updatedClient = { ...selectedClient };

      mismatchFields.forEach(item => {
        let chosenVal = item.selectedVal === 'validation' ? item.validationVal : item.clientVal;
        
        if (item.key === 'permitNo') {
          chosenVal = formatPermitNumber(chosenVal, updatedForm.category || updatedClient.premiseCategory);
          (updatedForm as any)[item.key] = chosenVal;
          updatedClient.id = selectedClient.id;
          updatedClient.permitNumber = chosenVal;
        } else if (item.key === 'expiryDate') {
          const isoVal = formatToYYYYMMDD(chosenVal);
          const formattedDDMM = formatDateToDDMMYYYY(chosenVal);
          (updatedForm as any).expiryDate = isoVal;
          (updatedClient as any).expiryDate = formattedDDMM;
          (updatedClient as any).expiry_date = formattedDDMM;
        } else {
          (updatedForm as any)[item.key] = chosenVal;
          if (item.key === 'dboName') updatedClient.clientName = chosenVal;
          if (item.key === 'premiseName') updatedClient.premiseName = chosenVal;
          if (item.key === 'location') updatedClient.location = chosenVal;
          if (item.key === 'category') updatedClient.premiseCategory = chosenVal as any;
          if (item.key === 'contacts') updatedClient.tel = chosenVal;
        }
      });

      // Synchronize validation period if missing or unedited
      if (!updatedForm.validationPeriod || !isValidationPeriodEdited) {
        if (updatedForm.date) {
          const d = new Date(updatedForm.date);
          if (!isNaN(d.getTime())) {
            const m = d.toLocaleString('default', { month: 'long' });
            const y = d.getFullYear().toString();
            updatedForm.validationPeriod = `${m} ${y}`;
          }
        }
      }

      // Save client to licensed_clients table in Supabase via DBService
      await DBService.saveClient(updatedClient);

      // Update local states
      setFormData(updatedForm);
      setSelectedClient(updatedClient);
      setShowReconciliation(false);
      setReconciliationResolved(true);
      
      // Refresh clients list from database to ensure absolute source of truth
      const refreshedClients = await DBService.getClients(true);
      setClients(refreshedClients);

      setStatus({ type: 'success', message: 'Reconciliation completed. Client profile and Data Validation fields are synchronized.' });
    } catch (err: any) {
      console.error("Reconciliation save error:", err);
      setStatus({ type: 'error', message: `Failed to synchronize reconciliation: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Track manual edits to qtyDeclared so returns auto-injection doesn't overwrite user edits
  const [manuallyEditedQtyDeclared, setManuallyEditedQtyDeclared] = useState<Record<number, boolean>>({});

  // Returns quantity injection pipeline
  useEffect(() => {
    if (isBranchFacility) {
      // Branches are not subject to quantity declared or returns injection
      return;
    }
    if ((!formData.dboName && !formData.premiseName && !formData.permitNo && !selectedClient) || returnsData.length === 0) return;

    setFormData(prev => {
      let hasChanged = false;
      const updatedSales = prev.sales.map((sale, sIdx) => {
        if (!sale.month || !sale.year) {
          return sale;
        }

        // If officer has manually edited this month's declared quantity, do not overwrite it
        if (manuallyEditedQtyDeclared[sIdx]) {
          return sale;
        }

        const matchingReturn = findMatchingReturn(
          sale.month,
          sale.year,
          prev.dboName,
          prev.premiseName,
          prev.permitNo,
          selectedClient,
          returnsData
        );

        const targetQty = matchingReturn && matchingReturn.qty !== undefined && matchingReturn.qty !== null && !isNaN(Number(matchingReturn.qty))
          ? Number(matchingReturn.qty).toString()
          : 'Not Filed';

        const isTargetNumeric = targetQty !== 'Not Filed' && targetQty.trim() !== '';

        if (isTargetNumeric) {
          if (sale.qtyDeclared !== targetQty) {
            hasChanged = true;
            return { 
              ...sale, 
              qtyDeclared: targetQty,
              verifiedQty: sale.verifiedQty && sale.verifiedQty !== '0' && sale.verifiedQty !== sale.qtyDeclared ? sale.verifiedQty : targetQty,
              avgVolPerDay: (parseFloat(targetQty) / 30).toFixed(2).replace(/\.?0+$/, '')
            };
          }
        } else {
          if (sale.qtyDeclared !== 'Not Filed') {
            hasChanged = true;
            return { 
              ...sale, 
              qtyDeclared: 'Not Filed',
              verifiedQty: sale.verifiedQty && sale.verifiedQty !== '0' && sale.verifiedQty !== sale.qtyDeclared ? sale.verifiedQty : '0',
              avgVolPerDay: '0'
            };
          }
        }
        return sale;
      });

      if (hasChanged) {
        return { ...prev, sales: updatedSales };
      }
      return prev;
    });
  }, [formData.dboName, formData.premiseName, formData.permitNo, selectedClient, returnsData, formData.sales, manuallyEditedQtyDeclared, isBranchFacility]);

  // Re-fetch returnsData when step changes or client changes to keep absolute sync
  useEffect(() => {
    if (step === 1 || step === 2) {
      DBService.getReturns().then(r => setReturnsData(r)).catch(() => {});
    }
  }, [step, selectedClient]);

  // Keep distPermitNo in sync with permitNo if empty
  useEffect(() => {
    if (formData.permitNo && !formData.distPermitNo) {
      setFormData(prev => ({ ...prev, distPermitNo: prev.permitNo }));
    }
  }, [formData.permitNo]);

  // Sync first distributor fields to individual legacy form fields
  useEffect(() => {
    if (formData.category === 'Mini Dairy' || formData.category === 'Cottage Industry') {
      const firstDist = formData.distributors?.[0];
      if (firstDist) {
        setFormData(prev => {
          const firstPriceKey = firstDist.natureOfProduce?.[0] || '';
          const firstPrice = firstDist.prices[firstPriceKey] !== undefined
            ? firstDist.prices[firstPriceKey]
            : getMirroredSellingPrice(firstPriceKey, prev.sales);
          if (
            prev.distName !== firstDist.name ||
            prev.distContacts !== firstDist.contacts ||
            prev.distVolPerDay !== firstDist.volPerDay ||
            prev.distPermitNo !== firstDist.permitNo ||
            prev.distAreaOfSale !== firstDist.areaOfSale ||
            prev.distPrice !== firstPrice ||
            JSON.stringify(prev.distOutlets) !== JSON.stringify(firstDist.outlets) ||
            JSON.stringify(prev.distNatureOfProduce) !== JSON.stringify(firstDist.natureOfProduce)
          ) {
            return {
              ...prev,
              distName: firstDist.name,
              distContacts: firstDist.contacts,
              distVolPerDay: firstDist.volPerDay,
              distPermitNo: firstDist.permitNo,
              distAreaOfSale: firstDist.areaOfSale,
              distPrice: firstPrice,
              distOutlets: firstDist.outlets,
              distNatureOfProduce: firstDist.natureOfProduce
            };
          }
          return prev;
        });
      }
    }
  }, [formData.distributors, formData.sales, formData.category]);

  // Fetch previous validations by Distributor Name (Debounced)
  useEffect(() => {
    if (!supabase) return;

    const timers: NodeJS.Timeout[] = [];

    formData.distributors.forEach((dist, idx) => {
      const name = dist.name || '';
      if (name.trim().length < 3) {
        setDistributorRecords(prev => {
          if (prev[idx] && prev[idx].length > 0) {
            return { ...prev, [idx]: [] };
          }
          return prev;
        });
        return;
      }

      setIsCheckingDist(prev => {
        if (!prev[idx]) {
          return { ...prev, [idx]: true };
        }
        return prev;
      });

      const timer = setTimeout(async () => {
        try {
          const searchTerm = name.trim();
          const { data, error } = await supabase
            .from('kdb_validations')
            .select('dbo_name, premise_name, permit_no, contacts, raw_data, date')
            .or(`dbo_name.ilike.%${searchTerm}%,premise_name.ilike.%${searchTerm}%`)
            .order('date', { ascending: false })
            .limit(10);

          if (error) throw error;

          if (data) {
            const uniqueMap: Record<string, any> = {};
            data.forEach(item => {
              const key = `${item.premise_name || ''}-${item.permit_no || ''}`.toLowerCase().trim();
              if (!uniqueMap[key]) {
                uniqueMap[key] = item;
              }
            });
            const results = Object.values(uniqueMap).slice(0, 5);
            setDistributorRecords(prev => ({ ...prev, [idx]: results }));
          } else {
            setDistributorRecords(prev => ({ ...prev, [idx]: [] }));
          }
        } catch (err) {
          console.error('Error fetching distributor lookup:', err);
        } finally {
          setIsCheckingDist(prev => ({ ...prev, [idx]: false }));
        }
      }, 500);

      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [formData.distributors.map(d => d.name).join(',')]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFailedFields(prev => prev.filter(f => f !== name));
    if (name === 'dboName' || name === 'premiseName') {
      setHasAutofilledDbo(false);
    }
    if (name === 'validationPeriod') {
      setIsValidationPeriodEdited(true);
    }
  };

  const validateStep = (s: number) => {
    const missing: string[] = [];

    if (s === 1) {
      const required = ['branch', 'date', 'permitNo', 'expiryDate', 'dboName', 'premiseName', 'category', 'contacts', 'validationPeriod', 'county', 'location'];
      for (const field of required) {
        const value = formData[field as keyof FormData];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missing.push(field);
        }
      }

      if (missing.length > 0) {
        setFailedFields(prev => Array.from(new Set([...prev, ...missing])));
        const firstFieldLabel = missing[0].replace(/([A-Z])/g, ' $1').toLowerCase();
        setStatus({ type: 'error', message: `Please fill in all general information fields (missing: ${firstFieldLabel}).` });
        return false;
      }
    } else if (s === 2) {
      if (formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor') {
        formData.intakes.forEach((intake, idx) => {
          if (!intake.month) missing.push(`intake-${idx}-month`);
          if (!intake.year) missing.push(`intake-${idx}-year`);
          if (!intake.quantity || intake.quantity.trim() === '') missing.push(`intake-${idx}-quantity`);
          if (!intake.farmerPrice || intake.farmerPrice.trim() === '') missing.push(`intake-${idx}-farmerPrice`);
          if (!intake.processor || intake.processor.trim() === '') missing.push(`intake-${idx}-processor`);
          if (!intake.processorPrice || intake.processorPrice.trim() === '') missing.push(`intake-${idx}-processorPrice`);
        });
      }
      if (formData.hasLocalSales) {
        const isBranchValidation = isBranchFacility;
        formData.sales.forEach((sale, idx) => {
          if (!sale.month) missing.push(`sale-${idx}-month`);
          if (!sale.year) missing.push(`sale-${idx}-year`);
          if (!isBranchValidation && (!sale.qtyDeclared || sale.qtyDeclared.trim() === '')) {
            missing.push(`sale-${idx}-qtyDeclared`);
          }
          if (!sale.verifiedQty || sale.verifiedQty.trim() === '') {
            missing.push(`sale-${idx}-verifiedQty`);
          }
          
          const isLastMonth = idx === formData.sales.length - 1;
          if (!isBranchValidation && isLastMonth) {
            if (!sale.projectedQty || sale.projectedQty.trim() === '') missing.push(`sale-${idx}-projectedQty`);
          }
          
          if (!isBranchValidation && (!sale.buyingPrice || sale.buyingPrice.trim() === '')) {
            missing.push(`sale-${idx}-buyingPrice`);
          }
          
          if (formData.natureOfProduce.length > 0) {
            const currentPrices = parseSellingPrices(sale.sellingPrice || '');
            const allFilled = formData.natureOfProduce.every(prod => currentPrices[prod] && currentPrices[prod].trim() !== '');
            if (!allFilled) {
              missing.push(`sale-${idx}-sellingPrice`);
            }
          } else if (!sale.sellingPrice || sale.sellingPrice.trim() === '') {
            missing.push(`sale-${idx}-sellingPrice`);
          }
        });
      }
      if (formData.natureOfProduce.length === 0) {
        missing.push('natureOfProduce');
      }
      if (!formData.source || formData.source.trim() === '') {
        missing.push('source');
      }

      if (formData.category === 'Mini Dairy' || formData.category === 'Cottage Industry') {
        formData.distributors.forEach((dist, dIdx) => {
          if (!dist.name || dist.name.trim() === '') missing.push(`dist-${dIdx}-name`);
          if (!dist.contacts || dist.contacts.trim() === '') missing.push(`dist-${dIdx}-contacts`);
          if (!dist.volPerDay || dist.volPerDay.trim() === '') missing.push(`dist-${dIdx}-volPerDay`);
          if (!dist.permitNo || dist.permitNo.trim() === '') missing.push(`dist-${dIdx}-permitNo`);
          if (!dist.areaOfSale || dist.areaOfSale.trim() === '') missing.push(`dist-${dIdx}-areaOfSale`);
          if (!dist.natureOfProduce || dist.natureOfProduce.length === 0) missing.push(`dist-${dIdx}-natureOfProduce`);

          if (dist.natureOfProduce && dist.natureOfProduce.length > 0) {
            dist.natureOfProduce.forEach(product => {
              const price = dist.prices[product] !== undefined ? dist.prices[product] : getMirroredSellingPrice(product, formData.sales);
              if (!price || price.trim() === '') {
                missing.push(`dist-${dIdx}-price-${product}`);
              }
            });
          }

          if (dist.outlets) {
            dist.outlets.forEach((outlet, oIdx) => {
              if (!outlet.location || outlet.location.trim() === '') missing.push(`dist-${dIdx}-outlet-${oIdx}-location`);
              if (!outlet.volPerDay || outlet.volPerDay.trim() === '') missing.push(`dist-${dIdx}-outlet-${oIdx}-volPerDay`);
            });
          }
        });
      }

      if (missing.length > 0) {
        setFailedFields(prev => Array.from(new Set([...prev, ...missing])));
        if (missing.includes('natureOfProduce')) {
          setStatus({ type: 'error', message: 'Please select at least one nature of produce.' });
        } else if (missing.includes('source')) {
          setStatus({ type: 'error', message: 'Please fill in the source field.' });
        } else if (missing.some(m => m.startsWith('intake-'))) {
          setStatus({ type: 'error', message: 'Please complete all fields in the monthly intake section.' });
        } else if (missing.some(m => m.startsWith('sale-'))) {
          setStatus({ type: 'error', message: 'Please complete all fields in the local sales section.' });
        } else if (missing.some(m => m.startsWith('distOutlet-'))) {
          setStatus({ type: 'error', message: 'Please complete all outlet details in the distribution section.' });
        } else if (missing.some(m => m.startsWith('dist'))) {
          setStatus({ type: 'error', message: 'Please complete all required fields in the Distribution Details section.' });
        } else {
          setStatus({ type: 'error', message: 'Please complete all required fields.' });
        }
        return false;
      }
    }

    setFailedFields(prev => prev.filter(f => {
      if (s === 1) {
        const required = ['branch', 'date', 'permitNo', 'expiryDate', 'dboName', 'premiseName', 'category', 'contacts', 'validationPeriod', 'county', 'location'];
        return !required.includes(f);
      }
      if (s === 2) {
        return f.startsWith('intake-') || f.startsWith('sale-') || f === 'natureOfProduce' || f === 'source' || f.startsWith('dist');
      }
      return true;
    }));
    setStatus({ type: null, message: '' });
    return true;
  };

  const handleStart = () => {
    if (isAmendment) {
      setStep(1);
      return;
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setFormData(prev => ({ 
      ...prev, 
      startTime: prev.startTime || timeStr,
      date: prev.date || getLocalDate()
    }));
    setStep(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const generatePDF = async (data: FormData = formData) => {
    const doc = new jsPDF();
    let currentY = 130;

    try {
      const logo = await getCachedLogo();
      if (logo) {
        // Center the logo (x, y, width, height)
        doc.addImage(logo, 'PNG', 85, 10, 40, 25);
      }
    } catch (e) {
      console.warn("Could not load KDB logo for PDF", e);
    }

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > 275) {
        doc.addPage();
        currentY = 20;
        return true;
      }
      return false;
    };

    const writeField = (label: string, value: string, x: number, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, x, y);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.text(` ${value || ''}`, x + labelWidth, y);
    };
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Data Validation Form", 105, 45, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(45, 47, 165, 47);
    doc.setFont("helvetica", "normal");
    
    doc.setFontSize(10);
    writeField("Branch:", data.branch, 20, 65);
    writeField("Date:", formatDate(data.date), 20, 73);
    writeField("Start Time:", data.startTime, 20, 81);
    writeField("End Time:", data.endTime, 20, 89);
    
    writeField("Dairy Business Operator (DBO) Name:", data.dboName, 20, 101);
    writeField("Premise Name:", data.premiseName, 20, 109);
    writeField("Category:", data.category, 20, 117);
    writeField("Permit No:", data.permitNo, 110, 117);
    writeField("Contacts:", data.contacts, 20, 125);
    writeField("Expiry Date:", formatDate(data.expiryDate), 110, 125);
    writeField("Location:", data.location, 20, 133);
    writeField("County:", data.county, 110, 133);
    writeField("Validation Period:", data.validationPeriod, 20, 141);

    currentY = 150;

    // Intakes Table
    if (data.category === 'CP>5,000 L/D' || data.category === 'CP<5,000 L/D' || data.category === 'Processor') {
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.text("Total Monthly Intakes", 20, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Month/Year', `Qty (${globalUnit})`, 'Farmer Price', 'Processor', 'Proc. Price', `Avg Collection/Day (${globalUnit}/Day)`]],
        body: data.intakes.map(i => [`${i.month} ${i.year}`, i.quantity, i.farmerPrice, i.processor, i.processorPrice, i.avgVolPerDay]),
        styles: { fontSize: 8 }
      });
      currentY = (doc as any).lastAutoTable.finalY;
      currentY += 10;
    }

    // Sales Table
    if (data.hasLocalSales) {
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Local Sales Data", 20, currentY);
      doc.setFont("helvetica", "normal");
      
      if (isBranchFacility) {
        // For branches, only witnessed quantity, selling price, and avg volume are recorded
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Month/Year', `Witnessed Quantity (${globalUnit})`, 'Selling Price', `Avg Vol/Day (${globalUnit}/Day)`]],
          body: data.sales.map(s => [`${s.month} ${s.year}`, s.verifiedQty, s.sellingPrice, s.avgVolPerDay]),
          styles: { fontSize: 8 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;
      } else {
        // For main facility/HQ, show standard declared and under-declared audit columns
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Month/Year', `Declared (${globalUnit})`, `Verified (${globalUnit})`, `Projected (${globalUnit})`, `Under Declared (${globalUnit})`, 'Buying Price', 'Selling Price', `Avg Vol/Day (${globalUnit}/Day)`]],
          body: data.sales.map(s => [`${s.month} ${s.year}`, s.qtyDeclared, s.verifiedQty, s.projectedQty, s.underDeclared, s.buyingPrice, s.sellingPrice, s.avgVolPerDay]),
          styles: { fontSize: 7 }
        });
        currentY = (doc as any).lastAutoTable.finalY;
        currentY += 10;
      }
    }

    // Distribution Details Table (for Mini Dairy & Cottage Industry)
    if (data.category === 'Mini Dairy' || data.category === 'Cottage Industry') {
      const distributors = Array.isArray((data as any).distributors) && (data as any).distributors.length > 0
        ? (data as any).distributors
        : [{
            name: data.distName,
            contacts: data.distContacts,
            volPerDay: data.distVolPerDay,
            permitNo: data.distPermitNo,
            areaOfSale: data.distAreaOfSale,
            outlets: data.distOutlets,
            natureOfProduce: data.distNatureOfProduce,
            prices: { [data.distNatureOfProduce?.[0] || 'Produce']: data.distPrice }
          }];

      distributors.forEach((dist: any, dIdx: number) => {
        checkPageBreak(55);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Distributor Details #${dIdx + 1}: ${dist.name || 'Unnamed'}`, 20, currentY);
        doc.setFont("helvetica", "normal");
        
        const outletsText = Array.isArray(dist.outlets) && dist.outlets.length > 0
          ? dist.outlets.map((o: any, index: number) => `#${index+1}: Loc: ${o.location || 'N/A'}, Vol: ${o.volPerDay || 'N/A'}, Permit: ${o.permitStatus || 'N/A'}, Levy: ${o.levyInfo || 'N/A'}`).join('\n')
          : 'None';

        const natureText = Array.isArray(dist.natureOfProduce) ? dist.natureOfProduce.join(', ') : 'N/A';

        const pricesText = dist.prices && Object.keys(dist.prices).length > 0
          ? Object.entries(dist.prices).map(([prod, price]) => `${prod}: ${price}`).join(', ')
          : (data.distPrice || 'N/A');

        autoTable(doc, {
          startY: currentY + 4,
          head: [['Field', 'Detail']],
          body: [
            ['Distributor Name', dist.name || 'N/A'],
            ['Distributor Contacts', dist.contacts || 'N/A'],
            ['Volume per Day', dist.volPerDay || 'N/A'],
            ['Permit Number', dist.permitNo || 'N/A'],
            ['Area of Sale', dist.areaOfSale || 'N/A'],
            ['Nature of Produce', natureText],
            ['Prices (Kshs)', pricesText],
            ['List of Outlets', outletsText]
          ],
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 120 }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY;
        currentY += 10;
      });
    }

    // Summary Data
    checkPageBreak(35);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Detail', 'Value']],
      body: [
        ['Are Traceability & Records Available', data.traceability],
        ['Nature of Produce?', data.natureOfProduce.join(', ')],
        ['Source', data.source],
      ],
      styles: { fontSize: 8 }
    });
    currentY = (doc as any).lastAutoTable.finalY;
    currentY += 10;

    // Compliance Section (Only for main facility / standard validations)
    if (!isBranchFacility) {
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Compliance Commitment:", 20, currentY);
      doc.setFont("helvetica", "normal");
      
      if (data.nonCompliance.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(0, 128, 0); // Green
        doc.text("No under-declaration was witnessed.", 20, currentY + 7);
        doc.setTextColor(0, 0, 0); // Reset to black
        currentY += 15;
      } else {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['CSL Period (Month/Year)', globalUnit === 'L' ? 'Litres' : 'Kilograms', 'Amount (Kshs)', 'Month/Year to Pay', 'MPESA REF']],
          body: [
            ...data.nonCompliance.map(nc => [nc.month, nc.litres, nc.amount, nc.paymentMonthYear, nc.mpesaRef]),
            [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, '', { content: totalPenalty.toFixed(2), styles: { fontStyle: 'bold' } }, '', '']
          ],
          styles: { fontSize: 8 }
        });
        currentY = (doc as any).lastAutoTable.finalY;
        currentY += 10;
      }
    }

    if (data.comments) {
      checkPageBreak(25);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Comments:", 20, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.comments, 20, currentY + 5, { maxWidth: 170 });
      currentY += 20;
    }

    // Declarations (1st and 3rd always, 2nd if under-declaration exists)
    checkPageBreak(45);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Declarations:", 20, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 7;
    const hasUnderDeclaration = data.sales.some(sale => (parseFloat(sale.underDeclared) || 0) > 0);
    const declarationTexts = [
      "I/We confirm that the information provided is true and accurate to the best of my/our knowledge.",
      ...(hasUnderDeclaration ? ["I/We understand that under-declaration of milk volumes is an offense under the Dairy Industry Act and agree to pay the calculated under declared volumes and monies within the specified periods."] : []),
      "I/We confirm that I/We have been informed/presented with, read and understood the KDB Premise Inspection Scope Disclosure, including the legal obligations to maintain records and traceability of the same as stipulated under the Dairy Industry Act (Cap 336), Laws of Kenya."
    ];
    declarationTexts.forEach((text, i) => {
      const splitText = doc.splitTextToSize(text, 164);
      const itemHeight = Math.max(splitText.length * 5.5, 7);
      checkPageBreak(itemHeight + 3);
      
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}.`, 20, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.text(splitText, 26, currentY);
      
      currentY += itemHeight + 2;
    });
    currentY += 3;

    // Signatures
    checkPageBreak(45);
    doc.setFontSize(11);
    doc.text(`Compliance Officer: ${data.complianceOfficer}`, 20, currentY);
    if (data.complianceSignature && data.complianceSignature.startsWith('data:image')) {
      try {
        const format = data.complianceSignature.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(data.complianceSignature, format, 20, currentY + 2, 40, 15);
      } catch (e) {
        console.error('Error adding compliance signature:', e);
      }
    }
    
    doc.text(`For DBO; Name: ${data.confirmationName} (${data.designation})`, 110, currentY);
    if (data.dboSignature && data.dboSignature.startsWith('data:image')) {
      try {
        const format = data.dboSignature.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(data.dboSignature, format, 110, currentY + 2, 40, 15);
      } catch (e) {
        console.error('Error adding DBO signature:', e);
      }
    }
    if (data.dboStamp && data.dboStamp.startsWith('data:image')) {
      try {
        const format = data.dboStamp.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(data.dboStamp, format, 110, currentY + 18, 40, 15);
      } catch (e) {
        console.error('Error adding DBO stamp:', e);
      }
    }

    return doc.output('datauristring');
  };

  const handlePreview = async () => {
    const previewData: FormData = {
      ...formData,
      endTime: formData.endTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const pdf = await generatePDF(previewData);
    setPdfPreview(pdf);
  };

  const viewPdf = async (path: string) => {
    if (!path) return;

    setIsLoadingPdf(true);
    try {
      // 1. Direct base64 data URI or HTTP link
      if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
        setPdfModalUrl(path);
        return;
      }

      const targetPath = path.replace(/^(validationPdfs\/|validation-pdfs\/|ValidationPdfs\/)/i, '').trim();

      // 2. Try Supabase Storage Signed URL across bucket variations
      if (supabase) {
        for (const bucket of ['validationPdfs', 'ValidationPdfs', 'validation-pdfs']) {
          try {
            const { data, error } = await supabase.storage
              .from(bucket)
              .createSignedUrl(targetPath, 120);

            if (!error && data?.signedUrl) {
              setPdfModalUrl(data.signedUrl);
              return;
            }
          } catch (e) {
            console.warn(`Bucket ${bucket} check error:`, e);
          }
        }
      }

      // 3. Try resolvePdfUrl helper
      const resolvedUrl = await resolvePdfUrl(path);
      if (resolvedUrl) {
        setPdfModalUrl(resolvedUrl);
        return;
      }

      // 4. Fallback: search local DBService validations for inline PDF base64 string or matching record
      const allVals = await DBService.getValidations();
      const safeAllVals = Array.isArray(allVals) ? allVals : [];
      const match = safeAllVals.find(v => 
        v.pdfPath === path || 
        v.id === path || 
        (v.rawData as any)?.pdf_path === path || 
        (v.rawData as any)?.pdfPath === path ||
        (v.rawData as any)?.pdf === path
      );

      const inline = match?.pdfPath || (match?.rawData as any)?.pdf || (match?.rawData as any)?.pdfData;
      if (inline) {
        setPdfModalUrl(inline);
        return;
      }

      setStatus({ type: 'error', message: `Could not load PDF document for "${path}".` });
    } catch (err) {
      console.error('Error resolving PDF:', err);
      setStatus({ type: 'error', message: 'Failed to load PDF preview.' });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const dataURIToBlob = (dataURI: string) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    // Validation
    if (!isConnected) {
      setStatus({ type: 'error', message: 'Google Sheets integration is not configured. Please check your environment variables.' });
      setIsSubmitting(false);
      return;
    }
    if (!validateStep(1) || !validateStep(2)) {
      setIsSubmitting(false);
      return;
    }
    if (!formData.complianceOfficer || !formData.complianceSignature || !formData.confirmationName || !formData.designation || !formData.dboSignature) {
      setStatus({ type: 'error', message: 'Please complete all signature fields before submitting.' });
      setIsSubmitting(false);
      return;
    }
    const hasUnderDeclaration = formData.sales.some(sale => (parseFloat(sale.underDeclared) || 0) > 0);
    const isOffenseRequired = hasUnderDeclaration;

    if (!declarations.accurate || (isOffenseRequired && !declarations.offense) || !declarations.awareness) {
      setStatus({ type: 'error', message: 'Please check all required declaration boxes below before submitting.' });
      setIsSubmitting(false);
      return;
    }

    if (showReconciliation || !reconciliationResolved) {
      setStatus({ type: 'error', message: 'Please resolve the 7-point data reconciliation conflict before submitting.' });
      setIsSubmitting(false);
      return;
    }

    // Duplicate check
    if (!isAmendment) {
      const isDuplicate = lastCollections.some(c => c.fullPeriod.toLowerCase() === formData.validationPeriod.toLowerCase());
      if (isDuplicate) {
        setStatus({ type: 'error', message: `Data for ${formData.validationPeriod} has already been collected for this Premise. Please verify the validation period.` });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Preserve locked endTime from draft state, amendment, or manual entry; fallback to current time
      const endTime = formData.endTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updatedData = { 
        ...formData, 
        endTime,
        isBranchFacility,
        isBranch: isBranchFacility,
        validationPremiseMode,
        sales: isBranchFacility 
          ? formData.sales.map(s => ({ ...s, qtyDeclared: '', underDeclared: '', projectedQty: '' }))
          : formData.sales,
        nonCompliance: isBranchFacility ? [] : formData.nonCompliance
      };
      setFormData(updatedData);

      const pdf = await generatePDF(updatedData);

      // Update Clients module registry with the current 7-point profile reconciliation fields upon validation submission
      const formattedPermitNo = formatPermitNumber(updatedData.permitNo, updatedData.category, new Date(updatedData.date).getFullYear() || new Date().getFullYear());
      const formattedExpiryDate = formatDateToDDMMYYYY(updatedData.expiryDate);

      let targetClient = selectedClient;
      if (!targetClient && clients.length > 0) {
        targetClient = findMatchingClient(updatedData.permitNo, updatedData.dboName) || null;
      }
      if (!targetClient && clients.length > 0) {
        const cleanPermit = (s: any) => (String(s || '')).toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');
        const cleanStr = (s: any) => (String(s || '')).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const pTerm = cleanPermit(updatedData.permitNo);
        const dTerm = cleanStr(updatedData.dboName);
        const premTerm = cleanStr(updatedData.premiseName);

        targetClient = clients.find(c => {
          const cId = String(c.id || '').trim();
          if (cId && updatedData.permitNo && cId.toLowerCase() === updatedData.permitNo.toLowerCase()) return true;
          const cP = cleanPermit(c.permitNumber || c.id);
          if (pTerm && cP && (pTerm === cP || pTerm.includes(cP) || cP.includes(pTerm))) return true;
          const cN = cleanStr(c.clientName);
          const cPrem = cleanStr(c.premiseName);
          if (dTerm && cN && (dTerm === cN || dTerm.includes(cN) || cN.includes(dTerm)) &&
              premTerm && cPrem && (premTerm === cPrem || premTerm.includes(cPrem) || cPrem.includes(premTerm))) return true;
          if (dTerm && cN && dTerm === cN) return true;
          return false;
        }) || null;
      }

      if (targetClient) {
        const syncedClient: LicensedClient = {
          ...targetClient,
          clientName: updatedData.dboName.trim() || targetClient.clientName,
          premiseName: updatedData.premiseName.trim() || targetClient.premiseName,
          id: targetClient.id,
          permitNumber: formattedPermitNo || targetClient.permitNumber || targetClient.id,
          location: updatedData.location.trim() || targetClient.location,
          premiseCategory: (updatedData.category as any) || targetClient.premiseCategory,
          tel: updatedData.contacts.trim() || targetClient.tel,
          expiryDate: formattedExpiryDate || targetClient.expiryDate
        };

        if (validationPremiseMode === 'new') {
          const newBranch = {
            id: formattedPermitNo,
            premiseName: updatedData.premiseName.trim(),
            permitNumber: formattedPermitNo,
            premiseCategory: updatedData.category,
            location: updatedData.location.trim(),
            county: updatedData.county.trim(),
            expiryDate: formattedExpiryDate || undefined,
            operationalStatus: 'operating' as const
          };
          const currentBranches = syncedClient.branches || [];
          if (!currentBranches.some(b => b.permitNumber === newBranch.permitNumber)) {
            syncedClient.branches = [...currentBranches, newBranch];
          }
        } else if (validationPremiseMode.startsWith('branch-')) {
          const branchId = validationPremiseMode.replace('branch-', '');
          const currentBranches = syncedClient.branches || [];
          syncedClient.branches = currentBranches.map(b => {
            if (b.id === branchId) {
              return {
                ...b,
                premiseName: updatedData.premiseName.trim(),
                permitNumber: formattedPermitNo,
                premiseCategory: updatedData.category,
                location: updatedData.location.trim(),
                county: updatedData.county.trim(),
                expiryDate: formattedExpiryDate || undefined
              };
            }
            return b;
          });
        }

        await DBService.saveClient(syncedClient);
        const refreshedClients = await DBService.getClients(true);
        setClients(refreshedClients);
      } else {
        // Create new client profile in licensed_clients registry
        const newClientRecord: LicensedClient = {
          id: formattedPermitNo,
          clientName: updatedData.dboName.trim(),
          premiseName: updatedData.premiseName.trim(),
          startYear: new Date(updatedData.date).getFullYear() || new Date().getFullYear(),
          startMonth: 'January',
          startDate: formatDateToDDMMYYYY(updatedData.date),
          endYear: null,
          endMonth: null,
          tel: updatedData.contacts.trim(),
          contactPerson: updatedData.dboName.trim(),
          location: updatedData.location.trim(),
          premiseCategory: (updatedData.category as any) || 'Milk Bar',
          county: updatedData.county.trim() || 'Kericho',
          permitStatus: 'active',
          operationalStatus: 'operating',
          levyInfo: 'QFR',
          expiryDate: formattedExpiryDate || undefined
        };
        await DBService.saveClient(newClientRecord);
        const refreshedClients = await DBService.getClients(true);
        setClients(refreshedClients);
      }

      // Prepare payload & PDF reference
      const fileName = isAmendment
        ? `${updatedData.premiseName.replace(/\s+/g, '_')}_${updatedData.validationPeriod.replace(/\s+/g, '_')}_Amended_v2_${Date.now()}.pdf`
        : `${updatedData.premiseName.replace(/\s+/g, '_')}_${updatedData.validationPeriod.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

      const pdfPath = fileName;

      // 1. Non-blocking background PDF upload to Supabase storage
      if (supabase) {
        (async () => {
          try {
            const pdfBlob = dataURIToBlob(pdf);
            for (const bucket of ['ValidationPdfs', 'validationPdfs', 'validation-pdfs']) {
              try {
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from(bucket)
                  .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

                if (!uploadError && uploadData?.path) break;
              } catch (bErr) {
                // Continue to next bucket
              }
            }
          } catch (uploadErr) {
            console.warn('Background PDF upload warning:', uploadErr);
          }
        })();
      }

      const nowIso = new Date().toISOString();

      const payloadRawData: any = {
        ...updatedData,
        submittedAt: nowIso,
        submitted_at: nowIso,
        created_at: nowIso,
        createdAt: nowIso,
        timestamp: nowIso,
        updated_at: nowIso,
        validatedAt: updatedData.date || nowIso,
        validated_at: updatedData.date || nowIso,
        pdf: pdf,
        pdf_path: pdfPath,
        pdfPath: pdfPath
      };

      // Generate valid UUID for Supabase PostgreSQL UUID primary key
      const valUuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

      payloadRawData.uuid = valUuid;

      // Exact columns matching remote Supabase schema with explicit timestamp fields
      const supabaseRow: Record<string, any> = {
        id: valUuid,
        dbo_name: updatedData.dboName || '',
        premise_name: updatedData.premiseName || '',
        branch: updatedData.county ? (updatedData.county.trim() || 'Kericho') : 'Kericho',
        date: updatedData.date || nowIso.split('T')[0],
        created_at: nowIso,
        submitted_at: nowIso,
        timestamp: nowIso,
        updated_at: nowIso,
        validation_period: updatedData.validationPeriod || '',
        category: updatedData.category || '',
        permit_no: updatedData.permitNo || '',
        location: updatedData.location || '',
        county: updatedData.county?.trim() || 'Kericho',
        total_penalty: 0,
        raw_data: payloadRawData,
        pdf_path: pdfPath
      };

      // 2. Direct Supabase kdb_validations & data_validations sync
      const supabaseSyncPromise = (async () => {
        if (!supabase) return;
        try {
          if (isAmendment) {
            const updatePayload: Record<string, any> = {
              dbo_name: supabaseRow.dbo_name,
              premise_name: supabaseRow.premise_name,
              branch: supabaseRow.branch,
              date: supabaseRow.date,
              created_at: supabaseRow.created_at,
              submitted_at: supabaseRow.submitted_at,
              timestamp: supabaseRow.timestamp,
              updated_at: supabaseRow.updated_at,
              category: supabaseRow.category,
              permit_no: supabaseRow.permit_no,
              location: supabaseRow.location,
              county: supabaseRow.county,
              total_penalty: supabaseRow.total_penalty,
              validation_period: supabaseRow.validation_period,
              pdf_path: supabaseRow.pdf_path,
              raw_data: payloadRawData
            };

            const safeUpdate = async (tableName: string) => {
              let payload = { ...updatePayload };
              const matchFilter = {
                premise_name: updatedData.premiseName,
                validation_period: updatedData.validationPeriod
              };
              for (let attempt = 0; attempt < 6; attempt++) {
                const { error } = await supabase.from(tableName).update(payload).match(matchFilter);
                if (!error) return;
                const errMsg = error.message || '';
                const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                              || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                              || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
                if (matchCol && matchCol[1] && payload.hasOwnProperty(matchCol[1])) {
                  delete payload[matchCol[1]];
                  continue;
                }
                console.warn(`[DataValidation] Update on ${tableName} warning:`, error.message);
                break;
              }
            };

            await Promise.allSettled([
              safeUpdate('kdb_validations'),
              safeUpdate('data_validations')
            ]);
          } else {
            const safeUpsert = async (tableName: string) => {
              let payload = { ...supabaseRow };
              for (let attempt = 0; attempt < 6; attempt++) {
                const { error } = await supabase.from(tableName).upsert([payload]);
                if (!error) return;
                const errMsg = error.message || '';
                const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                              || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                              || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
                if (matchCol && matchCol[1] && payload.hasOwnProperty(matchCol[1])) {
                  delete payload[matchCol[1]];
                  continue;
                }
                console.warn(`[DataValidation] Upsert on ${tableName} warning:`, error.message);
                break;
              }
            };

            await Promise.allSettled([
              safeUpsert('kdb_validations'),
              safeUpsert('data_validations')
            ]);
          }
        } catch (sbErr) {
          console.warn('Supabase validation sync error:', sbErr);
        }
      })();

      // 3. Always save to DBService for guaranteed local persistence & history tracking
      const dataValObject: DataValidation = {
        id: valUuid,
        clientId: updatedData.permitNo || '',
        clientName: updatedData.dboName || '',
        premiseName: updatedData.premiseName || '',
        permitNo: updatedData.permitNo || '',
        location: updatedData.location || '',
        category: updatedData.category || '',
        contacts: updatedData.contacts || '',
        expiryDate: updatedData.expiryDate || '',
        year: new Date(updatedData.date).getFullYear() || 2026,
        period: updatedData.validationPeriod || '',
        quantityDeclared: updatedData.sales?.[0]?.qtyDeclared || '',
        unitPrice: parseFloat(updatedData.sales?.[0]?.buyingPrice) || 0,
        totalSales: updatedData.sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.qtyDeclared) || 0) * (parseFloat(s.buyingPrice) || 0), 0) || 0,
        validatorName: updatedData.complianceOfficer || '',
        validatedAt: updatedData.date || new Date().toISOString(),
        status: 'Approved',
        remarks: updatedData.comments || '',
        monthsCount: Array.isArray(updatedData.sales) && updatedData.sales.length > 0 ? updatedData.sales.length : 1,
        pdfPath: pdfPath || pdf,
        rawData: payloadRawData
      };

      // 4. Concurrent execution of DBService save, Google Sheets submission, and Supabase sync
      const [, submitRes] = await Promise.all([
        Promise.all([DBService.saveValidation(dataValObject), supabaseSyncPromise]),
        fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updatedData, pdf, isAmendment }),
        })
      ]);

      // Revalidate cache in background without blocking UI
      setTimeout(() => {
        DBService.getValidations(true).catch(e => console.warn('Background getValidations error:', e));
      }, 50);

      if (submitRes.ok) {
        setStatus({ type: 'success', message: 'Data successfully synced! Your PDF is downloading...' });
        
        // Trigger PDF Download
        const link = document.createElement('a');
        link.href = pdf;
        const downloadName = isAmendment 
          ? `KDB_Validation_${formData.dboName}_${formData.date}_Amended_v2.pdf`
          : `KDB_Validation_${formData.dboName}_${formData.date}.pdf`;
        link.download = downloadName;
        link.click();

        // Clear local storage draft and manual override edits
        localStorage.removeItem('kdb_validation_form_draft_v2');
        localStorage.removeItem('kdb_validation_form_draft');
        localStorage.removeItem('kdb_validation_form_draft_step');
        setHasDraft(false);
        setDraftInfo(null);
        setDraftLastSaved(null);
        setIsValidationPeriodEdited(false);
        setIsAmendment(false);

        // Once the draft is submitted and synced, it ceases as draft to become a validation sent to sheets and validations table
        if (activeDraftId) {
          try {
            await DBService.deleteValidationDraft(activeDraftId);
          } catch (delDraftErr) {
            console.warn('Failed to delete active draft from Supabase:', delDraftErr);
          }
          setActiveDraftId(null);
        } else {
          try {
            const currentDrafts = await DBService.getValidationDrafts();
            const matching = currentDrafts.filter(d => 
              (d.permitNo && d.permitNo === formData.permitNo) || 
              (d.premiseName && formData.premiseName && d.premiseName.trim().toLowerCase() === formData.premiseName.trim().toLowerCase())
            );
            for (const d of matching) {
              await DBService.deleteValidationDraft(d.id);
            }
          } catch (_) {}
        }
        refreshDraftsList();

        setFormData(initialData);
        setStep(0); // Go back to start
      } else {
        const error: any = await submitRes.json();
        throw new Error(error.error || 'Submission failed');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'CP>5,000 L/D', 'CP<5,000 L/D', 'Cottage Industry', 'Milk Bar', 
    'Mini Dairy', 'Dispenser', 'Processor'
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = ['2025', '2026', '2027'];

  const dboSigPad = useRef<SignatureCanvas>(null);

  const compressImage = (base64: string, maxWidth = 800, maxHeight = 800, transparent = false): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          if (!transparent) {
            // Fill with white background to avoid black background on JPEGs with transparency
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', 0.8));
      };
      img.onerror = () => resolve(base64); // Fallback
    });
  };

  const extractStamp = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(base64);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate brightness
          const brightness = (r + g + b) / 3;
          
          // If the pixel is bright (white-ish background), make it transparent
          // We use a threshold to remove shadows on paper
          if (brightness > 170) {
            data[i + 3] = 0; 
          } else {
            // Ensure the ink is fully opaque and slightly enhanced
            data[i + 3] = 255;
            // Optional: darken dark pixels to make stamp crisper
            if (brightness < 100) {
              data[i] = Math.max(0, r - 20);
              data[i+1] = Math.max(0, g - 20);
              data[i+2] = Math.max(0, b - 20);
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(base64);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'complianceSignature' | 'dboSignature' | 'dboStamp') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let result = reader.result as string;
        if (field === 'dboStamp') {
          // First extract the stamp (remove background)
          result = await extractStamp(result);
          // Then compress/resize while keeping transparency
          const processed = await compressImage(result, 800, 800, true);
          setFormData(prev => ({ ...prev, [field]: processed }));
        } else {
          const compressed = await compressImage(result);
          setFormData(prev => ({ ...prev, [field]: compressed }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearField = (field: 'complianceSignature' | 'dboSignature' | 'dboStamp') => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const handleSelectAuthoritySignature = (sig: AuthoritySignature) => {
    setFormData(prev => ({
      ...prev,
      complianceSignature: sig.signature,
      complianceOfficer: sig.name || prev.complianceOfficer
    }));
    setFailedFields(prev => prev.filter(f => f !== 'complianceSignature' && f !== 'complianceOfficer'));
    setIsSelectingAuthoritySig(false);
  };

  const handleClearComplianceSignature = () => {
    setFormData(prev => ({
      ...prev,
      complianceSignature: ''
    }));
    setIsSelectingAuthoritySig(true);
  };

  const handleDeleteAuthoritySignature = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sigToDelete = authoritySignatures.find(s => s.id === id);
    const confirmMsg = sigToDelete?.name 
      ? `Delete authority signature for "${sigToDelete.name}" from your saved signatures library?`
      : 'Delete this authority signature?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const updated = await DBService.deleteAuthoritySignature(id);
      setAuthoritySignatures(updated);
      // If currently selected signature was deleted, reset complianceSignature so user can pick another
      if (sigToDelete && formData.complianceSignature === sigToDelete.signature) {
        setFormData(prev => ({ ...prev, complianceSignature: '' }));
      }
    } catch (err) {
      console.error('Failed to delete authority signature:', err);
    }
  };

  const handleMoveAuthoritySignature = async (id: string, direction: 'up' | 'down', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await DBService.moveAuthoritySignature(id, direction);
      setAuthoritySignatures(updated);
    } catch (err) {
      console.error('Failed to move authority signature:', err);
    }
  };

  const handleNewSigFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      let result = reader.result as string;
      try {
        result = await compressImage(result, 800, 400, true);
      } catch (_) {}
      setNewSigPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewAuthoritySignature = async () => {
    const trimmedName = newOfficerName.trim();
    if (!trimmedName) {
      alert('Please enter the officer name for this authority signature.');
      return;
    }

    let finalSig = newSigPreview;
    if (newSigMode === 'draw') {
      if (!authSigCanvasRef.current || authSigCanvasRef.current.isEmpty()) {
        alert('Please draw the authority signature before saving.');
        return;
      }
      const rawData = authSigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      try {
        finalSig = await compressImage(rawData, 800, 400, true);
      } catch (_) {
        finalSig = rawData;
      }
    }

    if (!finalSig) {
      alert('Please provide a signature image or draw a signature.');
      return;
    }

    setIsSavingNewSig(true);
    try {
      const newSigObj: AuthoritySignature = {
        id: 'auth-sig-' + Date.now(),
        name: trimmedName,
        title: newOfficerTitle.trim() || undefined,
        signature: finalSig,
        createdAt: new Date().toISOString()
      };

      const updated = await DBService.addAuthoritySignature(newSigObj);
      setAuthoritySignatures(updated);

      // Automatically apply this signature to the current form!
      setFormData(prev => ({
        ...prev,
        complianceSignature: newSigObj.signature,
        complianceOfficer: newSigObj.name
      }));
      setFailedFields(prev => prev.filter(f => f !== 'complianceSignature' && f !== 'complianceOfficer'));

      // Reset and close modal
      setNewOfficerName('');
      setNewOfficerTitle('');
      setNewSigPreview('');
      if (authSigCanvasRef.current) authSigCanvasRef.current.clear();
      setShowAddAuthorityModal(false);
      setIsSelectingAuthoritySig(false);
    } catch (err) {
      console.error('Error saving new authority signature:', err);
      alert('Failed to save authority signature.');
    } finally {
      setIsSavingNewSig(false);
    }
  };

  const saveDboSignature = async () => {
    if (dboSigPad.current && !dboSigPad.current.isEmpty()) {
      const sigData = dboSigPad.current.getTrimmedCanvas().toDataURL('image/png');
      const compressed = await compressImage(sigData);
      setFormData(prev => ({ ...prev, dboSignature: compressed }));
    }
  };

  const handleClearEntries = () => {
    if (window.confirm("Are you sure you want to clear all form entries?")) {
      // Clear drafts from storage
      localStorage.removeItem('kdb_validation_form_draft_v2');
      localStorage.removeItem('kdb_validation_form_draft');
      localStorage.removeItem('kdb_validation_form_draft_step');

      // Reset form data and step without page refresh
      setFormData(initialData);
      setStep(0);
      setSelectedClient(null);
      setValidationPremiseMode('main');
      setMismatchFields([]);
      setShowReconciliation(false);
      setReconciliationResolved(true);
      setHasDraft(false);
      setDraftInfo(null);
      setDraftLastSaved(null);
      setActiveDraftId(null);
      setIsAmendment(false);
      setIsValidationPeriodEdited(false);
      setHasAutofilledDbo(false);
      setFailedFields([]);
      setLastCollections([]);
      setLastDboRecords([]);
      setHistoryError(null);
      setDboError(null);
      setIsCheckingHistory(false);
      setIsCheckingDbo(false);
      setDeclarations({
        accurate: false,
        offense: false,
        awareness: false
      });
      setPdfPreview(null);
      setPdfModalUrl(null);
      setStatus({ type: 'success', message: 'All form entries cleared successfully.' });
      if (dboSigPad.current) {
        try { dboSigPad.current.clear(); } catch (_) {}
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-[#1a1a1a] font-sans p-2 md:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Connection Status & Quick Reset Banner */}
        <div className="mb-4 bg-white rounded-xl p-3 md:p-4 shadow-sm border border-black/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <p className="text-xs font-semibold text-gray-900">Google Sheets Sync</p>
                <p className="text-[10px] text-gray-500">{isConnected ? 'Service Account Active' : 'Credentials Missing'}</p>
              </div>
            </div>
            {isConnected && (
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Ready to Sync</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {draftLastSaved && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Draft saved at {draftLastSaved}</span>
              </div>
            )}

            {step > 0 && (
              <div className="flex items-center bg-gray-100/90 p-0.5 rounded-lg border border-gray-200 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1) setStep(0);
                    else if (step === 2) setStep(1);
                    else if (step === 3) setStep(2);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-all text-xs font-medium cursor-pointer"
                  title="Go back to previous step"
                  id="top-banner-back-btn"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (step === 1) {
                      validateStep(1) && setStep(2);
                    } else if (step === 2) {
                      validateStep(2) && setStep(3);
                    } else if (step === 3) {
                      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-all text-xs font-medium cursor-pointer"
                  title={step === 3 ? "Scroll to Submit section" : "Go to next step"}
                  id="top-banner-next-btn"
                >
                  <span>{step === 3 ? "To Submit" : "Next"}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <span className="w-px h-3.5 bg-gray-300 mx-0.5" />

                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
                  className="flex items-center gap-1 px-2.5 py-1 text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all text-xs font-medium cursor-pointer"
                  title="Scroll smoothly to bottom of page"
                  id="top-banner-scroll-bottom-btn"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Bottom</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsDraftsModalOpen(true)}
              className="relative w-full sm:w-auto px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              title="View all saved validation drafts in Supabase"
              id="view-saved-drafts-btn"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Saved Drafts</span>
              {draftsList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 ml-0.5">
                  {draftsList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleManualSaveDraft}
              disabled={isSubmittingDraft}
              className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
              title="Save current form entries to Supabase draft"
              id="top-save-draft-btn"
            >
              {isSubmittingDraft ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{isSubmittingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearEntries}
              className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              title="Clear all form entries"
              id="clear-entries-btn"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Clear Entries
            </button>
          </div>
        </div>

        {/* Active Draft Banner */}
        <AnimatePresence>
          {activeDraftId && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 overflow-hidden"
              id="active-draft-mode-banner"
            >
              <div className="p-3.5 bg-blue-50/90 border border-blue-200 text-blue-950 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <Database className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-900">Draft Mode Active</p>
                      <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-mono font-bold">
                        Supabase Draft: {activeDraftId.slice(0, 8)}...
                      </span>
                    </div>
                    <p className="text-xs text-blue-800 font-medium mt-0.5">
                      Editing draft for <strong className="text-blue-950 font-bold">{formData.dboName || formData.premiseName || 'Current Premise'}</strong> ({formData.validationPeriod || 'Current Period'}).
                      {formData.startTime && <span> Start: <strong className="text-blue-950 font-semibold">{formData.startTime}</strong></span>}
                      {formData.endTime ? (
                        <span> &bull; End (Locked): <strong className="text-blue-950 font-bold bg-blue-200/60 px-1.5 py-0.5 rounded">{formData.endTime}</strong></span>
                      ) : (
                        <span> &bull; End: <span className="italic text-blue-600">Locks on draft save / submit</span></span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDraftId(null);
                      setStatus({ type: 'success', message: 'Exited draft editing mode. Your draft remains stored safely in Supabase.' });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    id="exit-draft-mode-btn"
                  >
                    Exit Draft Mode
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Draft Restore Alert */}
        <AnimatePresence>
          {hasDraft && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 overflow-hidden"
              id="draft-restore-alert"
            >
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Unsaved Draft Available</p>
                      {draftInfo?.savedTime && (
                        <span className="text-[10px] bg-amber-200/70 text-amber-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {draftInfo.savedTime}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                      {draftInfo?.clientOrDbo ? (
                        <>Draft for <strong className="text-amber-900 font-semibold">{draftInfo.clientOrDbo}</strong>{draftInfo.period ? ` (${draftInfo.period})` : ''} at Step {(draftInfo.step ?? 0) === 0 ? '1 (Search)' : (draftInfo.step ?? 0) + 1}.</>
                      ) : (
                        'You have an unfinished validation draft. Would you like to restore it?'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleRestoreDraft()}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    id="restore-draft-btn"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Draft
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-100 text-amber-700 text-xs font-bold transition-all cursor-pointer"
                    id="discard-draft-btn"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Amendment Mode Alert */}
        <AnimatePresence>
          {isAmendment && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 overflow-hidden"
              id="amendment-mode-alert"
            >
              <div className="p-4 bg-amber-100 border border-amber-300 text-amber-950 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-amber-200 flex items-center justify-center text-amber-800">
                    <Edit2 className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">✏️ Amendment Mode Active</p>
                    <p className="text-xs text-amber-800 font-medium">
                      You are amending the validation report for <span className="font-bold">{formData.premiseName || 'this Premise'}</span> ({formData.validationPeriod}). Saving will overwrite the previous submission and sheets record.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(initialData);
                      setIsAmendment(false);
                      setStep(0);
                      setStatus({ type: 'success', message: 'Amendment cancelled.' });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                    id="cancel-amendment-btn"
                  >
                    Cancel Amendment
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Status Message */}
        <AnimatePresence>
          {status.message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">{status.message}</p>
                <button onClick={() => setStatus({ type: null, message: '' })} className="ml-auto text-gray-400 hover:text-gray-600">
                  &times;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-lg border border-black/5 overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-gray-100">
            <motion.div 
              className="h-full bg-blue-600"
              initial={{ width: '0%' }}
              animate={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 space-y-6"
                >
                  <ClipboardCheck className="w-20 h-20 text-blue-600" />
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Ready to start validation?</h2>
                    <p className="text-gray-500">Click the button below to begin the data collection process.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-blue-700 transition-all active:scale-95 cursor-pointer"
                  >
                    Start New Validation
                  </button>

                  {draftsList.length > 0 && (
                    <div className="w-full max-w-xl mt-8 pt-8 border-t border-gray-100 flex flex-col items-center">
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                          <Database className="w-4 h-4 text-amber-600" />
                          <span>Saved Drafts in Supabase ({draftsList.length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDraftsModalOpen(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                        >
                          View all ({draftsList.length}) <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="w-full space-y-2">
                        {draftsList.slice(0, 3).map((draft) => {
                          const raw = draft.rawData || draft.raw_data || {};
                          const form = raw.formData || draft;
                          const name = draft.dboName || draft.dbo_name || form.dboName || 'Saved Draft';
                          const premise = draft.premiseName || draft.premise_name || form.premiseName || '';
                          const period = draft.validationPeriod || draft.validation_period || form.validationPeriod || '';
                          const stepNum = draft.step !== undefined ? draft.step : (raw.step ?? 1);
                          return (
                            <div 
                              key={draft.id}
                              className="w-full p-3.5 bg-amber-50/60 hover:bg-amber-50 rounded-xl border border-amber-200/70 flex items-center justify-between gap-3 transition-colors text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-xs truncate">{name}</span>
                                  {premise && (
                                    <span className="text-[10px] text-gray-600 font-medium truncate">
                                      &bull; {premise}
                                    </span>
                                  )}
                                  {period && (
                                    <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                                      {period}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span>Step {stepNum === 0 ? '1 (Search)' : stepNum + 1} of 4</span>
                                  <span>&bull;</span>
                                  <span>Permit: {draft.permitNo || 'N/A'}</span>
                                  {form.startTime && (
                                    <>
                                      <span>&bull;</span>
                                      <span>Start: {form.startTime}</span>
                                    </>
                                  )}
                                  {form.endTime && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="text-amber-800 font-semibold bg-amber-100/70 px-1 py-0.2 rounded">
                                        End (Locked): {form.endTime}
                                      </span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreDraft(draft)}
                                  className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteDraft(draft.id, e)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                  title="Delete draft from Supabase"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                      <h2 className="text-lg font-bold">General Information</h2>
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerManualReconciliation}
                      className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      id="step1-manual-reconcile-btn"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      7-Point Reconciliation Check
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Row: Reduced Branch box to accommodate Date, Start Time and End Time on larger screens */}
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                        <div className="space-y-2 sm:col-span-1 lg:col-span-3">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Branch</label>
                          <input
                            type="text"
                            name="branch"
                            value={formData.branch}
                            onChange={handleChange}
                            placeholder="e.g. Main / Branch"
                            className={getInputClass('branch')}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-1 lg:col-span-3">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
                          <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            className={getInputClass('date')}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-1 lg:col-span-3">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start Time</label>
                          <input
                            type="text"
                            name="startTime"
                            readOnly
                            value={formData.startTime}
                            placeholder="Auto on start"
                            className="w-full px-3.5 py-2 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 outline-none text-sm"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-1 lg:col-span-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">End Time</label>
                            {formData.endTime && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                                Locked
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            name="endTime"
                            value={formData.endTime}
                            onChange={handleChange}
                            placeholder="Auto on draft / submit"
                            className={getInputClass('endTime', '', 'px-3.5 py-2 rounded-xl text-sm')}
                            title={formData.endTime ? 'End time is locked in draft. You can edit if needed.' : 'Automatically locked when saving draft or submitting'}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Permit No</label>
                      <input
                        type="text"
                        name="permitNo"
                        placeholder="KDB / ..."
                        value={formData.permitNo}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        className={getInputClass('permitNo')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expiry Date</label>
                      <input
                        type="date"
                        name="expiryDate"
                        min="2021-01-01"
                        max={`${new Date().getFullYear() + 1}-12-31`}
                        value={formData.expiryDate}
                        onChange={handleChange}
                        className={getInputClass('expiryDate')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name of DBO</label>
                      <input
                        type="text"
                        name="dboName"
                        value={formData.dboName}
                        onChange={handleChange}
                        onBlur={handleInputBlur}
                        className={getInputClass('dboName')}
                        placeholder="Enter DBO name..."
                      />
                      {isCheckingDbo && (
                        <p className="text-[10px] text-blue-500 font-medium mt-1 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Checking previous validations...
                        </p>
                      )}
                      
                      <AnimatePresence>
                        {lastDboRecords.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 space-y-2 overflow-hidden"
                          >
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight flex items-center gap-1">
                              <Database className="w-3.5 h-3.5 text-emerald-600" />
                              Previous Validations Found: Click to Autofill
                            </p>
                            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                              {lastDboRecords.map((record, index) => {
                                const raw = record.raw_data || {};
                                const premise = record.premise_name || 'Unknown Premise';
                                const category = record.category || 'Unknown';
                                const location = record.location || 'Unknown';
                                const pNo = record.permit_no || 'N/A';
                                
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleDboAutofill(record)}
                                    className="w-full text-left p-2 rounded-lg bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-[11px] group flex flex-col gap-0.5"
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <span className="font-bold text-gray-800 group-hover:text-emerald-900 truncate">
                                        {premise}
                                      </span>
                                      <span className="text-[9px] font-mono text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded-md">
                                        {category}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex justify-between items-center mt-0.5">
                                      <span>Permit: {pNo} | Loc: {location}</span>
                                      <span className="text-[9px] text-emerald-800 font-bold font-mono">
                                        {(() => {
                                          if (record.date) {
                                            const d = new Date(record.date);
                                            if (!isNaN(d.getTime())) {
                                              return d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                            }
                                          }
                                          if (raw.validationPeriod) return raw.validationPeriod;
                                          return 'Validated';
                                        })()}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {lastCollections.length > 0 && (() => {
                        const nextMonthStr = getNextMonthToValidate(lastCollections[0]);
                        if (nextMonthStr) {
                          return (
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight mt-1.5 flex items-center gap-1 bg-emerald-50/80 px-2.5 py-1 rounded-md border border-emerald-200/60 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Next Month to Validate: <span className="text-emerald-900 font-extrabold">{nextMonthStr}</span>
                            </p>
                          );
                        }
                        return null;
                      })()}

                      {/* Branch Operations Check Prompt Card */}
                      <div className="mt-3 p-4 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20 border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                              Branch Operations Check
                            </span>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-800 border border-blue-200/60">
                            Required
                          </span>
                        </div>
                        
                        <p className="text-[11px] font-semibold text-slate-600 leading-snug">
                          Does this Dairy Business Operator (DBO) operate multiple branches or premises?
                        </p>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleBranchPromptChange(false)}
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                              dboHasBranches === false
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>No — Single Premise</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleBranchPromptChange(true)}
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                              dboHasBranches === true
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span>Yes — Has Branches</span>
                          </button>
                        </div>

                        {dboHasBranches === false && (
                          <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-[10px] font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Single Standalone Premise: Validating as a direct primary facility with standard monthly return declarations.</span>
                          </div>
                        )}

                        {dboHasBranches === true && (
                          <div className="pt-2 border-t border-slate-200/70 space-y-2.5">
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                              Select Which Facility Is Being Validated:
                            </label>
                            
                            <div className="relative">
                              <select
                                value={validationPremiseMode}
                                onChange={e => handlePremiseModeChange(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-white focus:ring-4 focus:ring-slate-900/10 outline-none transition-all font-bold text-slate-800 text-[11px] cursor-pointer appearance-none"
                              >
                                <option value="main">
                                  🏢 Main Premise / HQ ({selectedClient?.premiseName || formData.premiseName || 'Primary Facility'})
                                </option>
                                {selectedClient?.branches && selectedClient.branches.map(br => (
                                  <option key={br.id} value={`branch-${br.id}`}>
                                    🏪 Branch: {br.premiseName} ({br.location}, Permit: {br.permitNumber})
                                  </option>
                                ))}
                                <option value="new">➕ Register / Validate as a NEW Branch under this DBO</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px] font-black uppercase">
                                Select ▾
                              </div>
                            </div>

                            {validationPremiseMode === 'new' && (
                              <div className="bg-amber-50 text-amber-800 border border-amber-200/70 p-2.5 rounded-xl text-[10px] font-bold leading-relaxed flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>You are validating a <strong>NEW Branch</strong>. Enter the branch name and location below. Upon submission, this branch will be automatically appended to the client's profile in the registry.</span>
                              </div>
                            )}

                            {validationPremiseMode.startsWith('branch-') && (
                              <div className="bg-blue-50 text-blue-800 border border-blue-200/70 p-2.5 rounded-xl text-[10px] font-bold leading-relaxed flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>You are validating an <strong>Existing Branch</strong>. Only branch-level operational sales are recorded; declared levy return quantities are consolidated at the Main HQ.</span>
                              </div>
                            )}

                            {validationPremiseMode === 'main' && (
                              <div className="bg-slate-100 text-slate-800 border border-slate-200 p-2.5 rounded-xl text-[10px] font-bold leading-relaxed flex items-start gap-2">
                                <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                                <span>Validating <strong>Main Premise / HQ</strong>: Consolidates declarations and records for the primary headquarters.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premise Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          name="premiseName"
                          value={formData.premiseName}
                          onChange={handleChange}
                          className={getInputClass('premiseName', 'pr-10')}
                          placeholder="Type premise name to check history..."
                        />
                        {isCheckingHistory && (
                          <div className="absolute right-3 top-2.5">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      {/* History Banner */}
                      <AnimatePresence>
                        {historyError && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 text-[10px] flex items-center gap-1.5"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {historyError}
                          </motion.div>
                        )}
                        {lastCollections.length > 0 && (() => {
                          const hasBranches = lastCollections.some(c => c.isBranchFacility);
                          const hasMain = lastCollections.some(c => !c.isBranchFacility);
                          const showFilterTabs = hasBranches && hasMain;

                          const filteredCollections = historyFilterMode === 'branch'
                            ? lastCollections.filter(c => c.isBranchFacility)
                            : historyFilterMode === 'main'
                              ? lastCollections.filter(c => !c.isBranchFacility)
                              : lastCollections;

                          const activeList = filteredCollections.length > 0 ? filteredCollections : lastCollections;
                          const nextMonthStr = getNextMonthToValidate(activeList[0]);

                          return (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 p-3 bg-blue-50/90 rounded-xl border border-blue-100 space-y-2.5 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-[11px] font-bold text-blue-900 uppercase tracking-tight">
                                        Validation History ({activeList[0]?.matchedPremise || formData.premiseName})
                                      </p>
                                      {validationPremiseMode.startsWith('branch-') ? (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                          Branch Mode
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                          Main Facility Mode
                                        </span>
                                      )}
                                    </div>

                                    {/* Optional Branch vs Main Filter Toggle */}
                                    {showFilterTabs && (
                                      <div className="flex items-center gap-1 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setHistoryFilterMode('all')}
                                          className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                            historyFilterMode === 'all'
                                              ? 'bg-blue-600 text-white shadow-xs'
                                              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                                          }`}
                                        >
                                          All ({lastCollections.length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setHistoryFilterMode('main')}
                                          className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                            historyFilterMode === 'main'
                                              ? 'bg-blue-600 text-white shadow-xs'
                                              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                                          }`}
                                        >
                                          HQ / Main ({lastCollections.filter(c => !c.isBranchFacility).length})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setHistoryFilterMode('branch')}
                                          className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all ${
                                            historyFilterMode === 'branch'
                                              ? 'bg-amber-600 text-white shadow-xs'
                                              : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                                          }`}
                                        >
                                          Branches ({lastCollections.filter(c => c.isBranchFacility).length})
                                        </button>
                                      </div>
                                    )}

                                    <div className="text-[10px] text-blue-700 mt-2 space-y-1.5">
                                      <div className="font-semibold text-slate-500 uppercase text-[9px] tracking-wider">
                                        Recent Validations:
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {activeList.slice(0, 4).map((c, i) => (
                                          <div
                                            key={i}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] ${
                                              c.isBranchFacility
                                                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                                                : 'bg-white border-blue-200 text-blue-900 shadow-xs'
                                            }`}
                                          >
                                            <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                              c.isBranchFacility
                                                ? 'bg-amber-200 text-amber-900'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {c.isBranchFacility ? 'Branch' : 'Main'}
                                            </span>
                                            <span className="font-bold">{c.displayString}</span>
                                            {c.matchedPremise && c.matchedPremise !== formData.premiseName && (
                                              <span className="text-[9px] text-slate-500 font-medium">
                                                ({c.matchedPremise})
                                              </span>
                                            )}
                                            <div className="flex items-center gap-1 ml-1">
                                              {c.pdfPath && (
                                                <button
                                                  type="button"
                                                  onClick={() => viewPdf(c.pdfPath!)}
                                                  className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors font-semibold"
                                                  title="View PDF"
                                                >
                                                  <FileText className="w-2.5 h-2.5" />
                                                  PDF
                                                </button>
                                              )}
                                              {c.rawData && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRecallSubmission(c.rawData)}
                                                  className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors font-semibold"
                                                  title="Amend this submission"
                                                >
                                                  <Edit2 className="w-2.5 h-2.5" />
                                                  Amend
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {nextMonthStr && (
                                <div className="pt-2 border-t border-blue-100/80 flex items-center gap-2 text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="text-[11px] font-bold uppercase tracking-tight">
                                    Next Month to Validate: <span className="text-emerald-950 font-black ml-1">{nextMonthStr}</span>
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })()}
                        {!isCheckingHistory && formData.premiseName.length >= 3 && lastCollections.length === 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[10px] font-medium flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            No previous records found for this Premise.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, category: cat }));
                          setFailedFields(prev => prev.filter(f => f !== 'category'));
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                          formData.category === cat 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                            : `bg-white text-gray-600 hover:border-blue-300 ${failedFields.includes('category') ? 'border-red-500 bg-red-50/20 ring-2 ring-red-100' : 'border-gray-200'}`
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contacts</label>
                      <input
                        type="text"
                        name="contacts"
                        value={formData.contacts}
                        onChange={handleChange}
                        className={getInputClass('contacts')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Validation Period</label>
                      <input
                        type="text"
                        name="validationPeriod"
                        value={formData.validationPeriod}
                        onChange={handleChange}
                        className={getInputClass('validationPeriod')}
                      />
                      {formData.validationPeriod && !isAmendment && lastCollections.some(c => c.fullPeriod.toLowerCase() === formData.validationPeriod.toLowerCase()) && (() => {
                        const matchingCollection = lastCollections.find(c => c.fullPeriod.toLowerCase() === formData.validationPeriod.toLowerCase());
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1.5 p-2 bg-amber-50 rounded-lg border border-amber-200 flex flex-col gap-1.5 text-[11px]"
                          >
                            <p className="text-amber-800 font-medium flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              This period has already been validated.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {matchingCollection?.pdfPath && (
                                <button
                                  type="button"
                                  onClick={() => viewPdf(matchingCollection.pdfPath!)}
                                  className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  View PDF
                                </button>
                              )}
                              {matchingCollection?.rawData && (
                                <button
                                  type="button"
                                  onClick={() => handleRecallSubmission(matchingCollection.rawData)}
                                  className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Load & Amend Submission
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">County</label>
                      <input
                        type="text"
                        name="county"
                        value={formData.county}
                        onChange={handleChange}
                        className={getInputClass('county', '', 'px-4 py-2 rounded-xl text-xs')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        className={getInputClass('location', '', 'px-4 py-2 rounded-xl text-xs')}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleManualSaveDraft}
                      className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all text-xs sm:text-sm border border-blue-200 cursor-pointer"
                      title="Save progress to draft"
                    >
                      <Save className="w-4 h-4 text-blue-600" />
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => validateStep(1) && setStep(2)}
                      className="w-full sm:w-auto flex justify-center items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
                    >
                      Next Step
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
                      <h2 className="text-lg font-bold">Volume & Sales Data</h2>
                    </div>
                    {/* General Unit Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 w-fit">
                      <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Active Unit:</span>
                      <button
                        type="button"
                        onClick={() => handleGlobalUnitChange('L')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          globalUnit === 'L'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Litres (L)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalUnitChange('Kg')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          globalUnit === 'Kg'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Kilograms (Kg)
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Intake Section - Conditional based on category */}
                  {(formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor') && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-blue-600 uppercase text-xs tracking-widest">Total Monthly Intake</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            {formData.intakes.length} {formData.intakes.length === 1 ? 'month' : 'months'} added
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, intakes: [...prev.intakes, { month: '', year: new Date().getFullYear().toString(), quantity: '', farmerPrice: '', processor: '', processorPrice: '', avgVolPerDay: '' }] }))}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          + Add Month ({formData.intakes.length})
                        </button>
                      </div>
                      
                      {formData.intakes.map((intake, idx) => (
                        <div key={idx} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 relative">
                            <button 
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, intakes: prev.intakes.filter((_, i) => i !== idx) }))}
                              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-lg font-bold"
                            >
                              &times;
                            </button>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Month</label>
                              <select
                                value={intake.month}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].month = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-month`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] bg-white transition-all ${
                                  failedFields.includes(`intake-${idx}-month`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              >
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Year</label>
                              <select
                                value={intake.year}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].year = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-year`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] bg-white transition-all ${
                                  failedFields.includes(`intake-${idx}-year`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Quantity ({globalUnit})</label>
                              <input
                                placeholder="0.00"
                                value={intake.quantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].quantity = val;
                                  // Formula: Quantity / 30
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) {
                                    newIntakes[idx].avgVolPerDay = (num / 30).toFixed(2);
                                  }
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-quantity`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] transition-all ${
                                  failedFields.includes(`intake-${idx}-quantity`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Farmer Price (Kshs)</label>
                              <input
                                placeholder="0.00"
                                value={intake.farmerPrice}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].farmerPrice = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-farmerPrice`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] transition-all ${
                                  failedFields.includes(`intake-${idx}-farmerPrice`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Processor</label>
                              <input
                                placeholder="Name"
                                value={intake.processor}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].processor = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-processor`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] transition-all ${
                                  failedFields.includes(`intake-${idx}-processor`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Processor Price (Kshs)</label>
                              <input
                                placeholder="0.00"
                                value={intake.processorPrice}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].processorPrice = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                  setFailedFields(prev => prev.filter(f => f !== `intake-${idx}-processorPrice`));
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg border outline-none text-[11px] transition-all ${
                                  failedFields.includes(`intake-${idx}-processorPrice`)
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Average Collection/Day ({globalUnit}/Day)</label>
                              <input
                                placeholder="0.00"
                                value={intake.avgVolPerDay}
                                onChange={(e) => {
                                  const newIntakes = [...formData.intakes];
                                  newIntakes[idx].avgVolPerDay = e.target.value;
                                  setFormData(prev => ({ ...prev, intakes: newIntakes }));
                                }}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 outline-none text-[11px] bg-gray-50 font-bold text-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* General Compliance / Produce Metadata Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50/50 rounded-3xl border border-gray-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Traceability & Records Available</label>
                      <div className="flex gap-4">
                        {['Yes', 'No'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, traceability: opt }))}
                            className={`flex-1 py-2 rounded-xl border font-bold text-xs transition-all ${
                              formData.traceability === opt 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                : 'bg-white border-gray-200 text-gray-600'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={`space-y-2 p-2.5 rounded-2xl transition-all ${failedFields.includes('natureOfProduce') ? 'bg-red-50/50 border border-red-300 ring-2 ring-red-100' : 'border border-transparent'}`}>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nature of Produce?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Pasteurized Milk', 'Raw Milk', 'Cultured Milk', 'Yoghurt', 'UHT', 'Ghee', 'Butter', 'Cheese', 'Milk Shake'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={formData.natureOfProduce.includes(opt)}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const newProduce = isChecked 
                                  ? [...formData.natureOfProduce, opt]
                                  : formData.natureOfProduce.filter(p => p !== opt);
                                
                                setFormData(prev => {
                                  // Update selling prices in all sales rows when produce selection changes
                                  const updatedSales = prev.sales.map(sale => {
                                    const currentPrices = parseSellingPrices(sale.sellingPrice || '');
                                    if (isChecked) {
                                      if (defaultProductPrices.sellingPrices[opt]) {
                                        currentPrices[opt] = defaultProductPrices.sellingPrices[opt];
                                      }
                                    } else {
                                      delete currentPrices[opt];
                                    }
                                    return {
                                      ...sale,
                                      sellingPrice: formatSellingPrices(currentPrices)
                                    };
                                  });
                                  return { ...prev, natureOfProduce: newProduce, sales: updatedSales };
                                });
                                setFailedFields(prev => prev.filter(f => f !== 'natureOfProduce'));
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-gray-600 group-hover:text-gray-900 transition-colors">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</label>
                      <input
                        type="text"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                          failedFields.includes('source')
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                            : 'border-gray-200 focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Merged Local Sales Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-blue-600 uppercase text-xs tracking-widest">Local Sales Data</h3>
                        {formData.hasLocalSales && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                            {formData.sales.length} {formData.sales.length === 1 ? 'month' : 'months'} added
                          </span>
                        )}
                        {(formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor') && (
                          <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            <input
                              type="checkbox"
                              checked={formData.hasLocalSales}
                              onChange={(e) => setFormData(prev => ({ ...prev, hasLocalSales: e.target.checked }))}
                              className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-[10px] font-bold text-blue-700 uppercase">Has Local Sales?</span>
                          </label>
                        )}
                      </div>
                      {formData.hasLocalSales && (
                        <button
                          type="button"
                          onClick={() => {
                            // Compute default selling price from section settings
                            const activeProducts = formData.natureOfProduce.length > 0 ? formData.natureOfProduce : ['Raw Milk'];
                            const defaultSellingObj: Record<string, string> = {};
                            activeProducts.forEach(prod => {
                              if (defaultProductPrices.sellingPrices[prod]) {
                                defaultSellingObj[prod] = defaultProductPrices.sellingPrices[prod];
                              }
                            });
                            const autoSellingStr = Object.keys(defaultSellingObj).length > 0 
                              ? formatSellingPrices(defaultSellingObj) 
                              : '';

                            // Compute default universal buying price
                            const defaultBuyingVal = defaultProductPrices.buyingPrice || '';

                            setFormData(prev => ({
                              ...prev,
                              sales: [...prev.sales, { 
                                month: '', 
                                year: new Date().getFullYear().toString(),
                                qtyDeclared: '', 
                                verifiedQty: '', 
                                projectedQty: '', 
                                underDeclared: '0', 
                                buyingPrice: defaultBuyingVal, 
                                sellingPrice: autoSellingStr, 
                                avgVolPerDay: '' 
                              }]
                            }));
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          + Add Month ({formData.sales.length})
                        </button>
                      )}
                    </div>

                    {/* Section: Universal Buying Price & Product-Specific Selling Prices Configuration */}
                    {formData.hasLocalSales && (
                      <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 rounded-2xl border border-blue-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                              Default Pricing Configuration (Auto-populates every added month)
                            </h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor'
                                ? 'Buying price is mirrored from intake records. Configure product selling prices below to auto-fill added months.'
                                : 'Set universal buying price and product-specific selling prices. These auto-fill added months and remain editable per month.'}
                            </p>
                          </div>
                        </div>

                        {/* Universal Buying Price (For categories where buying price is not mirrored from intakes) */}
                        {!(formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor') && (
                          <div className="p-3 bg-white rounded-xl border border-blue-100/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-800">Universal Buying Price</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Kshs</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5">Applies across all products for this entity.</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Buying Price:</label>
                              <input
                                type="text"
                                placeholder="0.00"
                                value={defaultProductPrices.buyingPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDefaultProductPrices(prev => ({
                                    ...prev,
                                    buyingPrice: val
                                  }));
                                  // Immediately propagate buying price to all existing sales months
                                  setFormData(prev => ({
                                    ...prev,
                                    sales: prev.sales.map(sale => ({
                                      ...sale,
                                      buyingPrice: val
                                    }))
                                  }));
                                  setFailedFields(prev => prev.filter(f => !f.includes('-buyingPrice')));
                                }}
                                className="w-32 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-xs text-right font-semibold text-gray-800"
                              />
                            </div>
                          </div>
                        )}

                        {/* Product-Specific Selling Prices */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-950 uppercase tracking-wider">Product Selling Prices</span>
                            <span className="text-[10px] text-gray-500">Per nature of produce</span>
                          </div>

                          {formData.natureOfProduce.length === 0 ? (
                            <div className="p-3 bg-white/80 rounded-xl border border-blue-100 text-center">
                              <p className="text-xs text-gray-500 italic">Please select at least one product in "Nature of Produce" above to configure selling prices.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {formData.natureOfProduce.map((product) => {
                                const sPrice = defaultProductPrices.sellingPrices[product] || '';

                                return (
                                  <div key={product} className="p-3 bg-white rounded-xl border border-blue-100/80 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                      <span className="text-xs font-bold text-gray-800">{product}</span>
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Kshs</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                      <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Selling Price:</label>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          placeholder="0.00"
                                          value={sPrice}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setDefaultProductPrices(prev => ({
                                              ...prev,
                                              sellingPrices: {
                                                ...prev.sellingPrices,
                                                [product]: val
                                              }
                                            }));

                                            // Immediately propagate selling price for this product to all existing sales months
                                            setFormData(prev => ({
                                              ...prev,
                                              sales: prev.sales.map(sale => {
                                                const currentPrices = parseSellingPrices(sale.sellingPrice || '');
                                                const updatedPrices = { ...currentPrices, [product]: val };
                                                return {
                                                  ...sale,
                                                  sellingPrice: formatSellingPrices(updatedPrices)
                                                };
                                              })
                                            }));

                                            if (val.trim() !== '') {
                                              setFailedFields(prev => prev.filter(f => !f.includes('-sellingPrice')));
                                            }
                                          }}
                                          className="w-24 px-2 py-1 rounded border border-gray-200 focus:border-blue-500 outline-none text-xs text-right font-medium text-blue-700"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!formData.hasLocalSales ? (
                      <div className="p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                        <p className="text-sm text-gray-500 italic">Local sales section is locked/disabled for this entity.</p>
                      </div>
                    ) : (
                      formData.sales.map((sale, idx) => {
                        const isBranchValidation = dboHasBranches === true && (
                          validationPremiseMode.startsWith('branch-') ||
                          validationPremiseMode === 'new'
                        );
                        const rowsToDisplay = isBranchValidation ? [
                          { label: 'Witnessed Quantity', name: 'verifiedQty', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                          { label: 'Selling Price (Per Records)', name: 'sellingPrice', unit: 'Kshs' },
                          { label: 'Avg Volume per Day', name: 'avgVolPerDay', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                        ] : [
                          { label: 'Quantity Declared', name: 'qtyDeclared', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                          { label: 'Witnessed/Verified Quantity', name: 'verifiedQty', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                          { label: 'Projected Quantity for Month', name: 'projectedQty', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                          { label: 'Under Declared Volume (Auto)', name: 'underDeclared', unit: globalUnit === 'L' ? 'Litres' : 'Kgs', readOnly: true },
                          { label: 'Buying Price (Per Records)', name: 'buyingPrice', unit: 'Kshs' },
                          { label: 'Selling Price (Per Records)', name: 'sellingPrice', unit: 'Kshs' },
                          { label: 'Avg Volume per Day', name: 'avgVolPerDay', unit: globalUnit === 'L' ? 'Litres' : 'Kgs' },
                        ];

                        return (
                        <div key={idx} className="p-6 bg-white rounded-2xl border border-gray-200 space-y-4 relative shadow-sm">
                          <button 
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, sales: prev.sales.filter((_, i) => i !== idx) }));
                              setManuallyEditedQtyDeclared(prev => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                            }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-lg font-bold cursor-pointer"
                          >
                            &times;
                          </button>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Month</label>
                            <select
                              value={sale.month}
                              onChange={(e) => {
                                const newSales = [...formData.sales];
                                newSales[idx].month = e.target.value;
                                setFormData(prev => ({ ...prev, sales: newSales }));
                                setFailedFields(prev => prev.filter(f => f !== `sale-${idx}-month`));
                                setManuallyEditedQtyDeclared(prev => {
                                  const next = { ...prev };
                                  delete next[idx];
                                  return next;
                                });
                              }}
                              className={`w-full px-3 py-1.5 rounded-xl border outline-none text-[11px] font-bold appearance-none bg-white transition-all ${
                                failedFields.includes(`sale-${idx}-month`)
                                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20 text-red-600'
                                  : 'border-blue-100 focus:border-blue-500 text-blue-600'
                              }`}
                            >
                              {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
                            <select
                              value={sale.year}
                              onChange={(e) => {
                                const newSales = [...formData.sales];
                                newSales[idx].year = e.target.value;
                                setFormData(prev => ({ ...prev, sales: newSales }));
                                setFailedFields(prev => prev.filter(f => f !== `sale-${idx}-year`));
                                setManuallyEditedQtyDeclared(prev => {
                                  const next = { ...prev };
                                  delete next[idx];
                                  return next;
                                });
                              }}
                              className={`w-full px-3 py-1.5 rounded-xl border outline-none text-[11px] font-bold appearance-none bg-white transition-all ${
                                failedFields.includes(`sale-${idx}-year`)
                                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20 text-red-600'
                                  : 'border-blue-100 focus:border-blue-500 text-blue-600'
                              }`}
                            >
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Details</th>
                                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Unit</th>
                                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {rowsToDisplay.map((row) => {
                                const isMirroredCategory = formData.category === 'CP>5,000 L/D' || formData.category === 'CP<5,000 L/D' || formData.category === 'Processor';
                                const hasMatchingIntake = isMirroredCategory && row.name === 'buyingPrice' && formData.intakes.some(
                                  i => i.month && i.year && i.month === sale.month && i.year === sale.year
                                );
                                const isLastMonth = idx === formData.sales.length - 1;
                                const isReadOnly = row.readOnly || hasMatchingIntake || (row.name === 'projectedQty' && !isLastMonth);
                                const label = hasMatchingIntake ? 'Buying Price (Mirrored)' : row.label;

                                return (
                                  <React.Fragment key={row.name}>
                                    {row.name === 'sellingPrice' && formData.natureOfProduce.length > 0 ? (
                                      <tr>
                                        <td className="p-3 text-xs font-medium text-gray-700">{label}</td>
                                        <td className="p-3 text-[10px] text-gray-400">{row.unit}</td>
                                        <td className="p-1">
                                          <div className="flex flex-col gap-1.5 py-1">
                                            {formData.natureOfProduce.map((product) => {
                                              const currentPrices = parseSellingPrices(sale.sellingPrice || '');
                                              const priceVal = currentPrices[product] || '';
                                              const hasError = failedFields.includes(`sale-${idx}-sellingPrice`) && !priceVal;
                                              return (
                                                <div key={product} className="flex items-center gap-2 justify-between">
                                                  <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">{product}:</span>
                                                  <div className="flex items-center gap-1">
                                                    <input
                                                      type="text"
                                                      placeholder="Price"
                                                      value={priceVal}
                                                      onChange={(e) => {
                                                        const val = e.target.value;
                                                        const newPrices = { ...currentPrices, [product]: val };
                                                        const formatted = formatSellingPrices(newPrices);
                                                        
                                                        const newSales = [...formData.sales];
                                                        newSales[idx].sellingPrice = formatted;
                                                        setFormData(prev => ({ ...prev, sales: newSales }));
                                                        
                                                        const updatedPrices = parseSellingPrices(formatted);
                                                        const allFilled = formData.natureOfProduce.every(prod => updatedPrices[prod] && updatedPrices[prod].trim() !== '');
                                                        if (allFilled) {
                                                          setFailedFields(prev => prev.filter(f => f !== `sale-${idx}-sellingPrice`));
                                                        }
                                                      }}
                                                      className={`w-28 px-2 py-1 rounded border outline-none text-xs text-right transition-all ${
                                                        hasError
                                                          ? 'border-red-500 ring-2 ring-red-100 bg-red-50/20 text-red-600 font-bold'
                                                          : 'border-gray-200 focus:border-blue-500'
                                                      }`}
                                                    />
                                                    <span className="text-[9px] text-gray-400">Kshs</span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      <tr>
                                        <td className={`p-3 text-xs font-medium ${hasMatchingIntake ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>{label}</td>
                                        <td className="p-3 text-[10px] text-gray-400">{row.unit}</td>
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            readOnly={isReadOnly}
                                            value={(sale as any)[row.name]}
                                            onChange={(e) => {
                                              if (isReadOnly) return;
                                              const val = e.target.value;
                                              const newSales = [...formData.sales];
                                              (newSales[idx] as any)[row.name] = val;
                                              
                                              // Mirror qtyDeclared to verifiedQty, but allow independent edit
                                              if (row.name === 'qtyDeclared') {
                                                setManuallyEditedQtyDeclared(prev => ({ ...prev, [idx]: true }));
                                                newSales[idx].verifiedQty = val;
                                                const num = parseFloat(val);
                                                if (!isNaN(num)) {
                                                  newSales[idx].avgVolPerDay = (num / 30).toFixed(2);
                                                }
                                                // Clear both from failedFields
                                                setFailedFields(prev => prev.filter(f => f !== `sale-${idx}-qtyDeclared` && f !== `sale-${idx}-verifiedQty`));
                                              } else {
                                                // Clear current from failedFields
                                                setFailedFields(prev => prev.filter(f => f !== `sale-${idx}-${row.name}`));
                                              }
                                              
                                              // Formula for Avg Volume per Day based on Verified Quantity
                                              if (row.name === 'verifiedQty') {
                                                const num = parseFloat(val);
                                                if (!isNaN(num)) {
                                                  newSales[idx].avgVolPerDay = (num / 30).toFixed(2);
                                                }
                                              }
                                              
                                              setFormData(prev => ({ ...prev, sales: newSales }));
                                            }}
                                            className={`w-full px-3 py-1.5 rounded-lg border outline-none text-xs transition-all ${
                                              isReadOnly || row.name === 'avgVolPerDay' 
                                                ? 'bg-gray-100/70 border-gray-150 text-blue-600 font-bold' 
                                                : failedFields.includes(`sale-${idx}-${row.name}`)
                                                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20 text-red-600 font-bold'
                                                  : 'border-gray-50 focus:border-blue-500'
                                            }`}
                                          />
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }))}
                  </div>

                  {/* Distribution Details Section (Mini Dairy and Cottage Industry only) */}
                  {(formData.category === 'Mini Dairy' || formData.category === 'Cottage Industry') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6 border border-gray-100 bg-white p-6 rounded-3xl shadow-sm"
                    >
                      <div className="border-b border-gray-100 pb-4">
                        <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase">Distributor Details</h3>
                        <p className="text-[10px] text-gray-500 mt-1">Please provide distribution channels, outlet network, and regulatory information for all distributors.</p>
                      </div>

                      <div className="space-y-8">
                        {formData.distributors.map((dist, dIdx) => {
                          return (
                            <div key={dIdx} className="p-6 bg-slate-50/40 border border-slate-100 rounded-3xl relative space-y-5">
                              <div className="flex justify-between items-center border-b border-slate-100/60 pb-3">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                                  Distributor #{dIdx + 1}: {dist.name || 'Unnamed'}
                                </h4>
                                {formData.distributors.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        distributors: prev.distributors.filter((_, i) => i !== dIdx)
                                      }));
                                    }}
                                    className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100/50 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Remove Distributor
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 relative">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Distributor Name</label>
                                  <input
                                    type="text"
                                    value={dist.name}
                                    onChange={(e) => {
                                      const next = [...formData.distributors];
                                      next[dIdx].name = e.target.value;
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                      setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-name`));
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                                      failedFields.includes(`dist-${dIdx}-name`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                        : 'border-gray-200 focus:border-blue-500 bg-white'
                                    }`}
                                    placeholder="Enter distributor name to search..."
                                  />
                                  {isCheckingDist[dIdx] && (
                                    <p className="text-[10px] text-blue-500 font-medium mt-1 flex items-center gap-1 animate-pulse">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Searching previous validations...
                                    </p>
                                  )}
                                  
                                  <AnimatePresence>
                                    {distributorRecords[dIdx] && distributorRecords[dIdx].length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="absolute z-50 w-full mt-2 p-3 bg-white rounded-xl border border-blue-100 space-y-2 shadow-xl max-h-56 overflow-y-auto"
                                      >
                                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-tight flex items-center gap-1">
                                          <Database className="w-3.5 h-3.5 text-blue-600" />
                                          Previous Distributor Found: Click to Autofill
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                          {distributorRecords[dIdx].map((record, rIdx) => {
                                            const raw = record.raw_data || {};
                                            const name = record.dbo_name || record.premise_name || 'Unknown';
                                            const pNo = record.permit_no || 'N/A';
                                            const contacts = raw.contacts || record.contacts || 'N/A';
                                            
                                            return (
                                              <button
                                                key={rIdx}
                                                type="button"
                                                onClick={() => handleDistributorAutofill(dIdx, record)}
                                                className="w-full text-left p-2 rounded-lg bg-white border border-slate-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-[11px] group flex flex-col gap-0.5 cursor-pointer"
                                              >
                                                <div className="flex justify-between items-center w-full">
                                                  <span className="font-bold text-gray-800 group-hover:text-blue-900 truncate">
                                                    {name}
                                                  </span>
                                                  <span className="text-[9px] font-mono text-blue-700 bg-blue-100/50 px-1.5 py-0.5 rounded-md">
                                                    Permit: {pNo}
                                                  </span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 flex justify-between items-center mt-0.5">
                                                  <span>Contacts: {contacts}</span>
                                                  <span className="text-[9px] text-gray-400 font-mono italic">
                                                    {new Date(record.date).toLocaleDateString('default', { month: 'short', year: 'numeric' })}
                                                  </span>
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contacts</label>
                                  <input
                                    type="text"
                                    value={dist.contacts}
                                    onChange={(e) => {
                                      const next = [...formData.distributors];
                                      next[dIdx].contacts = e.target.value;
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                      setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-contacts`));
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                                      failedFields.includes(`dist-${dIdx}-contacts`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                        : 'border-gray-200 focus:border-blue-500 bg-white'
                                    }`}
                                    placeholder="Enter contact details"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Volume / Day ({globalUnit}/Day)</label>
                                  <input
                                    type="text"
                                    value={dist.volPerDay}
                                    onChange={(e) => {
                                      const next = [...formData.distributors];
                                      next[dIdx].volPerDay = e.target.value;
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                      setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-volPerDay`));
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                                      failedFields.includes(`dist-${dIdx}-volPerDay`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                        : 'border-gray-200 focus:border-blue-500 bg-white'
                                    }`}
                                    placeholder="0.00"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Permit No</label>
                                  <input
                                    type="text"
                                    value={dist.permitNo}
                                    onChange={(e) => {
                                      const next = [...formData.distributors];
                                      next[dIdx].permitNo = e.target.value;
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                      setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-permitNo`));
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                                      failedFields.includes(`dist-${dIdx}-permitNo`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                        : 'border-gray-200 focus:border-blue-500 bg-white font-mono text-blue-700'
                                    }`}
                                    placeholder="KDB / ..."
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Area of Sale</label>
                                  <input
                                    type="text"
                                    value={dist.areaOfSale}
                                    onChange={(e) => {
                                      const next = [...formData.distributors];
                                      next[dIdx].areaOfSale = e.target.value;
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                      setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-areaOfSale`));
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border outline-none text-xs transition-all ${
                                      failedFields.includes(`dist-${dIdx}-areaOfSale`)
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 ring-2 ring-red-100 bg-red-50/20'
                                        : 'border-gray-200 focus:border-blue-500 bg-white'
                                    }`}
                                    placeholder="Enter geographic sales area"
                                  />
                                </div>
                              </div>

                              {/* Nature of produce and prices combined */}
                              <div className={`space-y-3 p-4 rounded-2xl border transition-all ${
                                failedFields.includes(`dist-${dIdx}-natureOfProduce`)
                                  ? 'bg-red-50/50 border-red-300 ring-2 ring-red-100'
                                  : 'bg-slate-50/30 border-slate-100'
                              }`}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                                  <span>Nature of Produce & Distributor Price (Kshs)</span>
                                  <span className="text-[9px] text-gray-400 font-medium normal-case">Select distributed products and enter their prices</span>
                                </label>
                                {formData.natureOfProduce.length === 0 ? (
                                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-[11px] font-medium">
                                    No products selected in the "Nature of Produce?" section above. Please check at least one product above first.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-100">
                                    {formData.natureOfProduce.map(opt => {
                                      const isChecked = dist.natureOfProduce?.includes(opt);
                                      const mirroredPrice = getMirroredSellingPrice(opt, formData.sales);
                                      const hasCustomPrice = dist.prices[opt] !== undefined;
                                      const displayPrice = hasCustomPrice ? dist.prices[opt] : mirroredPrice;

                                      return (
                                        <div key={opt} className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                                          isChecked 
                                            ? 'bg-blue-50/20 border-blue-100' 
                                            : 'bg-gray-50/30 border-gray-100 opacity-70 hover:opacity-100'
                                        }`}>
                                          <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                const currentList = dist.natureOfProduce || [];
                                                const nextList = isChecked
                                                  ? currentList.filter(x => x !== opt)
                                                  : [...currentList, opt];
                                                const next = [...formData.distributors];
                                                next[dIdx].natureOfProduce = nextList;
                                                setFormData(prev => ({ ...prev, distributors: next }));
                                                setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-natureOfProduce`));
                                              }}
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className={`text-[11px] font-semibold ${isChecked ? 'text-blue-900' : 'text-gray-500'}`}>
                                              {opt}
                                            </span>
                                          </label>

                                          <div className="space-y-0.5">
                                            <span className="text-[8px] font-semibold text-slate-400 block truncate">
                                              {!hasCustomPrice && mirroredPrice ? 'Price (Mirrored)' : 'Price (Custom)'}
                                            </span>
                                            <div className="relative">
                                              <input
                                                type="text"
                                                value={displayPrice}
                                                onChange={(e) => {
                                                  const next = [...formData.distributors];
                                                  next[dIdx].prices = {
                                                    ...next[dIdx].prices,
                                                    [opt]: e.target.value
                                                  };
                                                  // Automatically check the product checkbox if user types a price
                                                  const currentList = dist.natureOfProduce || [];
                                                  if (!currentList.includes(opt)) {
                                                    next[dIdx].natureOfProduce = [...currentList, opt];
                                                  }
                                                  setFormData(prev => ({ ...prev, distributors: next }));
                                                  setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-price-${opt}`));
                                                }}
                                                className={`w-full pl-2 pr-7 py-1 rounded-lg border outline-none text-[11px] transition-all ${
                                                  failedFields.includes(`dist-${dIdx}-price-${opt}`)
                                                    ? 'border-red-500 ring-2 ring-red-100 bg-red-50/10'
                                                    : 'border-slate-200 focus:border-blue-400 bg-white'
                                                }`}
                                                placeholder={mirroredPrice || "0.00"}
                                              />
                                              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[8px] font-bold text-slate-400">
                                                Ksh
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* List of Outlets */}
                              <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">List of Outlets</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...formData.distributors];
                                      next[dIdx].outlets = [
                                        ...(next[dIdx].outlets || []),
                                        { location: '', volPerDay: '', permitStatus: 'None', levyInfo: 'Does not Qualify' }
                                      ];
                                      setFormData(prev => ({ ...prev, distributors: next }));
                                    }}
                                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    + Add Outlet
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  {(dist.outlets || []).map((outlet, oIdx) => (
                                    <div key={oIdx} className="p-4 bg-white border border-slate-100 rounded-2xl relative space-y-3">
                                      {dist.outlets.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = [...formData.distributors];
                                            next[dIdx].outlets = next[dIdx].outlets.filter((_, i) => i !== oIdx);
                                            setFormData(prev => ({ ...prev, distributors: next }));
                                          }}
                                          className="absolute top-2 right-3 text-slate-400 hover:text-red-500 font-bold text-base cursor-pointer"
                                        >
                                          &times;
                                        </button>
                                      )}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-gray-400 uppercase">Outlet Location</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Town Center"
                                            value={outlet.location}
                                            onChange={(e) => {
                                              const next = [...formData.distributors];
                                              next[dIdx].outlets[oIdx].location = e.target.value;
                                              setFormData(prev => ({ ...prev, distributors: next }));
                                              setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-outlet-${oIdx}-location`));
                                            }}
                                            className={`w-full px-3 py-1.5 rounded-lg border outline-none text-xs transition-all bg-white ${
                                              failedFields.includes(`dist-${dIdx}-outlet-${oIdx}-location`)
                                                ? 'border-red-500 ring-2 ring-red-100 bg-red-50/20'
                                                : 'border-slate-200 focus:border-blue-500'
                                            }`}
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-gray-400 uppercase">Vol / Day ({globalUnit})</label>
                                          <input
                                            type="text"
                                            placeholder="0.00"
                                            value={outlet.volPerDay}
                                            onChange={(e) => {
                                              const next = [...formData.distributors];
                                              next[dIdx].outlets[oIdx].volPerDay = e.target.value;
                                              setFormData(prev => ({ ...prev, distributors: next }));
                                              setFailedFields(prev => prev.filter(f => f !== `dist-${dIdx}-outlet-${oIdx}-volPerDay`));
                                            }}
                                            className={`w-full px-3 py-1.5 rounded-lg border outline-none text-xs transition-all bg-white ${
                                              failedFields.includes(`dist-${dIdx}-outlet-${oIdx}-volPerDay`)
                                                ? 'border-red-500 ring-2 ring-red-100 bg-red-50/20'
                                                : 'border-slate-200 focus:border-blue-500'
                                            }`}
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-gray-400 uppercase">Permit Status</label>
                                          <select
                                            value={outlet.permitStatus}
                                            onChange={(e) => {
                                              const next = [...formData.distributors];
                                              const nextStatus = e.target.value as any;
                                              next[dIdx].outlets[oIdx].permitStatus = nextStatus;
                                              if (nextStatus === 'None') {
                                                next[dIdx].outlets[oIdx].levyInfo = 'Does not Qualify';
                                              }
                                              setFormData(prev => ({ ...prev, distributors: next }));
                                            }}
                                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white text-gray-700 font-semibold"
                                          >
                                            <option value="None">None</option>
                                            <option value="Valid">Valid</option>
                                            <option value="Expired">Expired</option>
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-gray-400 uppercase">Levy Info</label>
                                          <select
                                            value={outlet.levyInfo || 'Does not Qualify'}
                                            onChange={(e) => {
                                              const next = [...formData.distributors];
                                              next[dIdx].outlets[oIdx].levyInfo = e.target.value;
                                              setFormData(prev => ({ ...prev, distributors: next }));
                                            }}
                                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white text-gray-700 font-semibold"
                                          >
                                            <option value="Does not Qualify">Does not Qualify</option>
                                            <option value="Qualifies CSL">Qualifies CSL</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            distributors: [
                              ...prev.distributors,
                              {
                                name: '',
                                contacts: '',
                                volPerDay: '',
                                permitNo: '',
                                areaOfSale: '',
                                outlets: [{ location: '', volPerDay: '', permitStatus: 'None', levyInfo: 'Does not Qualify' }],
                                natureOfProduce: [],
                                prices: {}
                              }
                            ]
                          }));
                        }}
                        className="w-full py-3.5 border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/10 text-slate-500 hover:text-blue-600 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        + Add Distributor
                      </button>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2.5 sm:py-3 text-gray-500 font-bold hover:text-black hover:bg-gray-100 rounded-xl transition-all text-xs sm:text-sm cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={handleManualSaveDraft}
                        className="flex items-center gap-1.5 px-3.5 sm:px-6 py-2.5 sm:py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all text-xs sm:text-sm border border-blue-200 cursor-pointer"
                        title="Save progress to draft"
                      >
                        <Save className="w-4 h-4 text-blue-600" />
                        Save Draft
                      </button>

                      <button
                        type="button"
                        onClick={() => validateStep(2) && setStep(3)}
                        className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
                      >
                        Next Step
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">3</div>
                    <h2 className="text-lg font-bold">{isBranchFacility ? "Declarations & Signatures" : "Compliance & Confirmation"}</h2>
                  </div>

                  {!isBranchFacility && (
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-blue-100">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-blue-100/50">
                              <th className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-wider">CSL Period</th>
                              <th className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-wider">{globalUnit === 'L' ? 'Litres' : 'Kilograms'}</th>
                              <th className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-wider">Amount (Kshs)</th>
                              <th className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-wider">Month/Year to Pay</th>
                              <th className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-wider">Paid/MPESA REF No:</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {formData.nonCompliance.map((nc, idx) => (
                              <tr key={idx}>
                                <td className="p-3 text-xs font-bold text-blue-800">{nc.month}</td>
                                <td className="p-3 text-xs text-blue-700">{nc.litres}</td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    placeholder="0.00"
                                    value={nc.amount}
                                    onChange={(e) => {
                                      const newNC = [...formData.nonCompliance];
                                      newNC[idx].amount = e.target.value;
                                      setFormData(prev => ({ ...prev, nonCompliance: newNC }));
                                    }}
                                    className="w-full px-3 py-1.5 rounded-lg border border-blue-100 outline-none text-xs font-mono"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    placeholder="MM/YYYY"
                                    value={nc.paymentMonthYear}
                                    onChange={(e) => {
                                      const newNC = [...formData.nonCompliance];
                                      newNC[idx].paymentMonthYear = e.target.value;
                                      setFormData(prev => ({ ...prev, nonCompliance: newNC }));
                                    }}
                                    className="w-full px-3 py-1.5 rounded-lg border border-blue-100 outline-none text-xs"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    placeholder="REF NO"
                                    value={nc.mpesaRef}
                                    onChange={(e) => {
                                      const newNC = [...formData.nonCompliance];
                                      newNC[idx].mpesaRef = e.target.value;
                                      setFormData(prev => ({ ...prev, nonCompliance: newNC }));
                                    }}
                                    className="w-full px-3 py-1.5 rounded-lg border border-blue-100 outline-none text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                            {formData.nonCompliance.length > 0 && (
                              <tr className="bg-blue-50/50">
                                <td className="p-3 text-xs font-bold text-blue-900">TOTAL</td>
                                <td className="p-3 text-xs text-blue-700"></td>
                                <td className="p-3 text-xs font-bold text-blue-900">
                                  {totalPenalty.toFixed(2)}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            )}
                            {formData.nonCompliance.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-xs text-blue-400 italic">No under-declaration detected.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900">Declarations</h3>
                    <div className="space-y-3">
                      {/* Accept All Declarations */}
                      <label className="flex items-center gap-3 cursor-pointer group pb-3 border-b border-gray-100">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={
                              declarations.accurate && 
                              (!formData.sales.some(sale => (parseFloat(sale.underDeclared) || 0) > 0) || declarations.offense) && 
                              declarations.awareness
                            }
                            onChange={(e) => {
                              const val = e.target.checked;
                              const hasUnderDecl = formData.sales.some(sale => (parseFloat(sale.underDeclared) || 0) > 0);
                              setDeclarations({
                                accurate: val,
                                offense: hasUnderDecl ? val : false,
                                awareness: val
                              });
                            }}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-emerald-600 checked:bg-emerald-600"
                          />
                          <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5" />
                        </div>
                        <span className="text-xs font-bold text-gray-800 leading-relaxed group-hover:text-emerald-700 transition-colors">
                          Accept All Declarations
                        </span>
                      </label>

                      {/* First Declaration */}
                      <label className="flex items-start gap-3 cursor-pointer group pt-1">
                        <div className="relative flex items-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={declarations.accurate}
                            onChange={(e) => setDeclarations(prev => ({ ...prev, accurate: e.target.checked }))}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-blue-600 checked:bg-blue-600"
                          />
                          <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5" />
                        </div>
                        <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                          I/We confirm that the information provided is true and accurate to the best of my/our knowledge.
                        </span>
                      </label>

                      {/* Second Declaration (Conditional) */}
                      {formData.sales.some(sale => (parseFloat(sale.underDeclared) || 0) > 0) && (
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center mt-0.5">
                            <input
                              type="checkbox"
                              checked={declarations.offense}
                              onChange={(e) => setDeclarations(prev => ({ ...prev, offense: e.target.checked }))}
                              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-blue-600 checked:bg-blue-600"
                            />
                            <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5" />
                          </div>
                          <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                            I/We understand that under-declaration of milk volumes is an offense under the Dairy Industry Act and agree to pay the calculated under declared volumes and monies within the specified periods.
                          </span>
                        </label>
                      )}

                      {/* Third Declaration (Originally Awareness) */}
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={declarations.awareness}
                            onChange={(e) => setDeclarations(prev => ({ ...prev, awareness: e.target.checked }))}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-blue-600 checked:bg-blue-600"
                          />
                          <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5" />
                        </div>
                        <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                          I/We confirm that I/We have been informed/presented with, read and understood the KDB Premise Inspection Scope Disclosure, including the legal obligations to maintain records and traceability of the same as stipulated under the Dairy Industry Act (Cap 336), Laws of Kenya.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comments</label>
                    <textarea
                      name="comments"
                      value={formData.comments}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm"
                      placeholder="Enter any additional comments here..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Compliance Officer Name</label>
                        <input
                          type="text"
                          name="complianceOfficer"
                          value={formData.complianceOfficer}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Compliance Officer Signature</label>
                          {authoritySignatures.length > 0 && !formData.complianceSignature && (
                            <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {authoritySignatures.length} saved {authoritySignatures.length === 1 ? 'signature' : 'signatures'} available
                            </span>
                          )}
                        </div>

                        {/* Selected signature state */}
                        {formData.complianceSignature && !isSelectingAuthoritySig ? (
                          <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                              <div className="h-16 w-28 bg-white rounded-xl border border-blue-100 p-1.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                                <img
                                  src={formData.complianceSignature}
                                  alt="Compliance Signature"
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    {formData.complianceOfficer || 'Authority Signature'}
                                  </span>
                                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> Applied
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Applied to official validation PDF and Google Sheets sync
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <button
                                type="button"
                                onClick={() => setIsSelectingAuthoritySig(true)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                title="Change or select a different authority signature"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                Change Signature
                              </button>
                              <button
                                type="button"
                                onClick={handleClearComplianceSignature}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200"
                                title="Remove signature from this form"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Selection / upload state */
                          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="text-xs font-bold text-slate-700">
                                {isSelectingAuthoritySig ? 'Switch to Another Authority Signature' : 'Choose Authority Signature'}
                              </div>
                              <div className="flex items-center gap-2">
                                {isSelectingAuthoritySig && formData.complianceSignature && (
                                  <button
                                    type="button"
                                    onClick={() => setIsSelectingAuthoritySig(false)}
                                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                                  >
                                    Cancel
                                  </button>
                                )}
                                {authoritySignatures.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setIsReorderingSignatures(prev => !prev)}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                      isReorderingSignatures
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                    title="Reorder priority of authority signatures"
                                  >
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span>{isReorderingSignatures ? 'Done Reordering' : 'Reorder'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setShowAddAuthorityModal(true)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Signature
                                </button>
                              </div>
                            </div>

                            {authoritySignatures.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                                {authoritySignatures.map((sig, index) => {
                                  const isSelected = formData.complianceSignature === sig.signature;
                                  const isFirst = index === 0;
                                  const isLast = index === authoritySignatures.length - 1;
                                  return (
                                    <div
                                      key={sig.id}
                                      onClick={() => {
                                        if (!isReorderingSignatures) {
                                          handleSelectAuthoritySignature(sig);
                                        }
                                      }}
                                      className={`p-2.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                                        isSelected
                                          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-200 shadow-xs'
                                          : 'bg-white hover:bg-blue-50/30 border-slate-200 hover:border-blue-300 shadow-xs'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1 mb-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                          <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-black shrink-0">
                                            #{index + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-700">
                                              {sig.name}
                                            </div>
                                            {sig.title && (
                                              <div className="text-[10px] text-slate-500 truncate">
                                                {sig.title}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {authoritySignatures.length > 1 && (
                                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5" onClick={e => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={(e) => handleMoveAuthoritySignature(sig.id, 'up', e)}
                                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                                                title={isFirst ? "First item" : "Move up"}
                                              >
                                                <ArrowUp className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={(e) => handleMoveAuthoritySignature(sig.id, 'down', e)}
                                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                                                title={isLast ? "Last item" : "Move down"}
                                              >
                                                <ArrowDown className="w-3 h-3" />
                                              </button>
                                            </div>
                                          )}
                                          {isSelected && !isReorderingSignatures && (
                                            <span className="p-0.5 bg-blue-600 text-white rounded-full">
                                              <Check className="w-3 h-3" />
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeleteAuthoritySignature(sig.id, e)}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Delete this signature from saved authority signatures"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
                                        <img src={sig.signature} alt={sig.name} className="max-h-full max-w-full object-contain" />
                                      </div>

                                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                        {isReorderingSignatures ? (
                                          <>
                                            <span className="text-slate-500 font-medium">Position #{index + 1}</span>
                                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                disabled={isFirst}
                                                onClick={(e) => handleMoveAuthoritySignature(sig.id, 'up', e)}
                                                className="text-blue-600 hover:underline font-bold disabled:opacity-30 disabled:no-underline cursor-pointer"
                                              >
                                                Up
                                              </button>
                                              <span className="text-slate-300">•</span>
                                              <button
                                                type="button"
                                                disabled={isLast}
                                                onClick={(e) => handleMoveAuthoritySignature(sig.id, 'down', e)}
                                                className="text-blue-600 hover:underline font-bold disabled:opacity-30 disabled:no-underline cursor-pointer"
                                              >
                                                Down
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-slate-400 font-medium">Click to select</span>
                                            <span className="font-bold text-blue-600 group-hover:underline">
                                              {isSelected ? 'Selected' : 'Use this'}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                                <p className="text-xs text-slate-500">No authority signatures saved yet.</p>
                                <button
                                  type="button"
                                  onClick={() => setShowAddAuthorityModal(true)}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add First Authority Signature
                                </button>
                              </div>
                            )}

                            {/* One-off local file upload fallback */}
                            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                              <span>Or upload a one-off signature file:</span>
                              <label className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1">
                                <Upload className="w-3 h-3" /> Browse File
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(e, 'complianceSignature')}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">For DBO; Name</label>
                        <input
                          type="text"
                          name="confirmationName"
                          value={formData.confirmationName}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Designation</label>
                        <input
                          type="text"
                          name="designation"
                          value={formData.designation}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">DBO Signature</label>
                        <div className="flex flex-col gap-2">
                          {!formData.dboSignature ? (
                            <div className="space-y-3">
                              <div className="border-2 border-dashed border-gray-200 rounded-xl p-2 bg-gray-50">
                                <SignatureCanvas
                                  ref={dboSigPad}
                                  penColor="black"
                                  canvasProps={{
                                    className: "w-full h-32 rounded-lg cursor-crosshair",
                                    style: { background: 'white' }
                                  }}
                                />
                                <div className="flex justify-between mt-2">
                                  <button
                                    type="button"
                                    onClick={() => dboSigPad.current?.clear()}
                                    className="text-[10px] font-bold text-gray-500 hover:text-red-500 flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Clear Pad
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveDboSignature}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                  >
                                    <PenTool className="w-3 h-3" /> Save Signature
                                  </button>
                                </div>
                              </div>
                              <div className="text-center">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">OR UPLOAD IMAGE</span>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'dboSignature')}
                                className="text-xs"
                              />
                            </div>
                          ) : (
                            <div className="relative group">
                              <img src={formData.dboSignature} alt="DBO Signature" className="h-20 object-contain border rounded-lg bg-white" />
                              <button
                                type="button"
                                onClick={() => clearField('dboSignature')}
                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">DBO Stamp</label>
                        <div className="flex flex-col gap-2">
                          {!formData.dboStamp ? (
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange(e, 'dboStamp')}
                              className="text-xs"
                            />
                          ) : (
                            <div className="relative group">
                              <img src={formData.dboStamp} alt="DBO Stamp" className="h-20 object-contain border rounded-lg bg-white" />
                              <button
                                type="button"
                                onClick={() => clearField('dboStamp')}
                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm text-gray-600 font-bold hover:text-black hover:bg-gray-100 rounded-xl transition-all border border-gray-200 sm:border-transparent cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleManualSaveDraft}
                          className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all text-xs sm:text-sm border border-blue-200 cursor-pointer"
                          title="Save progress to draft"
                        >
                          <Save className="w-4 h-4 text-blue-600" />
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={handlePreview}
                          className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs sm:text-sm whitespace-nowrap cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          Preview PDF
                        </button>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleSubmitDraftToSupabase(formData, step, false)}
                          disabled={isSubmittingDraft || isSubmitting}
                          className={`w-full sm:w-auto flex justify-center items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold transition-all shadow-md text-xs sm:text-sm cursor-pointer ${
                            isSubmittingDraft || isSubmitting
                              ? 'bg-amber-100 text-amber-400 cursor-not-allowed'
                              : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white'
                          }`}
                          title="Save all form entries to Supabase draft only (without syncing to Google Sheets)"
                          id="submit-draft-btn"
                        >
                          {isSubmittingDraft ? (
                            <>
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              Saving Draft...
                            </>
                          ) : (
                            <>
                              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                              Submit Draft
                            </>
                          )}
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmitting || isSubmittingDraft}
                          className={`w-full sm:w-auto flex justify-center items-center gap-2 px-5 sm:px-9 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold transition-all shadow-md text-xs sm:text-sm cursor-pointer ${
                            isSubmitting
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                          }`}
                          id="submit-and-sync-btn"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                              Syncing & Generating PDF...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                              {isAmendment ? 'Submit Amendment & Overwrite' : 'Submit & Sync to Sheet'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        {/* PDF Preview Modal */}
        <AnimatePresence>
          {pdfPreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                  <h3 className="text-xl font-bold">PDF Preview</h3>
                  <button
                    onClick={() => setPdfPreview(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex-1 bg-gray-100">
                  <iframe
                    src={pdfPreview}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                </div>
                <div className="p-6 border-t border-gray-100 flex justify-end bg-white">
                  <button
                    onClick={() => setPdfPreview(null)}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Close Preview
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved Drafts Modal (Supabase) */}
        <AnimatePresence>
          {isDraftsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              id="saved-drafts-modal"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col shadow-2xl max-h-[88vh]"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Saved Validation Drafts (Supabase)</h3>
                      <p className="text-xs text-gray-500">
                        Select any draft to modify and resume. Once submitted & synced, it becomes a final validation.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDraftsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search drafts by DBO name, premise, or permit number..."
                      value={draftSearchQuery}
                      onChange={(e) => setDraftSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshDraftsList()}
                    className="px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Refresh drafts from Supabase"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Drafts List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                  {(() => {
                    const filteredDrafts = draftsList.filter(d => {
                      if (!draftSearchQuery.trim()) return true;
                      const q = draftSearchQuery.toLowerCase();
                      const dbo = (d.dboName || d.dbo_name || '').toLowerCase();
                      const premise = (d.premiseName || d.premise_name || '').toLowerCase();
                      const permit = (d.permitNo || d.permit_no || '').toLowerCase();
                      const period = (d.validationPeriod || d.validation_period || '').toLowerCase();
                      return dbo.includes(q) || premise.includes(q) || permit.includes(q) || period.includes(q);
                    });

                    if (filteredDrafts.length === 0) {
                      return (
                        <div className="text-center py-12 space-y-3">
                          <Database className="w-12 h-12 text-gray-300 mx-auto" />
                          <p className="text-sm font-semibold text-gray-700">
                            {draftSearchQuery ? 'No matching drafts found.' : 'No saved drafts in Supabase.'}
                          </p>
                          <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            You can save your progress anytime by clicking <strong className="text-gray-600">Submit Draft</strong> at the end of the form or <strong className="text-gray-600">Save Draft</strong> at the top.
                          </p>
                        </div>
                      );
                    }

                    return filteredDrafts.map((draft) => {
                      const raw = draft.rawData || draft.raw_data || {};
                      const form = raw.formData || draft;
                      const dbo = draft.dboName || draft.dbo_name || form.dboName || 'Unnamed DBO';
                      const premise = draft.premiseName || draft.premise_name || form.premiseName || 'Unknown Premise';
                      const permit = draft.permitNo || draft.permit_no || form.permitNo || 'N/A';
                      const period = draft.validationPeriod || draft.validation_period || form.validationPeriod || '';
                      const category = draft.category || form.category || '';
                      const location = draft.location || form.location || '';
                      const stepNum = draft.step !== undefined ? draft.step : (raw.step ?? 1);
                      const isCurrentActive = activeDraftId === draft.id;

                      let dateStr = '';
                      if (draft.updatedAt || draft.updated_at || draft.createdAt) {
                        try {
                          const d = new Date(draft.updatedAt || draft.updated_at || draft.createdAt || '');
                          dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (_) {}
                      }

                      return (
                        <div
                          key={draft.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isCurrentActive
                              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                              : 'bg-white border-gray-200 hover:border-amber-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-gray-900 truncate">
                                {dbo}
                              </span>
                              {isCurrentActive && (
                                <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                                  Currently Editing
                                </span>
                              )}
                              {period && (
                                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                                  {period}
                                </span>
                              )}
                              {category && (
                                <span className="text-[10px] bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded-md">
                                  {category}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800">{premise}</span>
                              <span>&bull;</span>
                              <span>Permit: <strong className="font-mono text-gray-700">{permit}</strong></span>
                              {location && (
                                <>
                                  <span>&bull;</span>
                                  <span>{location}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                              <span className="flex items-center gap-1 font-medium text-amber-800">
                                <FileText className="w-3 h-3 text-amber-600" />
                                Step {stepNum === 0 ? '1' : stepNum + 1} of 4
                              </span>
                              {form.startTime && (
                                <>
                                  <span>&bull;</span>
                                  <span>Start: <strong className="text-gray-700 font-semibold">{form.startTime}</strong></span>
                                </>
                              )}
                              {form.endTime && (
                                <>
                                  <span>&bull;</span>
                                  <span className="text-amber-800 font-semibold bg-amber-100/70 px-1.5 py-0.2 rounded">
                                    End (Locked): {form.endTime}
                                  </span>
                                </>
                              )}
                              {dateStr && (
                                <>
                                  <span>&bull;</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    Saved: {dateStr}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleRestoreDraft(draft)}
                              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>{isCurrentActive ? 'Keep Editing' : 'Resume & Modify'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDraft(draft.id, e)}
                              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Delete this draft from Supabase"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <span className="text-xs text-gray-500 font-medium">
                    Total drafts: <strong>{draftsList.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDraftsModalOpen(false)}
                    className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 7-Point Split-Screen Reconciliation Overlay */}
        <AnimatePresence>
          {showReconciliation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black tracking-tight">7-Point Profile & Branch Reconciliation Required</h3>
                    <p className="text-xs text-amber-100 font-medium">Conflicting data points identified between Data Validation input and core Clients database.</p>
                  </div>
                  {selectedClient && (
                    <span className="bg-amber-700/50 text-white font-mono text-[10px] px-3 py-1 rounded-full border border-amber-400/30 font-bold">
                      DBO: {selectedClient.clientName}
                    </span>
                  )}
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                  {/* Branch Selection & Context Card for 7-Point Reconciliation */}
                  {selectedClient && (
                    <div className="p-5 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 rounded-2xl border border-blue-100 space-y-4 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/80 pb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                              DBO Branches & Premises Registry
                            </h4>
                            <p className="text-[11px] text-blue-700 font-medium">
                              Select a branch below to load its specific premise name, permit number, and location into the 7-point reconciliation list.
                            </p>
                          </div>
                        </div>
                        <span className="self-start sm:self-auto text-[10px] text-blue-800 font-bold bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                          Active Branch: {selectedClient.premiseName || 'Primary Premise'}
                        </span>
                      </div>

                      {/* Gather and list all branches under DBO displaying Premise Name, Permit Number, Location */}
                      {(() => {
                        const cleanDboName = (selectedClient.clientName || '').toLowerCase().trim();
                        
                        // 1. Gather matching clients from global clients list
                        const relatedClients = clients.filter(c => (c.clientName || '').toLowerCase().trim() === cleanDboName);
                        
                        // 2. Map branches sub-array if present on selectedClient
                        const mappedSubBranches: LicensedClient[] = (selectedClient.branches || []).map((sb, idx) => ({
                          ...selectedClient,
                          id: sb.permitNumber || sb.id || `SUB_BR_${idx}_${selectedClient.id}`,
                          permitNumber: sb.permitNumber || selectedClient.permitNumber,
                          premiseName: sb.premiseName || selectedClient.premiseName,
                          location: sb.location || selectedClient.location,
                        }));

                        // Merge into unique branch list by permit number or premise name
                        const allBranchesMap = new Map<string, LicensedClient>();
                        [...relatedClients, ...mappedSubBranches].forEach(b => {
                          const key = (b.permitNumber || b.id || b.premiseName || '').toLowerCase().trim();
                          if (key && !allBranchesMap.has(key)) {
                            allBranchesMap.set(key, b);
                          }
                        });
                        
                        const selectedKey = (selectedClient.permitNumber || selectedClient.id || selectedClient.premiseName || '').toLowerCase().trim();
                        if (selectedKey && !allBranchesMap.has(selectedKey)) {
                          allBranchesMap.set(selectedKey, selectedClient);
                        }

                        const branchList = Array.from(allBranchesMap.values());

                        return (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                              Registered Premises / Branches ({branchList.length}): Click any branch to reconcile
                            </span>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {branchList.map((branchItem, bIdx) => {
                                const isCurrentActive = 
                                  (branchItem.id && selectedClient.id && branchItem.id === selectedClient.id) ||
                                  (branchItem.permitNumber && selectedClient.permitNumber && branchItem.permitNumber.toString().trim().toLowerCase() === selectedClient.permitNumber.toString().trim().toLowerCase()) ||
                                  (branchItem.premiseName && selectedClient.premiseName && branchItem.premiseName.toString().trim().toLowerCase() === selectedClient.premiseName.toString().trim().toLowerCase());

                                return (
                                  <button
                                    key={bIdx}
                                    type="button"
                                    onClick={() => handleSelectBranchForReconciliation(branchItem)}
                                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 relative overflow-hidden group ${
                                      isCurrentActive
                                        ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                                        : 'bg-white hover:bg-blue-50/80 text-slate-800 border-blue-100 hover:border-blue-300'
                                    }`}
                                  >
                                    <div className="space-y-1.5">
                                      {/* 1. Premise Name */}
                                      <div className="flex justify-between items-start gap-1">
                                        <span className={`text-xs font-bold leading-snug line-clamp-2 ${isCurrentActive ? 'text-white' : 'text-slate-900 group-hover:text-blue-900'}`}>
                                          {branchItem.premiseName || 'Unnamed Premise'}
                                        </span>
                                        {isCurrentActive && (
                                          <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 shadow-xs">
                                            Active
                                          </span>
                                        )}
                                      </div>

                                      {/* 2. Permit Number */}
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className={`font-medium ${isCurrentActive ? 'text-blue-100' : 'text-slate-400'}`}>Permit:</span>
                                        <span className={`font-mono font-bold ${isCurrentActive ? 'text-white' : 'text-blue-700'}`}>
                                          {branchItem.permitNumber || branchItem.id || 'N/A'}
                                        </span>
                                      </div>

                                      {/* 3. Location */}
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className={`font-medium ${isCurrentActive ? 'text-blue-100' : 'text-slate-400'}`}>Location:</span>
                                        <span className={`font-semibold ${isCurrentActive ? 'text-blue-50' : 'text-slate-700'}`}>
                                          {branchItem.location || 'N/A'} {branchItem.county ? `(${branchItem.county})` : ''}
                                        </span>
                                      </div>
                                    </div>

                                    <div className={`pt-2 border-t text-[10px] font-bold flex items-center justify-between ${
                                      isCurrentActive ? 'border-blue-500/60 text-blue-100' : 'border-slate-100 text-blue-600 group-hover:text-blue-700'
                                    }`}>
                                      <span>{isCurrentActive ? 'Loaded in 7-Point Recon' : 'Click to Load in Recon'}</span>
                                      <span>&rarr;</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    The following 7-point fields do not match. For each mismatch, select which value is the absolute latest source of truth. 
                    Selecting a value will update BOTH this validation form and the core licensed clients registry in Supabase.
                  </p>

                  <div className="space-y-4">
                    {mismatchFields.map((item, idx) => (
                      <div key={item.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-left">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 tracking-tight block uppercase">{item.label}</span>
                          {(item.key === 'premiseName' || item.key === 'location') && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                              Branch Data Point
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Validation Value Option */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...mismatchFields];
                              updated[idx].selectedVal = 'validation';
                              setMismatchFields(updated);
                            }}
                            className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1 relative overflow-hidden ${
                              item.selectedVal === 'validation'
                                ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Data Validation Form State</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {item.key === 'expiryDate' ? (formatDateToDDMMYYYY(item.validationVal) || '(Empty)') : (item.validationVal || '(Empty)')}
                            </span>
                            {item.selectedVal === 'validation' && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                            )}
                          </button>

                          {/* Client Value Option */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...mismatchFields];
                              updated[idx].selectedVal = 'client';
                              setMismatchFields(updated);
                            }}
                            className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1 relative overflow-hidden ${
                              item.selectedVal === 'client'
                                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-100'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Licensed Clients Registry</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {item.key === 'expiryDate' ? (formatDateToDDMMYYYY(item.clientVal) || '(Empty)') : (item.clientVal || '(Empty)')}
                            </span>
                            {item.selectedVal === 'client' && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setShowReconciliation(false);
                    }}
                    className="px-5 py-2.5 rounded-xl border bg-white hover:bg-slate-50 font-semibold text-xs text-slate-600 transition-all"
                  >
                    Cancel Selection
                  </button>
                  <button
                    type="button"
                    disabled={mismatchFields.some(m => !m.selectedVal) || isSubmitting}
                    onClick={handleResolveReconciliation}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Synchronizing...
                      </>
                    ) : (
                      'Resolve & Synchronize'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pdfModalUrl && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-200"
              >
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-sm">Validation PDF Document</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={pdfModalUrl}
                      download="Validation_Document.pdf"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      Download / Open
                    </a>
                    <button
                      type="button"
                      onClick={() => setPdfModalUrl(null)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-100 p-2 relative">
                  <iframe
                    src={pdfModalUrl}
                    className="w-full h-full rounded-xl border border-slate-200 shadow-inner bg-white"
                    title="Validation PDF Viewer"
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Authority Signature Modal */}
        <AnimatePresence>
          {showAddAuthorityModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add Authority Signature</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Assign an officer name to save to the official signatures library.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAuthorityModal(false);
                      setNewOfficerName('');
                      setNewOfficerTitle('');
                      setNewSigPreview('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Officer Name *</label>
                    <input
                      type="text"
                      value={newOfficerName}
                      onChange={(e) => setNewOfficerName(e.target.value)}
                      placeholder="e.g. Officer John Doe / C. Korir"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Designation / Title (Optional)</label>
                    <input
                      type="text"
                      value={newOfficerTitle}
                      onChange={(e) => setNewOfficerTitle(e.target.value)}
                      placeholder="e.g. Compliance Officer / Inspector"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>

                  {/* Mode toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Signature Input</label>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setNewSigMode('upload')}
                          className={`px-3 py-1 rounded-md transition-all ${
                            newSigMode === 'upload' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSigMode('draw')}
                          className={`px-3 py-1 rounded-md transition-all ${
                            newSigMode === 'draw' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          Draw Live
                        </button>
                      </div>
                    </div>

                    {newSigMode === 'upload' ? (
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors">
                        {newSigPreview ? (
                          <div className="relative inline-block">
                            <img
                              src={newSigPreview}
                              alt="Signature Preview"
                              className="h-24 object-contain bg-white rounded-lg p-2 border border-slate-200 shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setNewSigPreview('')}
                              className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-md hover:bg-rose-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block py-3">
                            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                            <span className="text-xs font-bold text-blue-600 hover:underline">
                              Click to upload signature image
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, or JPEG file</p>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleNewSigFileUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-1 bg-slate-50">
                          <SignatureCanvas
                            ref={authSigCanvasRef}
                            penColor="#0f172a"
                            canvasProps={{
                              className: 'w-full h-28 bg-white rounded-xl border border-slate-100 cursor-crosshair'
                            }}
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => authSigCanvasRef.current?.clear()}
                            className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 cursor-pointer"
                          >
                            Clear Pad
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAuthorityModal(false);
                      setNewOfficerName('');
                      setNewOfficerTitle('');
                      setNewSigPreview('');
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingNewSig}
                    onClick={handleSaveNewAuthoritySignature}
                    className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingNewSig ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Save & Select Signature
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <footer className="mt-12 text-center text-gray-400 text-[10px] uppercase tracking-widest pb-8">
          &copy; {new Date().getFullYear()} Kenya Dairy Board &bull; Quality Milk for Health and Wealth
        </footer>
      </div>
    </div>
  );
}

export default DataValidationModule;
