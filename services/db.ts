import { 
  AgreementData, 
  DebtorRecord, 
  StaffConfig, 
  ClosureNotificationData, 
  LicensedClient, 
  ClientReturn, 
  DataValidation, 
  getIndividualValidationsCount, 
  ValidationDraft, 
  AuthoritySignature, 
  DboPremiseSignature,
  ScopeDisclosureRecord,
  ClientQueryParams,
  PaginatedResult,
  ReturnQueryParams,
  PaginatedReturnsResult
} from '../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createSafeSupabaseClient, isSupabaseDisabled } from '../components/lib/supabase';
import { areNamesMatching, searchMatches, cleanPermitNumber } from '../components/lib/nameMatching';

let supabase: SupabaseClient | null = null;
let supabasePromise: Promise<SupabaseClient | null> | null = null;
let isFetchingConfig = false;
let configPromise: Promise<any> | null = null;

const fetchConfig = async () => {
  if (configPromise) return configPromise;
  isFetchingConfig = true;
  configPromise = (async () => {
    try {
      console.log("[DBService] Fetching config from /api/config...");
      const response = await fetch('/api/config');
      if (response.ok) {
        try {
          const config = await response.json();
          (window as any)._env_ = config;
          console.log("[DBService] Config loaded successfully from server:", {
            hasUrl: !!config.VITE_SUPABASE_URL,
            hasKey: !!config.VITE_SUPABASE_ANON_KEY
          });
          return config;
        } catch (jsonErr) {
          console.warn("[DBService] Notice parsing config JSON:", jsonErr);
          throw jsonErr;
        }
      } else {
        console.warn(`[DBService] Notice fetching config (${response.status})`);
      }
    } catch (e) {
      console.warn("[DBService] Network notice fetching config:", e);
    } finally {
      isFetchingConfig = false;
    }
    return null;
  })();
  return configPromise;
};

export const safeFetchJson = async <T = any>(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 4000
): Promise<T | null> => {
  let timeoutId: any;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`[DBService] Local API response notice (${response.status}) for ${url}`);
      return null;
    }
    const data = await response.json();
    return data as T;
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn(`[DBService] Local API notice for ${url} (using cache):`, err?.message || err);
    return null;
  }
};

const getSupabase = async () => {
  if (isSupabaseDisabled()) {
    return null;
  }
  if (supabase) return supabase;
  if (supabasePromise) return supabasePromise;

  supabasePromise = (async () => {
    let env = (window as any)._env_;
    
    if (!env) {
      env = await fetchConfig() || {};
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey) {
      try {
        if ((window as any).__supabaseInstance) {
          supabase = (window as any).__supabaseInstance;
        } else {
          const client = createSafeSupabaseClient(supabaseUrl, supabaseKey);
          supabase = client;
          (window as any).__supabaseInstance = client;
        }
        console.log("[DBService] Supabase client initialized successfully (Singleton)");
        return supabase;
      } catch (e) {
        console.error("[DBService] Supabase init error:", e);
      }
    } else {
      console.warn("[DBService] Supabase credentials missing. URL:", !!supabaseUrl, "Key:", !!supabaseKey);
    }
    supabasePromise = null; // Reset if failed so we can try again
    return null;
  })();
  
  return supabasePromise;
};

// Helper to map JS camelCase to DB lowercase
const toDb = (obj: any) => {
  const out: any = {};
  for (const k in obj) {
    out[k.toLowerCase()] = obj[k];
  }
  return out;
};

// Helper to map DB lowercase back to JS camelCase (for compatibility with existing UI)
const fromDb = (obj: any, template: any) => {
  if (!obj) return obj;
  const out: any = { ...obj };
  // If the template has camelCase keys, map the lowercase DB keys back to them
  for (const k in template) {
    const lowerK = k.toLowerCase();
    if (obj[lowerK] !== undefined && k !== lowerK) {
      out[k] = obj[lowerK];
    }
  }
  return out;
};

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[LocalStorage] Could not write to ${key}:`, err);
  }
};

export const formatCustomerNumber = (idOrNum?: string, clientName?: string, premiseName?: string): string => {
  if (idOrNum && typeof idOrNum === 'string') {
    const trimmed = idOrNum.trim();
    if (/^CUST-\d+/i.test(trimmed)) return trimmed.toUpperCase();
    if (/^\d{4,8}$/.test(trimmed)) return `CUST-${trimmed}`;
  }
  // Generate deterministic 5-digit number from name + premise or random fallback
  let hash = 0;
  const str = `${clientName || ''}::${premiseName || ''}::${idOrNum || ''}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 90000) + 10000;
  return `CUST-${positive}`;
};

// Custom translators for LicensedClient to map cleanly to the 19 actual Supabase columns
const clientToDb = (client: any) => {
  if (!client) return client;
  const pNo = String(client.permitNumber || client.permitnumber || '').trim();
  const custNo = String(client.customerNumber || client.customernumber || formatCustomerNumber(client.id, client.clientName, client.premiseName)).trim();
  const rawId = String(client.id || '').trim();
  // Never default unique ID to permit number because multiple clients can share the same permit number
  const idVal = (rawId && !rawId.includes('/')) ? rawId : (custNo || `CLI-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

  let branchesVal: any[] = [];
  if (Array.isArray(client.branches)) {
    branchesVal = client.branches;
  } else if (typeof client.branches === 'string' && client.branches.trim() !== '') {
    try {
      branchesVal = JSON.parse(client.branches);
    } catch {
      branchesVal = [];
    }
  }

  const out: any = {
    id: idVal,
    customernumber: custNo,
    clientname: String(client.clientName ?? client.clientname ?? '').trim(),
    premisename: String(client.premiseName ?? client.premisename ?? '').trim(),
    premisecategory: String(client.premiseCategory ?? client.premisecategory ?? 'Milk Bar').trim(),
    startyear: Number(client.startYear ?? client.startyear ?? new Date().getFullYear()),
    startmonth: String(client.startMonth ?? client.startmonth ?? 'January').trim(),
    endyear: (client.endYear !== undefined && client.endYear !== null && !isNaN(Number(client.endYear))) ? Number(client.endYear) : null,
    endmonth: client.endMonth ? String(client.endMonth).trim() : null,
    tel: String(client.tel ?? '').trim(),
    contactperson: String(client.contactPerson ?? client.contactperson ?? '').trim(),
    location: String(client.location ?? '').trim() || 'N/A',
    county: String(client.county ?? '').trim() || 'N/A',
    coolingcapacity: (client.coolingCapacity !== undefined && client.coolingCapacity !== null && !isNaN(Number(client.coolingCapacity))) ? Number(client.coolingCapacity) : null,
    permitstatus: String(client.permitStatus ?? client.permitstatus ?? 'valid').trim(),
    operationalstatus: String(client.operationalStatus ?? client.operationalstatus ?? 'operating').trim(),
    levyinfo: String((client.operationalStatus === 'closed' || client.operationalstatus === 'closed') ? 'DNQ-R' : (client.levyInfo ?? client.levyinfo ?? '')).trim(),
    expirydate: String(client.expiryDate ?? client.expirydate ?? '').trim(),
    permitnumber: pNo,
    branches: branchesVal
  };
  return out;
};

const returnToDb = (r: any) => {
  if (!r) return r;
  return {
    id: String(r.id || `RET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`).trim(),
    clientid: String(r.clientId ?? r.clientid ?? '').trim(),
    clientname: String(r.clientName ?? r.clientname ?? '').trim(),
    year: Number(r.year ?? 2026),
    period: String(r.period ?? 'January').trim(),
    qty: Number(r.qty ?? 0),
    invoiceamount: Number(r.invoiceAmount ?? r.invoiceamount ?? 0),
    returndate: String(r.returnDate ?? r.returndate ?? new Date().toISOString().slice(0, 10)).trim(),
    paymentamount: Number(r.paymentAmount ?? r.paymentamount ?? 0),
    paymentdate: String(r.paymentDate ?? r.paymentdate ?? '').trim(),
    txnref: String(r.txnRef ?? r.txnref ?? '').trim(),
    lesscf: Number(r.lessCF ?? r.lesscf ?? 0),
    outstandingbalance: Number(r.outstandingBalance ?? r.outstandingbalance ?? 0),
    agingdays: Number(r.agingDays ?? r.agingdays ?? 0),
    paymentstatus: String(r.paymentStatus ?? r.paymentstatus ?? 'Unpaid').trim(),
    comments: String(r.comments ?? '').trim()
  };
};

const returnFromDb = (dbObj: any): ClientReturn => {
  if (!dbObj) return dbObj;
  return {
    id: String(dbObj.id || '').trim(),
    clientId: String(dbObj.clientid ?? dbObj.client_id ?? dbObj.clientId ?? '').trim(),
    clientName: String(dbObj.clientname ?? dbObj.client_name ?? dbObj.clientName ?? '').trim(),
    year: Number(dbObj.year ?? 2026),
    period: String(dbObj.period ?? 'January').trim(),
    qty: Number(dbObj.qty ?? dbObj.quantity ?? 0),
    invoiceAmount: Number(dbObj.invoiceamount ?? dbObj.invoice_amount ?? dbObj.invoiceAmount ?? 0),
    returnDate: String(dbObj.returndate ?? dbObj.return_date ?? dbObj.returnDate ?? '').trim(),
    paymentAmount: Number(dbObj.paymentamount ?? dbObj.payment_amount ?? dbObj.paymentAmount ?? 0),
    paymentDate: String(dbObj.paymentdate ?? dbObj.payment_date ?? dbObj.paymentDate ?? '').trim(),
    txnRef: String(dbObj.txnref ?? dbObj.txn_ref ?? dbObj.txnRef ?? '').trim(),
    lessCF: Number(dbObj.lesscf ?? dbObj.less_cf ?? dbObj.lessCF ?? 0),
    outstandingBalance: Number(dbObj.outstandingbalance ?? dbObj.outstanding_balance ?? dbObj.outstandingBalance ?? 0),
    agingDays: Number(dbObj.agingdays ?? dbObj.aging_days ?? dbObj.agingDays ?? 0),
    paymentStatus: (dbObj.paymentstatus ?? dbObj.payment_status ?? dbObj.paymentStatus ?? 'Unpaid') as any,
    comments: String(dbObj.comments ?? '').trim()
  };
};

const clientFromDb = (dbObj: any): LicensedClient => {
  if (!dbObj) return dbObj;
  const out: any = { ...dbObj };
  
  const clientName = dbObj.clientname ?? dbObj.client_name ?? dbObj.clientName;
  if (clientName !== undefined) out.clientName = String(clientName).trim();

  const premiseName = dbObj.premisename ?? dbObj.premises ?? dbObj.premise_name ?? dbObj.premiseName;
  if (premiseName !== undefined) out.premiseName = String(premiseName).trim();

  if (dbObj.startyear !== undefined || dbObj.start_year !== undefined) {
    out.startYear = Number(dbObj.startyear ?? dbObj.start_year);
  }
  if (dbObj.startmonth !== undefined || dbObj.start_month !== undefined) {
    out.startMonth = dbObj.startmonth ?? dbObj.start_month;
  }
  if (dbObj.endyear !== undefined || dbObj.end_year !== undefined) {
    const ey = dbObj.endyear ?? dbObj.end_year;
    out.endYear = ey ? Number(ey) : null;
  }
  if (dbObj.endmonth !== undefined || dbObj.end_month !== undefined) {
    out.endMonth = dbObj.endmonth ?? dbObj.end_month;
  }
  
  if (dbObj.tel !== undefined || dbObj.phone !== undefined) {
    out.tel = dbObj.tel ?? dbObj.phone;
  }
  
  const contactPerson = dbObj.contactperson ?? dbObj.contacts ?? dbObj.contact_person ?? dbObj.contactPerson;
  if (contactPerson !== undefined) out.contactPerson = contactPerson;

  if (dbObj.location !== undefined) out.location = dbObj.location;

  const rawCat = dbObj.premisecategory ?? dbObj.premise_category ?? dbObj.category ?? dbObj.premiseCategory ?? dbObj.client_category ?? dbObj.clientCategory;
  if (rawCat !== undefined && rawCat !== null) {
    out.premiseCategory = String(rawCat).trim();
  } else if (!out.premiseCategory) {
    out.premiseCategory = 'Milk Bar';
  }

  if (dbObj.county !== undefined) out.county = dbObj.county;
  if (dbObj.coolingcapacity !== undefined || dbObj.cooling_capacity !== undefined) {
    const cc = dbObj.coolingcapacity ?? dbObj.cooling_capacity;
    out.coolingCapacity = cc ? Number(cc) : undefined;
  }
  if (dbObj.permitstatus !== undefined || dbObj.permit_status !== undefined) {
    out.permitStatus = dbObj.permitstatus ?? dbObj.permit_status;
  }
  if (dbObj.operationalstatus !== undefined || dbObj.operational_status !== undefined) {
    out.operationalStatus = dbObj.operationalstatus ?? dbObj.operational_status;
  }
  if (dbObj.levyinfo !== undefined || dbObj.levy_info !== undefined) {
    out.levyInfo = dbObj.levyinfo ?? dbObj.levy_info;
  }
  if (out.operationalStatus === 'closed') {
    out.levyInfo = 'DNQ-R';
  }

  const expiryDate = dbObj.expirydate ?? dbObj.expiry_date ?? dbObj.expiryDate;
  if (expiryDate !== undefined) out.expiryDate = expiryDate;

  const permitNumber = dbObj.permitnumber ?? dbObj.permit_number ?? dbObj.permitNumber;
  if (permitNumber !== undefined) {
    out.permitNumber = String(permitNumber).trim();
  }
  
  const rawCust = dbObj.customernumber ?? dbObj.customer_number ?? dbObj.customerNumber;
  const rawId = dbObj.id !== undefined ? String(dbObj.id).trim() : '';
  const customerNumber = rawCust ? String(rawCust).trim() : formatCustomerNumber(rawId, out.clientName, out.premiseName);
  out.customerNumber = customerNumber;

  // Use explicit ID or customer number, avoiding permit number as unique ID
  out.id = (rawId && !rawId.includes('/')) ? rawId : (customerNumber || `CLI-${Date.now()}`);
  
  if (dbObj.branches !== undefined) {
    if (typeof dbObj.branches === 'string') {
      try {
        out.branches = JSON.parse(dbObj.branches);
      } catch {
        out.branches = [];
      }
    } else {
      out.branches = dbObj.branches || [];
    }
  }
  return out as LicensedClient;
};

const safeJson = async (response: Response): Promise<any> => {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') return null;
    return JSON.parse(text);
  } catch (e: any) {
    console.error("[DBService] safeJson failed:", e);
    return null;
  }
};

const safeParseError = async (response: Response, defaultMessage: string): Promise<string> => {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') return defaultMessage;
    try {
      const parsed = JSON.parse(text);
      return parsed.error || parsed.message || defaultMessage;
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("<head")) {
        return defaultMessage;
      }
      return text || defaultMessage;
    }
  } catch (e: any) {
    return `${defaultMessage} (${e.message})`;
  }
};

const getArrayFromLocalStorage = <T = any>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const updateLocalStorageCollection = <T extends Record<string, any>>(key: string, item: T, idField: string = 'id') => {
  try {
    const items = getArrayFromLocalStorage<T>(key);
    const itemId = item[idField] || item.id || item.referenceNumber;
    const idx = items.findIndex(i => (i[idField] || i.id || i.referenceNumber) === itemId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item };
    } else {
      items.unshift(item);
    }
    safeSetLocalStorage(key, JSON.stringify(items));
  } catch (e) {
    console.error(`[DBService] Error updating localStorage collection ${key}:`, e);
  }
};

const removeFromLocalStorageCollection = <T extends Record<string, any>>(key: string, id: string, idField: string = 'id') => {
  try {
    const items = getArrayFromLocalStorage<T>(key);
    const filtered = items.filter(i => (i[idField] || i.id || i.referenceNumber) !== id);
    safeSetLocalStorage(key, JSON.stringify(filtered));
  } catch (e) {
    console.error(`[DBService] Error removing from localStorage collection ${key}:`, e);
  }
};

// In-memory validation cache for 0ms synchronous lookups and debounced synchronization
let validationsMemoryCache: DataValidation[] | null = null;
let validationsCacheTimestamp = 0;
let isRevalidatingValidations = false;
let lastRevalidationTime = 0;
const VALIDATIONS_CACHE_TTL_MS = 60000; // 1 minute TTL for in-memory cache

// In-memory validation drafts cache
let validationDraftsMemoryCache: ValidationDraft[] | null = null;
let validationDraftsCacheTimestamp = 0;

// Universal in-memory caches and request deduplication to minimize Supabase egress
// Kept to 20 seconds so changes from mobile or other devices synchronize promptly
const DEFAULT_CACHE_TTL_MS = 20 * 1000; 

let agreementsMemoryCache: AgreementData[] | null = null;
let agreementsCacheTimestamp = 0;
let agreementsInFlightPromise: Promise<AgreementData[]> | null = null;

let closuresMemoryCache: ClosureNotificationData[] | null = null;
let closuresCacheTimestamp = 0;
let closuresInFlightPromise: Promise<ClosureNotificationData[]> | null = null;

let debtorsMemoryCache: DebtorRecord[] | null = null;
let debtorsCacheTimestamp = 0;
let debtorsInFlightPromise: Promise<DebtorRecord[]> | null = null;

let staffConfigMemoryCache: StaffConfig | null = null;
let staffConfigCacheTimestamp = 0;
let staffConfigInFlightPromise: Promise<StaffConfig> | null = null;

let clientsMemoryCache: LicensedClient[] | null = null;
let clientsCacheTimestamp = 0;
let clientsInFlightPromise: Promise<LicensedClient[]> | null = null;

let returnsMemoryCache: ClientReturn[] | null = null;
let returnsCacheTimestamp = 0;
let returnsInFlightPromise: Promise<ClientReturn[]> | null = null;

export const DBService = {
  // Export Supabase client promise for realtime listeners across devices
  getSupabaseClient(): Promise<SupabaseClient | null> {
    return getSupabase();
  },

  // Invalidate in-memory caches to guarantee fresh cross-device data
  clearMemoryCache(table?: string): void {
    if (!table || table === 'agreements') {
      agreementsMemoryCache = null;
      agreementsCacheTimestamp = 0;
      agreementsInFlightPromise = null;
    }
    if (!table || table === 'closures') {
      closuresMemoryCache = null;
      closuresCacheTimestamp = 0;
      closuresInFlightPromise = null;
    }
    if (!table || table === 'staff_config' || table === 'staff') {
      staffConfigMemoryCache = null;
      staffConfigCacheTimestamp = 0;
      staffConfigInFlightPromise = null;
    }
    if (!table || table === 'clients') {
      clientsMemoryCache = null;
      clientsCacheTimestamp = 0;
      clientsInFlightPromise = null;
    }
    if (!table || table === 'returns') {
      returnsMemoryCache = null;
      returnsCacheTimestamp = 0;
      returnsInFlightPromise = null;
    }
    if (!table || table === 'debtors') {
      debtorsMemoryCache = null;
      debtorsCacheTimestamp = 0;
      debtorsInFlightPromise = null;
    }
    if (!table || table === 'validations') {
      validationsMemoryCache = null;
      validationsCacheTimestamp = 0;
    }
  },

  // Synchronous, zero-latency validation getter from in-memory or localStorage cache
  getCachedValidations(): DataValidation[] {
    if (validationsMemoryCache && Array.isArray(validationsMemoryCache) && validationsMemoryCache.length > 0) {
      return validationsMemoryCache;
    }
    const cached = localStorage.getItem('kdb_validations_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          validationsMemoryCache = parsed;
          validationsCacheTimestamp = Date.now();
          return parsed;
        }
      } catch (_) {}
    }
    const local = getArrayFromLocalStorage<DataValidation>('kdb_validations_cache');
    const safe = Array.isArray(local) ? local : [];
    validationsMemoryCache = safe;
    return safe;
  },
  async fetchConfig() {
    return await fetchConfig();
  },
  async getAgreements(forceFresh: boolean = false): Promise<AgreementData[]> {
    const now = Date.now();
    if (!forceFresh && agreementsMemoryCache && Array.isArray(agreementsMemoryCache) && (now - agreementsCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return agreementsMemoryCache;
    }

    if (!forceFresh) {
      const cached = localStorage.getItem('kdb_agreements_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            agreementsMemoryCache = parsed;
            agreementsCacheTimestamp = now;
            return parsed;
          }
        } catch (_) {}
      }
    }

    if (agreementsInFlightPromise) {
      return agreementsInFlightPromise;
    }

    const fetchAgreementsPromise = (async (): Promise<AgreementData[]> => {
      const client = await getSupabase();
      if (!client) {
        console.warn("[DBService] Supabase not initialized, trying local API");
        const data = await safeFetchJson<AgreementData[]>('/api/agreements');
        if (data && Array.isArray(data)) {
          agreementsMemoryCache = data;
          agreementsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_agreements_cache', JSON.stringify(data));
          return data;
        }
        
        const local = getArrayFromLocalStorage<AgreementData>('kdb_agreements_cache');
        agreementsMemoryCache = local;
        agreementsCacheTimestamp = Date.now();
        return local;
      }

      try {
        const { data, error } = await client
          .from('agreements')
          .select('*')
          .order('submittedat', { ascending: false });
        
        if (error) {
          console.warn("[DBService] Supabase getAgreements failed, falling back to local API. Error:", error);
          throw error;
        }
        
        // Map back to camelCase for the UI
        const agreements = (data || []).map(a => fromDb(a, {
          id: '', status: '', date: '', clientEmail: '', poBox: '', code: '',
          clientSignature: '', officialSignature: '', officialName: '',
          rejectionReason: '', resubmissionReason: '', clientName: '',
          clientTitle: '', submittedAt: '', approvedAt: '', dboName: '',
          premiseName: '', permitNo: '', location: '', county: '',
          totalArrears: 0, totalArrearsWords: '', arrearsPeriod: '',
          debitNoteNo: '', tel: '', arrearsBreakdown: null, installments: []
        })) as AgreementData[];
        
        agreementsMemoryCache = agreements;
        agreementsCacheTimestamp = Date.now();
        safeSetLocalStorage('kdb_agreements_cache', JSON.stringify(agreements));
        return agreements;
      } catch (error) {
        console.warn("[DBService] Supabase getAgreements exception, trying local API fallback. Error:", error);
        const data = await safeFetchJson<AgreementData[]>('/api/agreements');
        if (data && Array.isArray(data)) {
          agreementsMemoryCache = data;
          agreementsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_agreements_cache', JSON.stringify(data));
          return data;
        }
        const local = localStorage.getItem('kdb_agreements_cache');
        const parsed = local ? JSON.parse(local) : [];
        agreementsMemoryCache = parsed;
        agreementsCacheTimestamp = Date.now();
        return parsed;
      } finally {
        agreementsInFlightPromise = null;
      }
    })();

    agreementsInFlightPromise = fetchAgreementsPromise;
    return fetchAgreementsPromise;
  },

  async saveAgreement(agreement: AgreementData): Promise<void> {
    const saveLocal = async () => {
      console.log("[DBService] Saving agreement to local API / storage...");
      try {
        await fetch('/api/agreements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agreement)
        });
      } catch (e) {
        console.warn("[DBService] Local API saveAgreement error:", e);
      }
      updateLocalStorageCollection('kdb_agreements_cache', agreement);
      if (agreementsMemoryCache) {
        const idx = agreementsMemoryCache.findIndex(a => a.id === agreement.id);
        if (idx >= 0) agreementsMemoryCache[idx] = agreement;
        else agreementsMemoryCache.unshift(agreement);
      } else {
        agreementsMemoryCache = [agreement];
      }
      agreementsCacheTimestamp = Date.now();
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API");
      try {
        await saveLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API save error:", e);
        const missing = [];
        const sUrl = import.meta.env.VITE_SUPABASE_URL || (window as any)._env_?.VITE_SUPABASE_URL;
        const sKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any)._env_?.VITE_SUPABASE_ANON_KEY;
        if (!sUrl) missing.push("VITE_SUPABASE_URL");
        if (!sKey) missing.push("VITE_SUPABASE_ANON_KEY");
        throw new Error(`Submission failed. Supabase not initialized (Missing: ${missing.join(", ")}) and Local API failed: ${e.message}`);
      }
    }

    try {
      console.log("[DBService] Attempting Supabase upsert to 'agreements' table...", { id: agreement.id });
      const dbAgreement = toDb(agreement);
      const { error } = await client
        .from('agreements')
        .upsert(dbAgreement);
      
      if (error) {
        console.warn("[DBService] Supabase agreement upsert failed, falling back to local API. Error details:", error);
        await saveLocal();
        return;
      }
      
      console.log("[DBService] Agreement saved to Supabase successfully");
      if (agreementsMemoryCache) {
        const idx = agreementsMemoryCache.findIndex(a => a.id === agreement.id);
        if (idx >= 0) agreementsMemoryCache[idx] = agreement;
        else agreementsMemoryCache.unshift(agreement);
      } else {
        agreementsMemoryCache = [agreement];
      }
      agreementsCacheTimestamp = Date.now();
      updateLocalStorageCollection('kdb_agreements_cache', agreement);
    } catch (error: any) {
      console.warn("[DBService] Supabase saveAgreement exception, falling back to local API. Error:", error);
      try {
        await saveLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for saveAgreement:", localErr);
        throw new Error(`Submission failed. Supabase Error: ${error.message}. Local API Error: ${localErr.message}`);
      }
    }
  },

  async updateAgreement(id: string, updates: Partial<AgreementData>): Promise<void> {
    const updateLocal = async () => {
      console.log("[DBService] Updating agreement via local API / storage...");
      try {
        await fetch(`/api/agreements/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      } catch (e) {
        console.warn("[DBService] Local API updateAgreement error:", e);
      }
      if (agreementsMemoryCache) {
        const idx = agreementsMemoryCache.findIndex(i => i.id === id);
        if (idx >= 0) {
          agreementsMemoryCache[idx] = { ...agreementsMemoryCache[idx], ...updates };
        }
      }
      agreementsCacheTimestamp = Date.now();
      const items = getArrayFromLocalStorage<AgreementData>('kdb_agreements_cache');
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates };
        safeSetLocalStorage('kdb_agreements_cache', JSON.stringify(items));
      }
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API");
      try {
        await updateLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API update error:", e);
        throw new Error(`Update failed: ${e.message}`);
      }
    }

    try {
      console.log("[DBService] Attempting Supabase update to 'agreements' table...", { id, updates });
      const dbUpdates = toDb(updates);
      const { error } = await client
        .from('agreements')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) {
        console.warn("[DBService] Supabase updateAgreement failed, falling back to local API. Error details:", error);
        await updateLocal();
        return;
      }
      
      console.log("[DBService] Agreement updated in Supabase successfully");
      if (agreementsMemoryCache) {
        const idx = agreementsMemoryCache.findIndex(i => i.id === id);
        if (idx >= 0) {
          agreementsMemoryCache[idx] = { ...agreementsMemoryCache[idx], ...updates };
        }
      }
      agreementsCacheTimestamp = Date.now();
      const items = getArrayFromLocalStorage<AgreementData>('kdb_agreements_cache');
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates };
        safeSetLocalStorage('kdb_agreements_cache', JSON.stringify(items));
      }
    } catch (error: any) {
      console.warn("[DBService] Supabase updateAgreement exception, falling back to local API. Error:", error);
      try {
        await updateLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for updateAgreement:", localErr);
        throw new Error(`Update failed. Supabase Error: ${error.message}. Local API Error: ${localErr.message}`);
      }
    }
  },

  async deleteAgreement(id: string): Promise<void> {
    const deleteLocal = async () => {
      console.log("[DBService] Deleting agreement via local API...");
      try {
        await fetch(`/api/agreements/${id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("[DBService] Local API delete agreement error:", e);
      }
      if (agreementsMemoryCache) {
        agreementsMemoryCache = agreementsMemoryCache.filter(a => a.id !== id);
      }
      agreementsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_agreements_cache', id, 'id');
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API");
      try {
        await deleteLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API delete error:", e);
        throw new Error(`Delete failed: ${e.message}`);
      }
    }

    try {
      const { error } = await client
        .from('agreements')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn("[DBService] Supabase deleteAgreement failed, falling back to local API. Error details:", error);
        await deleteLocal();
        return;
      }
      
      if (agreementsMemoryCache) {
        agreementsMemoryCache = agreementsMemoryCache.filter(a => a.id !== id);
      }
      agreementsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_agreements_cache', id, 'id');
    } catch (error: any) {
      console.warn("[DBService] Supabase deleteAgreement exception, falling back to local API. Error:", error);
      try {
        await deleteLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for deleteAgreement:", localErr);
        throw error;
      }
    }
  },

  async getClosures(forceFresh: boolean = false): Promise<ClosureNotificationData[]> {
    const decodeClosures = (list: any[]) => {
      return list.map(c => {
        let name = c.clientName || '';
        let title = c.clientTitle || '';
        if (name.includes(' |Title:')) {
          const parts = name.split(' |Title:');
          name = parts[0];
          title = parts[1];
        }

        let offName = c.officialName || '';
        let offTitle = c.officialTitle || '';
        let offComments = c.officialComments || '';
        
        if (offName.includes(' |Title:')) {
          const partsTitle = offName.split(' |Title:');
          offName = partsTitle[0];
          const remaining = partsTitle[1];
          if (remaining.includes(' |Comments:')) {
            const partsComments = remaining.split(' |Comments:');
            offTitle = partsComments[0];
            offComments = partsComments[1];
          } else {
            offTitle = remaining;
          }
        } else if (offName.includes(' |Comments:')) {
          const partsComments = offName.split(' |Comments:');
          offName = partsComments[0];
          offComments = partsComments[1];
        }

        return {
          ...c,
          clientName: name,
          clientTitle: title,
          officialName: offName,
          officialTitle: offTitle,
          officialComments: offComments
        };
      });
    };

    const now = Date.now();
    if (!forceFresh && closuresMemoryCache && Array.isArray(closuresMemoryCache) && (now - closuresCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return closuresMemoryCache;
    }

    if (!forceFresh) {
      const cached = localStorage.getItem('kdb_closures_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const decoded = decodeClosures(parsed);
            closuresMemoryCache = decoded;
            closuresCacheTimestamp = now;
            return decoded;
          }
        } catch (_) {}
      }
    }

    if (closuresInFlightPromise) {
      return closuresInFlightPromise;
    }

    const fetchClosuresPromise = (async (): Promise<ClosureNotificationData[]> => {
      const client = await getSupabase();
      if (!client) {
        console.warn("[DBService] Supabase not initialized, trying local API for closures");
        const data = await safeFetchJson<any[]>('/api/closures');
        if (data && Array.isArray(data)) {
          const decoded = decodeClosures(data);
          closuresMemoryCache = decoded;
          closuresCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_closures_cache', JSON.stringify(decoded));
          return decoded;
        }
        
        const local = getArrayFromLocalStorage<ClosureNotificationData>('kdb_closures_cache');
        const decoded = decodeClosures(local);
        closuresMemoryCache = decoded;
        closuresCacheTimestamp = Date.now();
        return decoded;
      }

      try {
        const { data, error } = await client
          .from('closures')
          .select('*')
          .order('submittedat', { ascending: false });
        
        if (error) {
          console.warn("[DBService] Supabase getClosures failed, falling back to local API. Error details:", error);
          throw error;
        }
        
        const closures = (data || []).map(b => fromDb(b, {
          id: '', status: '', submittedAt: '', approvedAt: '', dboName: '',
          permitNo: '', premiseName: '', permitType: '', county: '',
          subCounty: '', location: '', tel: '', closureDate: '',
          closureReason: '', permitStatusIntent: '', declarationAgreed: false,
          clientSignature: '', clientName: '', clientTitle: '', officialSignature: '',
          officialName: '', officialTitle: '', officialComments: '', rejectionReason: ''
        })) as ClosureNotificationData[];
        
        const decoded = decodeClosures(closures);
        closuresMemoryCache = decoded;
        closuresCacheTimestamp = Date.now();
        safeSetLocalStorage('kdb_closures_cache', JSON.stringify(decoded));
        return decoded;
      } catch (error) {
        console.warn("[DBService] Supabase getClosures exception, trying local API. Error:", error);
        const data = await safeFetchJson<any[]>('/api/closures');
        if (data && Array.isArray(data)) {
          const decoded = decodeClosures(data);
          closuresMemoryCache = decoded;
          closuresCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_closures_cache', JSON.stringify(decoded));
          return decoded;
        }
        const local = localStorage.getItem('kdb_closures_cache');
        const decoded = local ? decodeClosures(JSON.parse(local)) : [];
        closuresMemoryCache = decoded;
        closuresCacheTimestamp = Date.now();
        return decoded;
      } finally {
        closuresInFlightPromise = null;
      }
    })();

    closuresInFlightPromise = fetchClosuresPromise;
    return fetchClosuresPromise;
  },

  async saveClosure(closure: ClosureNotificationData): Promise<void> {
    const formattedClosure = {
      ...closure,
      clientName: closure.clientTitle ? `${closure.clientName} |Title:${closure.clientTitle}` : closure.clientName
    };

    const saveLocal = async () => {
      console.log("[DBService] Saving closure to local API / storage...");
      try {
        await fetch('/api/closures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedClosure)
        });
      } catch (e) {
        console.warn("[DBService] Local API saveClosure fetch error:", e);
      }
      updateLocalStorageCollection('kdb_closures_cache', formattedClosure);
      if (closuresMemoryCache) {
        const idx = closuresMemoryCache.findIndex(c => c.id === closure.id);
        if (idx >= 0) closuresMemoryCache[idx] = closure;
        else closuresMemoryCache.unshift(closure);
      } else {
        closuresMemoryCache = [closure];
      }
      closuresCacheTimestamp = Date.now();
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API for save closure");
      try {
        await saveLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API save error:", e);
        throw e;
      }
    }

    try {
      console.log("[DBService] Attempting Supabase upsert to 'closures' table...", { id: closure.id });
      const dbClosure = toDb(formattedClosure);
      delete dbClosure.clienttitle;
      delete dbClosure.officialtitle;
      delete dbClosure.officialcomments;

      const { error } = await client
        .from('closures')
        .upsert(dbClosure);
      
      if (error) {
        console.warn("[DBService] Supabase upsert failed, falling back to local API. Error details:", error);
        await saveLocal();
        return;
      }
      
      if (closuresMemoryCache) {
        const idx = closuresMemoryCache.findIndex(c => c.id === closure.id);
        if (idx >= 0) closuresMemoryCache[idx] = closure;
        else closuresMemoryCache.unshift(closure);
      } else {
        closuresMemoryCache = [closure];
      }
      closuresCacheTimestamp = Date.now();
      updateLocalStorageCollection('kdb_closures_cache', formattedClosure);
    } catch (error: any) {
      console.warn("[DBService] Supabase saveClosure exception, falling back to local API. Error:", error);
      try {
        await saveLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for saveClosure:", localErr);
        throw new Error(`Submission failed. Supabase Error: ${error.message}. Local API Error: ${localErr.message}`);
      }
    }
  },

  async updateClosure(id: string, updates: Partial<ClosureNotificationData>): Promise<void> {
    const updatesCopy = { ...updates };
    if (updatesCopy.clientName && updatesCopy.clientTitle) {
      updatesCopy.clientName = `${updatesCopy.clientName} |Title:${updatesCopy.clientTitle}`;
    }

    if (updatesCopy.officialName) {
      let name = updatesCopy.officialName;
      if (updatesCopy.officialTitle) {
        name = `${name} |Title:${updatesCopy.officialTitle}`;
      }
      if (updatesCopy.officialComments) {
        name = `${name} |Comments:${updatesCopy.officialComments}`;
      }
      updatesCopy.officialName = name;
    }

    const updateLocal = async () => {
      console.log("[DBService] Updating closure via local API / storage...");
      try {
        await fetch(`/api/closures/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatesCopy)
        });
      } catch (e) {
        console.warn("[DBService] Local API updateClosure fetch error:", e);
      }
      if (closuresMemoryCache) {
        const idx = closuresMemoryCache.findIndex(i => i.id === id);
        if (idx >= 0) {
          closuresMemoryCache[idx] = { ...closuresMemoryCache[idx], ...updates };
        }
      }
      closuresCacheTimestamp = Date.now();
      const items = getArrayFromLocalStorage<ClosureNotificationData>('kdb_closures_cache');
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updatesCopy };
        safeSetLocalStorage('kdb_closures_cache', JSON.stringify(items));
      }
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API for update closure");
      try {
        await updateLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API update error:", e);
        throw e;
      }
    }

    try {
      console.log("[DBService] Attempting Supabase update to 'closures' table...", { id, updates: updatesCopy });
      const dbUpdates = toDb(updatesCopy);
      delete dbUpdates.clienttitle;
      delete dbUpdates.officialtitle;
      delete dbUpdates.officialcomments;

      const { error } = await client
        .from('closures')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) {
        console.warn("[DBService] Supabase updateClosure failed, falling back to local API. Error details:", error);
        await updateLocal();
        return;
      }
      
      if (closuresMemoryCache) {
        const idx = closuresMemoryCache.findIndex(i => i.id === id);
        if (idx >= 0) {
          closuresMemoryCache[idx] = { ...closuresMemoryCache[idx], ...updates };
        }
      }
      closuresCacheTimestamp = Date.now();
      const items = getArrayFromLocalStorage<ClosureNotificationData>('kdb_closures_cache');
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updatesCopy };
        safeSetLocalStorage('kdb_closures_cache', JSON.stringify(items));
      }
    } catch (error: any) {
      console.warn("[DBService] Supabase updateClosure exception, falling back to local API. Error:", error);
      try {
        await updateLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for updateClosure:", localErr);
        throw new Error(`Update failed. Supabase Error: ${error.message}. Local API Error: ${localErr.message}`);
      }
    }
  },

  async deleteClosure(id: string): Promise<void> {
    const deleteLocal = async () => {
      console.log("[DBService] Deleting closure via local API...");
      try {
        await fetch(`/api/closures/${id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("[DBService] Local API delete closure error:", e);
      }
      if (closuresMemoryCache) {
        closuresMemoryCache = closuresMemoryCache.filter(c => c.id !== id);
      }
      closuresCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_closures_cache', id, 'id');
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, trying local API for delete closure");
      try {
        await deleteLocal();
        return;
      } catch (e: any) {
        console.error("[DBService] Local API delete error:", e);
        throw e;
      }
    }

    try {
      const { error } = await client
        .from('closures')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn("[DBService] Supabase deleteClosure failed, falling back to local API. Error details:", error);
        await deleteLocal();
        return;
      }
      
      if (closuresMemoryCache) {
        closuresMemoryCache = closuresMemoryCache.filter(c => c.id !== id);
      }
      closuresCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_closures_cache', id, 'id');
    } catch (error: any) {
      console.warn("[DBService] Supabase deleteClosure exception, falling back to local API. Error:", error);
      try {
        await deleteLocal();
      } catch (localErr: any) {
        console.error("[DBService] Both Supabase and Local API failed for deleteClosure:", localErr);
        throw error;
      }
    }
  },


  async getDebtors(forceFresh: boolean = false): Promise<DebtorRecord[]> {
    const now = Date.now();
    if (!forceFresh && debtorsMemoryCache && Array.isArray(debtorsMemoryCache) && (now - debtorsCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return debtorsMemoryCache;
    }

    if (!forceFresh) {
      const cached = localStorage.getItem('kdb_debtors_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            debtorsMemoryCache = parsed;
            debtorsCacheTimestamp = now;
            return parsed;
          }
        } catch (_) {}
      }
    }

    if (debtorsInFlightPromise) {
      return debtorsInFlightPromise;
    }

    const fetchDebtorsPromise = (async (): Promise<DebtorRecord[]> => {
      const fetchLocal = async () => {
        const data = await safeFetchJson<DebtorRecord[]>('/api/debtors');
        if (data && Array.isArray(data)) {
          debtorsMemoryCache = data;
          debtorsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_debtors_cache', JSON.stringify(data));
          return data;
        }
        const local = getArrayFromLocalStorage<DebtorRecord>('kdb_debtors_cache');
        debtorsMemoryCache = local;
        debtorsCacheTimestamp = Date.now();
        return local;
      };

      const client = await getSupabase();
      if (!client) {
        return await fetchLocal();
      }

      try {
        const { data, error } = await client
          .from('debtors')
          .select('*')
          .order('dboname', { ascending: true });
        
        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01' || String(error.message || '').includes('public.debtors')) {
            console.warn("[DBService] Supabase 'debtors' table not found in schema (PGRST205). Falling back to local storage.");
            return await fetchLocal();
          }
          throw error;
        }
        
        if (data && data.length > 0) {
          const debtors = data.map(d => fromDb(d, {
            id: '', dboName: '', premiseName: '', permitNo: '', location: '',
            county: '', totalArrears: 0, totalArrearsWords: '', arrearsPeriod: '',
            debitNoteNo: '', tel: '', arrearsBreakdown: null, installments: []
          })) as DebtorRecord[];
          debtorsMemoryCache = debtors;
          debtorsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_debtors_cache', JSON.stringify(debtors));
          return debtors;
        }
        debtorsMemoryCache = [];
        debtorsCacheTimestamp = Date.now();
        return [];
      } catch (error: any) {
        console.warn("[DBService] getDebtors fallback to local:", error?.message || error);
        return await fetchLocal();
      } finally {
        debtorsInFlightPromise = null;
      }
    })();

    debtorsInFlightPromise = fetchDebtorsPromise;
    return fetchDebtorsPromise;
  },

  async saveDebtors(debtors: DebtorRecord[]): Promise<void> {
    debtorsMemoryCache = debtors;
    debtorsCacheTimestamp = Date.now();
    safeSetLocalStorage('kdb_debtors_cache', JSON.stringify(debtors));

    const syncLocal = async () => {
      try {
        await fetch('/api/debtors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(debtors)
        });
      } catch (e) {
        console.warn("[DBService] Local API notice for saveDebtors:", e);
      }
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, synchronizing debtors via local API");
      await syncLocal();
      return;
    }

    try {
      const dbDebtors = debtors.map(d => toDb(d));
      const { error } = await client
        .from('debtors')
        .upsert(dbDebtors);
      
      if (error) {
        console.warn("[DBService] Supabase saveDebtors notice, falling back to local storage:", error?.message || error);
        await syncLocal();
        return;
      }

      // Background local backup sync
      syncLocal().catch(() => {});
    } catch (error: any) {
      console.warn("[DBService] Supabase saveDebtors exception, falling back to local API:", error?.message || error);
      await syncLocal();
    }
  },

  async getStaffConfig(forceFresh: boolean = false): Promise<StaffConfig> {
    const defaultModules = {
      levyAgreement: true,
      businessClosure: true,
    };

    const now = Date.now();
    if (!forceFresh && staffConfigMemoryCache && (now - staffConfigCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return staffConfigMemoryCache;
    }

    let cachedConfig: StaffConfig | null = null;
    const local = localStorage.getItem('kdb_staff_cache');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        cachedConfig = {
          ...parsed,
          enabledModules: {
            ...defaultModules,
            ...(parsed.enabledModules || {})
          }
        };
        if (!forceFresh) {
          staffConfigMemoryCache = cachedConfig;
          staffConfigCacheTimestamp = now;
          return cachedConfig;
        }
      } catch (e) {
        // fallback
      }
    }

    if (staffConfigInFlightPromise) {
      return staffConfigInFlightPromise;
    }

    const fetchConfigPromise = (async (): Promise<StaffConfig> => {
      const client = await getSupabase();
      if (!client) {
        try {
          const res = await fetch('/api/staff');
          if (res.ok) {
            const apiData = await res.json();
            if (apiData) {
              const merged = {
                ...apiData,
                enabledModules: { ...defaultModules, ...(apiData.enabledModules || {}) }
              };
              staffConfigMemoryCache = merged;
              staffConfigCacheTimestamp = Date.now();
              safeSetLocalStorage('kdb_staff_cache', JSON.stringify(merged));
              return merged;
            }
          }
        } catch (_) {}
        const fallback = cachedConfig || { officialSignature: '', enabledModules: defaultModules };
        staffConfigMemoryCache = fallback;
        staffConfigCacheTimestamp = Date.now();
        return fallback;
      }

      try {
        const { data, error } = await client
          .from('staff_config')
          .select('*')
          .eq('id', 1)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          const config = fromDb(data, { officialSignature: '', officialName: '', officialTitle: '' }) as StaffConfig;
          
          let rawModules = data.enabledmodules ?? data.enabledModules ?? (data as any).enabled_modules;
          if (typeof rawModules === 'string') {
            try { rawModules = JSON.parse(rawModules); } catch (e) { rawModules = null; }
          }
          
          const enabledModules = (rawModules && typeof rawModules === 'object' && Object.keys(rawModules).length > 0) 
            ? { ...defaultModules, ...rawModules }
            : (cachedConfig?.enabledModules || defaultModules);

          const finalConfig: StaffConfig = {
            ...config,
            enabledModules
          };

          staffConfigMemoryCache = finalConfig;
          staffConfigCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_staff_cache', JSON.stringify(finalConfig));
          return finalConfig;
        }

        const fallback = cachedConfig || { 
          officialSignature: '',
          enabledModules: defaultModules
        };
        staffConfigMemoryCache = fallback;
        staffConfigCacheTimestamp = Date.now();
        return fallback;
      } catch (error) {
        console.error("[DBService] getStaffConfig error:", error);
        const fallback = cachedConfig || { 
          officialSignature: '',
          enabledModules: defaultModules
        };
        staffConfigMemoryCache = fallback;
        staffConfigCacheTimestamp = Date.now();
        return fallback;
      } finally {
        staffConfigInFlightPromise = null;
      }
    })();

    staffConfigInFlightPromise = fetchConfigPromise;
    return fetchConfigPromise;
  },

  async saveStaffConfig(config: StaffConfig): Promise<void> {
    // Preserve authority signatures if not explicitly provided
    let authSigs = config.authoritySignatures;
    if (!authSigs || authSigs.length === 0) {
      try {
        const stored = localStorage.getItem('kdb_authority_signatures');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) authSigs = parsed;
        }
      } catch (_) {}
    }
    const fullConfig = {
      ...config,
      authoritySignatures: authSigs || []
    };

    staffConfigMemoryCache = fullConfig;
    staffConfigCacheTimestamp = Date.now();
    safeSetLocalStorage('kdb_staff_cache', JSON.stringify(fullConfig));

    try {
      await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullConfig)
      });
    } catch (e) {
      console.warn("[DBService] /api/staff save warning:", e);
    }

    const client = await getSupabase();
    if (!client) return;

    try {
      const payload: any = {
        id: 1,
        officialsignature: fullConfig.officialSignature || ''
      };
      if (fullConfig.officialName) payload.officialname = fullConfig.officialName;
      if (fullConfig.officialTitle) payload.officialtitle = fullConfig.officialTitle;
      if (fullConfig.enabledModules) payload.enabledmodules = JSON.stringify(fullConfig.enabledModules);

      const { error } = await client
        .from('staff_config')
        .upsert(payload);
      
      if (error) {
        console.warn("[DBService] saveStaffConfig detailed upsert notice, falling back to basic columns:", error.message);
        await client
          .from('staff_config')
          .upsert({ id: 1, officialsignature: fullConfig.officialSignature || '' });
      }
    } catch (error) {
      console.warn("[DBService] saveStaffConfig notice (using local storage):", error);
    }
  },

  async getAuthoritySignatures(forceFresh: boolean = false): Promise<AuthoritySignature[]> {
    let signatures: AuthoritySignature[] = [];
    
    // 1. PRIMARY SOURCE OF TRUTH: Direct query to authority_signatures table in Supabase
    try {
      const client = await getSupabase();
      if (client) {
        const { data, error } = await client
          .from('authority_signatures')
          .select('*')
          .order('display_order', { ascending: true });
        
        if (!error && Array.isArray(data) && data.length > 0) {
          signatures = data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name || 'Authorized Officer'),
            title: row.title ? String(row.title) : undefined,
            signature: String(row.signature || ''),
            isDefault: Boolean(row.is_default ?? row.isdefault),
            createdAt: row.created_at || row.createdat || undefined
          })).filter(s => !!s.signature);

          if (signatures.length > 0) {
            safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
            return signatures;
          }
        }

        // 2. FALLBACK A: Check kdb_validations system row
        const { data: valData, error: valErr } = await client
          .from('kdb_validations')
          .select('raw_data')
          .eq('id', 'system_authority_signatures')
          .maybeSingle();
        
        if (!valErr && valData?.raw_data?.signatures && Array.isArray(valData.raw_data.signatures) && valData.raw_data.signatures.length > 0) {
          signatures = valData.raw_data.signatures;
          safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
          return signatures;
        }

        // 3. FALLBACK B: Check staff_config table in Supabase
        const { data: staffRow } = await client
          .from('staff_config')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (staffRow && staffRow.officialsignature) {
          let rawAuthSigs = staffRow.authority_signatures || staffRow.authoritysignatures;
          if (typeof rawAuthSigs === 'string') {
            try { rawAuthSigs = JSON.parse(rawAuthSigs); } catch (_) { rawAuthSigs = null; }
          }
          if (Array.isArray(rawAuthSigs) && rawAuthSigs.length > 0) {
            signatures = rawAuthSigs;
            safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
            return signatures;
          }

          // If local cache already has multi-officer signatures, do not discard them for a single staffRow
          const localStored = localStorage.getItem('kdb_authority_signatures');
          if (localStored) {
            try {
              const parsed = JSON.parse(localStored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
              }
            } catch (_) {}
          }

          signatures = [{
            id: 'sig-supabase-official',
            name: (staffRow as any).officialname || 'Compliance Officer',
            title: (staffRow as any).officialtitle || 'Authorized Authority',
            signature: staffRow.officialsignature,
            createdAt: new Date().toISOString(),
            isDefault: true
          }];
          safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
          return signatures;
        }
      }
    } catch (supabaseErr) {
      console.warn("[DBService] Supabase authority signature query error, checking local/api fallback:", supabaseErr);
    }

    // 2. Offline / Fast Cache: Check local storage
    if (!forceFresh) {
      try {
        const stored = localStorage.getItem('kdb_authority_signatures');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            signatures = parsed;
            return signatures;
          }
        }
      } catch (e) {
        console.warn("[DBService] Error reading authority signatures from localStorage:", e);
      }
    }

    // 3. Check dedicated server API
    try {
      const res = await fetch('/api/authority-signatures');
      if (res.ok) {
        const apiSigs = await res.json();
        if (Array.isArray(apiSigs) && apiSigs.length > 0) {
          signatures = apiSigs;
          safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
          return signatures;
        }
      }
    } catch (e) {}

    // 4. Check staff cache and /api/staff
    try {
      const cachedStaff = localStorage.getItem('kdb_staff_cache');
      if (cachedStaff) {
        const parsed = JSON.parse(cachedStaff);
        if (Array.isArray(parsed.authoritySignatures) && parsed.authoritySignatures.length > 0) {
          signatures = parsed.authoritySignatures;
          return signatures;
        }
      }
    } catch (e) {}

    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const staff = await res.json();
        if (Array.isArray(staff.authoritySignatures) && staff.authoritySignatures.length > 0) {
          signatures = staff.authoritySignatures;
        } else if (staff.officialSignature) {
          signatures = [{
            id: 'sig-default-1',
            name: staff.officialName || 'Compliance Officer',
            title: staff.officialTitle || 'KDB Official Authority',
            signature: staff.officialSignature,
            createdAt: new Date().toISOString(),
            isDefault: true
          }];
        }
      }
    } catch (e) {}

    // Persist cache
    if (signatures.length > 0) {
      safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));
    }

    return signatures;
  },

  async saveAuthoritySignatures(signatures: AuthoritySignature[]): Promise<void> {
    // 1. Immediately update localStorage
    safeSetLocalStorage('kdb_authority_signatures', JSON.stringify(signatures));

    // 2. PRIMARY PERSISTENCE: Save directly to Supabase for multi-device synchronization
    try {
      const client = await getSupabase();
      if (client) {
        // A. Primary table: authority_signatures
        try {
          if (signatures.length > 0) {
            const rows = signatures.map((sig, idx) => ({
              id: String(sig.id),
              name: String(sig.name || 'Authorized Officer'),
              title: sig.title ? String(sig.title) : null,
              signature: String(sig.signature || ''),
              is_default: Boolean(sig.isDefault),
              display_order: idx,
              updated_at: new Date().toISOString()
            }));

            // Upsert all current signatures into authority_signatures table
            const { error: upsertErr } = await client
              .from('authority_signatures')
              .upsert(rows);

            if (!upsertErr) {
              console.log(`[DBService] Successfully upserted ${rows.length} signatures into Supabase authority_signatures table.`);
              // Remove any deleted signatures from authority_signatures table
              const activeIds = signatures.map(s => String(s.id));
              const { data: existingRows } = await client
                .from('authority_signatures')
                .select('id');

              if (Array.isArray(existingRows)) {
                const toDelete = existingRows
                  .map(r => String(r.id))
                  .filter(id => !activeIds.includes(id));
                if (toDelete.length > 0) {
                  await client.from('authority_signatures').delete().in('id', toDelete);
                }
              }
            } else {
              console.warn("[DBService] authority_signatures table upsert notice:", upsertErr.message);
            }
          } else {
            // If empty signatures array, clean table
            await client.from('authority_signatures').delete().neq('id', '');
          }
        } catch (tableErr: any) {
          console.warn("[DBService] authority_signatures table operation skipped/unsupported:", tableErr?.message);
        }

        // B. Upsert full authority signature list to kdb_validations system row
        try {
          await client.from('kdb_validations').upsert({
            id: 'system_authority_signatures',
            dbo_name: 'SYSTEM_AUTHORITY_SIGNATURES',
            premise_name: 'SYSTEM',
            permit_no: 'SYS-AUTH-SIG',
            validation_period: 'CONFIG',
            date: new Date().toISOString(),
            raw_data: { signatures, updatedAt: new Date().toISOString() }
          });
        } catch (valErr: any) {
          console.warn("[DBService] kdb_validations system row upsert notice:", valErr?.message);
        }

        // C. Keep staff_config table updated with default signature and authority_signatures json
        if (signatures.length > 0) {
          const defaultSig = signatures.find(s => s.isDefault) || signatures[0];
          try {
            await client.from('staff_config').upsert({
              id: 1,
              officialsignature: defaultSig.signature,
              officialname: defaultSig.name,
              officialtitle: defaultSig.title || '',
              authority_signatures: signatures
            });
          } catch (_) {
            try {
              await client.from('staff_config').upsert({
                id: 1,
                officialsignature: defaultSig.signature
              });
            } catch (err: any) {
              console.warn("[DBService] staff_config fallback save notice:", err?.message);
            }
          }
        }
      }
    } catch (supabaseErr) {
      console.warn("[DBService] Supabase authority signatures save warning:", supabaseErr);
    }

    // 3. Save to server API endpoint for authority signatures
    try {
      await fetch('/api/authority-signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatures })
      }).catch(() => {});
    } catch (e) {}

    // 4. Update staff config cache and server
    try {
      let currentStaff: any = {};
      const cached = localStorage.getItem('kdb_staff_cache');
      if (cached) {
        try { currentStaff = JSON.parse(cached); } catch (_) {}
      }
      currentStaff.authoritySignatures = signatures;
      if (signatures.length > 0) {
        const defaultSig = signatures.find(s => s.isDefault) || signatures[0];
        currentStaff.officialSignature = defaultSig.signature;
        currentStaff.officialName = defaultSig.name;
        if (defaultSig.title) currentStaff.officialTitle = defaultSig.title;
      }
      safeSetLocalStorage('kdb_staff_cache', JSON.stringify(currentStaff));

      await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentStaff)
      }).catch(() => {});
    } catch (e) {
      console.warn("[DBService] saveAuthoritySignatures sync error:", e);
    }

    // 5. Dispatch global event so open modules react immediately
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_authority_signatures_updated', { detail: signatures }));
      }
    } catch (_) {}
  },

  async addAuthoritySignature(sig: Omit<AuthoritySignature, 'id'> & { id?: string }): Promise<AuthoritySignature[]> {
    const current = await this.getAuthoritySignatures();
    const newSig: AuthoritySignature = {
      ...sig,
      id: sig.id || `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: sig.createdAt || new Date().toISOString(),
      isDefault: current.length === 0 || !!sig.isDefault
    };
    // If new signature is default, unmark others
    const baseList = newSig.isDefault ? current.map(s => ({ ...s, isDefault: false })) : current;
    const updated = [...baseList.filter(s => s.id !== newSig.id), newSig];
    await this.saveAuthoritySignatures(updated);
    return updated;
  },

  async deleteAuthoritySignature(id: string): Promise<AuthoritySignature[]> {
    const current = await this.getAuthoritySignatures();
    let updated = current.filter(s => s.id !== id);
    if (updated.length > 0 && !updated.some(s => s.isDefault)) {
      updated[0].isDefault = true;
    }
    await this.saveAuthoritySignatures(updated);
    return updated;
  },

  async reorderAuthoritySignatures(newSignatures: AuthoritySignature[]): Promise<AuthoritySignature[]> {
    await this.saveAuthoritySignatures(newSignatures);
    return newSignatures;
  },

  async updateAuthoritySignature(sig: AuthoritySignature): Promise<AuthoritySignature[]> {
    const current = await this.getAuthoritySignatures();
    let updated = current.map(s => s.id === sig.id ? { ...s, ...sig } : s);
    if (sig.isDefault) {
      updated = updated.map(s => ({ ...s, isDefault: s.id === sig.id }));
    }
    await this.saveAuthoritySignatures(updated);
    return updated;
  },

  async moveAuthoritySignature(id: string, direction: 'up' | 'down'): Promise<AuthoritySignature[]> {
    const current = await this.getAuthoritySignatures();
    const index = current.findIndex(s => s.id === id);
    if (index === -1) return current;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return current;

    const reordered = [...current];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    await this.saveAuthoritySignatures(reordered);
    return reordered;
  },

  async getDboSignatures(forceRefresh = false): Promise<DboPremiseSignature[]> {
    const cached = localStorage.getItem('kdb_dbo_signatures');
    let localList: DboPremiseSignature[] = [];
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localList = parsed;
      } catch (_) {}
    }

    // 0-network egress: return cached signatures immediately unless forceRefresh is true
    if (localList.length > 0 && !forceRefresh) {
      return localList;
    }

    const fetchApi = async (): Promise<DboPremiseSignature[]> => {
      try {
        const res = await safeFetchJson<DboPremiseSignature[]>('/api/dbo-signatures');
        if (res && Array.isArray(res)) {
          safeSetLocalStorage('kdb_dbo_signatures', JSON.stringify(res));
          return res;
        }
      } catch (_) {}
      return localList;
    };

    const client = await getSupabase();
    if (!client) {
      return await fetchApi();
    }

    try {
      const { data, error } = await client
        .from('dbo_premise_signatures')
        .select('id, premise_name, permit_number, client_name, rep_name, designation, signature_data, stamp_data, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(25);

      if (!error && Array.isArray(data)) {
        const mapped: DboPremiseSignature[] = data.map((r: any) => ({
          id: r.id,
          premiseName: r.premise_name || '',
          permitNumber: r.permit_number || '',
          clientName: r.client_name || '',
          repName: r.rep_name || '',
          designation: r.designation || '',
          signatureData: r.signature_data || '',
          stampData: r.stamp_data || '',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        safeSetLocalStorage('kdb_dbo_signatures', JSON.stringify(mapped));
        return mapped;
      }
    } catch (sbErr) {
      console.warn("[DBService] Supabase getDboSignatures exception:", sbErr);
    }

    return await fetchApi();
  },

  async getDboSignaturesForPremise(premiseName: string, permitNumber?: string): Promise<DboPremiseSignature[]> {
    const cleanP = (premiseName || '').toLowerCase().trim();
    const cleanNo = cleanPermitNumber(permitNumber || '');
    if (!cleanP && !cleanNo) return [];

    // 1. Ultra-fast local cache check (0 network egress, 0ms latency, 0 Postgres usage)
    const cached = localStorage.getItem('kdb_dbo_signatures');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const matched = parsed.filter((sig: DboPremiseSignature) => {
            const sPrem = (sig.premiseName || '').toLowerCase().trim();
            const sNo = cleanPermitNumber(sig.permitNumber || '');
            if (cleanNo && sNo && (cleanNo === sNo || sNo.includes(cleanNo) || cleanNo.includes(sNo))) return true;
            if (cleanP && sPrem && (cleanP === sPrem || sPrem.includes(cleanP) || cleanP.includes(sPrem))) return true;
            return false;
          });
          if (matched.length > 0) return matched;
        }
      } catch (_) {}
    }

    // Helper to merge into local cache to prevent repeated network egress
    const cacheItems = (newItems: DboPremiseSignature[]) => {
      try {
        const existing = JSON.parse(localStorage.getItem('kdb_dbo_signatures') || '[]');
        const merged = [...newItems];
        for (const it of existing) {
          if (!merged.some(m => m.id === it.id)) {
            merged.push(it);
          }
        }
        safeSetLocalStorage('kdb_dbo_signatures', JSON.stringify(merged));
      } catch (_) {}
    };

    // 2. Targeted query with Supabase: filter by premise/permit and limit to 5 records to minimize egress
    const client = await getSupabase();
    if (client) {
      try {
        let query = client
          .from('dbo_premise_signatures')
          .select('id, premise_name, permit_number, client_name, rep_name, designation, signature_data, stamp_data, created_at, updated_at');

        if (cleanP && cleanNo) {
          query = query.or(`premise_name.ilike.%${cleanP}%,permit_number.ilike.%${cleanNo}%`);
        } else if (cleanP) {
          query = query.ilike('premise_name', `%${cleanP}%`);
        } else if (cleanNo) {
          query = query.ilike('permit_number', `%${cleanNo}%`);
        }

        const { data, error } = await query.order('updated_at', { ascending: false }).limit(5);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: DboPremiseSignature[] = data.map((r: any) => ({
            id: r.id,
            premiseName: r.premise_name || '',
            permitNumber: r.permit_number || '',
            clientName: r.client_name || '',
            repName: r.rep_name || '',
            designation: r.designation || '',
            signatureData: r.signature_data || '',
            stampData: r.stamp_data || '',
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
          cacheItems(mapped);
          return mapped;
        }
      } catch (sbErr) {
        console.warn("[DBService] Supabase getDboSignaturesForPremise note:", sbErr);
      }
    }

    // 3. Fallback to local server API with targeted query parameters
    try {
      const q = new URLSearchParams();
      if (cleanP) q.set('premise', cleanP);
      if (cleanNo) q.set('permit', cleanNo);
      const res = await safeFetchJson<DboPremiseSignature[]>(`/api/dbo-signatures?${q.toString()}`);
      if (res && Array.isArray(res)) {
        cacheItems(res);
        return res;
      }
    } catch (_) {}

    return [];
  },

  async saveDboSignature(signature: DboPremiseSignature): Promise<DboPremiseSignature> {
    const nowIso = new Date().toISOString();
    const sigToSave: DboPremiseSignature = {
      ...signature,
      id: signature.id || `dbo-sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: signature.createdAt || nowIso,
      updatedAt: nowIso
    };

    const current = await this.getDboSignatures();
    const idx = current.findIndex(s => 
      (s.id && s.id === sigToSave.id) ||
      ((s.premiseName || '').toLowerCase().trim() === (sigToSave.premiseName || '').toLowerCase().trim() &&
       (s.repName || '').toLowerCase().trim() === (sigToSave.repName || '').toLowerCase().trim())
    );
    let updatedList: DboPremiseSignature[];
    if (idx >= 0) {
      updatedList = [...current];
      updatedList[idx] = { ...updatedList[idx], ...sigToSave };
    } else {
      updatedList = [sigToSave, ...current];
    }
    safeSetLocalStorage('kdb_dbo_signatures', JSON.stringify(updatedList));

    try {
      await fetch('/api/dbo-signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sigToSave)
      });
    } catch (e) {
      console.warn("[DBService] /api/dbo-signatures save error:", e);
    }

    const client = await getSupabase();
    if (client) {
      try {
        const row = {
          id: sigToSave.id,
          premise_name: sigToSave.premiseName,
          permit_number: sigToSave.permitNumber || '',
          client_name: sigToSave.clientName || '',
          rep_name: sigToSave.repName,
          designation: sigToSave.designation || '',
          signature_data: sigToSave.signatureData,
          stamp_data: sigToSave.stampData || '',
          updated_at: nowIso
        };
        await client.from('dbo_premise_signatures').upsert([row]);
      } catch (sbErr: any) {
        console.warn("[DBService] Supabase dbo_premise_signatures upsert notice:", sbErr?.message);
      }
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_dbo_signatures_updated', { detail: sigToSave }));
      }
    } catch (_) {}

    return sigToSave;
  },

  async deleteDboSignature(id: string): Promise<void> {
    const current = await this.getDboSignatures();
    const updated = current.filter(s => s.id !== id);
    safeSetLocalStorage('kdb_dbo_signatures', JSON.stringify(updated));

    try {
      await fetch(`/api/dbo-signatures/${id}`, { method: 'DELETE' });
    } catch (_) {}

    const client = await getSupabase();
    if (client) {
      try {
        await client.from('dbo_premise_signatures').delete().eq('id', id);
      } catch (_) {}
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_dbo_signatures_updated', { detail: { deletedId: id } }));
      }
    } catch (_) {}
  },

  async getClients(forceFresh: boolean = false): Promise<LicensedClient[]> {
    const deduplicateClients = (list: LicensedClient[]): LicensedClient[] => {
      const unique: LicensedClient[] = [];
      const seenIds = new Set<string>();

      for (const client of list) {
        if (!client) continue;
        const id = String(client.id || client.permitNumber || '').trim();
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        unique.push(client);
      }
      return unique;
    };

    const now = Date.now();
    if (!forceFresh && clientsMemoryCache && Array.isArray(clientsMemoryCache) && (now - clientsCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return clientsMemoryCache;
    }

    if (clientsInFlightPromise) {
      return clientsInFlightPromise;
    }

    const fetchFreshPromise = (async (): Promise<LicensedClient[]> => {
      const fetchLocal = async () => {
        try {
          const response = await fetch('/api/clients');
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              const clients = deduplicateClients(data);
              clientsMemoryCache = clients;
              clientsCacheTimestamp = Date.now();
              safeSetLocalStorage('kdb_clients_cache', JSON.stringify(clients));
              return clients;
            }
          }
        } catch (e) {
          console.warn("[DBService] Local API clients fetch error:", e);
        }
        const local = getArrayFromLocalStorage<LicensedClient>('kdb_clients_cache');
        const deduplicated = deduplicateClients(local);
        clientsMemoryCache = deduplicated;
        clientsCacheTimestamp = Date.now();
        return deduplicated;
      };

      try {
        const client = await getSupabase();
        if (client) {
          let allClientsData: any[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await client
              .from('licensed_clients')
              .select('*')
              .order('clientname', { ascending: true })
              .order('id', { ascending: true })
              .range(from, from + pageSize - 1);

            if (error) {
              console.warn("[DBService] Supabase getClients page error:", error);
              break;
            }
            if (!data || data.length === 0) break;
            allClientsData.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }

          if (allClientsData.length > 0) {
            const clients = deduplicateClients(allClientsData.map(c => clientFromDb(c)));
            clientsMemoryCache = clients;
            clientsCacheTimestamp = Date.now();
            safeSetLocalStorage('kdb_clients_cache', JSON.stringify(clients));
            return clients;
          }
        }
        
        return await fetchLocal();
      } catch (e) {
        console.warn("[DBService] Fresh clients fetch error, falling back to local:", e);
        return await fetchLocal();
      } finally {
        clientsInFlightPromise = null;
      }
    })();

    clientsInFlightPromise = fetchFreshPromise;
    return fetchFreshPromise;
  },

  async getClientsPaginated(params: ClientQueryParams = {}): Promise<PaginatedResult<LicensedClient>> {
    const page = Math.max(1, params.page || 1);
    const pageSize = [10, 25, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const client = await getSupabase();
    if (client) {
      try {
        let query = client.from('licensed_clients').select('*', { count: 'exact' });

        if (params.search && params.search.trim()) {
          const term = `%${params.search.trim()}%`;
          query = query.or(`clientname.ilike.${term},premisename.ilike.${term},permitnumber.ilike.${term},location.ilike.${term},county.ilike.${term}`);
        }

        if (params.category && params.category !== 'All') {
          query = query.ilike('premisecategory', `%${params.category}%`);
        }

        if (params.levyInfo && params.levyInfo !== 'All') {
          query = query.eq('levyinfo', params.levyInfo);
        }

        if (params.status === 'operating') {
          query = query.eq('operationalstatus', 'operating');
        } else if (params.status === 'closed') {
          query = query.eq('operationalstatus', 'closed');
        }

        const sortColumn = params.sortBy === 'permitNumber' ? 'permitnumber' : 'clientname';
        query = query.order(sortColumn, { ascending: params.sortOrder !== 'desc' });
        query = query.order('id', { ascending: true });
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (!error && data) {
          const total = count ?? data.length;
          return {
            data: data.map(c => clientFromDb(c)),
            count: total,
            totalCount: total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1
          };
        }
      } catch (err) {
        console.warn("[DBService] Supabase getClientsPaginated error:", err);
      }
    }

    // Call local backend with exact batch parameters to limit egress
    try {
      const qParams = new URLSearchParams();
      qParams.set('page', String(page));
      qParams.set('pageSize', String(pageSize));
      if (params.search && params.search.trim()) qParams.set('search', params.search.trim());
      if (params.category && params.category !== 'All') qParams.set('category', params.category);
      if (params.status && params.status !== 'All') qParams.set('status', params.status);
      if (params.levyInfo && params.levyInfo !== 'All') qParams.set('levyInfo', params.levyInfo);
      if (params.sortBy) qParams.set('sortBy', params.sortBy);
      if (params.sortOrder) qParams.set('sortOrder', params.sortOrder);

      const res = await fetch(`/api/clients?${qParams.toString()}`);
      if (res.ok) {
        const paginatedData = await res.json();
        if (paginatedData && Array.isArray(paginatedData.data)) {
          return paginatedData;
        }
      }
    } catch (e) {
      console.warn("[DBService] Local API getClientsPaginated error:", e);
    }

    // Fallback to local / memory filtered pagination if network is unavailable
    const all = clientsMemoryCache && Array.isArray(clientsMemoryCache) 
      ? clientsMemoryCache 
      : getArrayFromLocalStorage<LicensedClient>('kdb_clients_cache');
    let filtered = all;

    if (params.search && params.search.trim()) {
      filtered = filtered.filter(c => 
        searchMatches(c.customerNumber, params.search) ||
        searchMatches(c.clientName, params.search) ||
        searchMatches(c.premiseName, params.search) ||
        searchMatches(c.permitNumber, params.search) ||
        searchMatches(c.location, params.search) ||
        searchMatches(c.county, params.search)
      );
    }

    if (params.category && params.category !== 'All') {
      filtered = filtered.filter(c => 
        String(c.premiseCategory || '').toLowerCase().includes(params.category!.toLowerCase())
      );
    }

    if (params.levyInfo && params.levyInfo !== 'All') {
      filtered = filtered.filter(c => c.levyInfo === params.levyInfo);
    }

    if (params.status === 'operating') {
      filtered = filtered.filter(c => c.operationalStatus === 'operating');
    } else if (params.status === 'closed') {
      filtered = filtered.filter(c => c.operationalStatus === 'closed');
    }

    const total = filtered.length;
    const paged = filtered.slice(from, from + pageSize);

    return {
      data: paged,
      count: total,
      totalCount: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    };
  },

  async saveClient(clientRecord: LicensedClient): Promise<void> {
    const cleanStr = (s: any) => (String(s || '')).toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const cRec = cleanStr(clientRecord.clientName);
    const premRec = cleanStr(clientRecord.premiseName);
    const custRec = cleanStr(clientRecord.customerNumber);
    const recId = String(clientRecord.id || '').trim();

    // 1. Synchronize in-place in local storage cache first to guarantee 0ms consistency
    let matchedRowId: string | null = null;
    const updateLocalCache = () => {
      try {
        const items = clientsMemoryCache || getArrayFromLocalStorage<LicensedClient>('kdb_clients_cache');
        const matchIdx = items.findIndex(i => {
          // Identify by customer number or unique ID first to avoid permit collision
          const iCust = cleanStr(i.customerNumber);
          if (custRec && iCust && custRec === iCust) return true;
          const iId = String(i.id || '').trim();
          if (recId && iId && recId === iId) return true;
          const iName = cleanStr(i.clientName);
          const iPrem = cleanStr(i.premiseName);
          const iLoc = cleanStr(i.location);
          const locRec = cleanStr(clientRecord.location);
          // Match by client + premise + location
          if (cRec && iName && cRec === iName && premRec && iPrem && premRec === iPrem && locRec && iLoc && locRec === iLoc) return true;
          if (cRec && iName && cRec === iName && premRec && iPrem && premRec === iPrem) return true;
          return false;
        });

        if (matchIdx >= 0) {
          matchedRowId = items[matchIdx].id || clientRecord.id;
          clientRecord.id = matchedRowId;
          items[matchIdx] = { ...items[matchIdx], ...clientRecord, id: matchedRowId };
          // Remove any accidental remaining duplicate rows matching the exact same client entity
          const deduplicated = items.filter((item, idx) => {
            if (idx === matchIdx) return true;
            const otherId = String(item.id || '').trim();
            const otherCust = cleanStr(item.customerNumber);
            if (matchedRowId && otherId && matchedRowId === otherId) return false;
            if (custRec && otherCust && custRec === otherCust) return false;
            return true;
          });
          clientsMemoryCache = deduplicated;
          clientsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_clients_cache', JSON.stringify(deduplicated));
        } else {
          items.unshift(clientRecord);
          clientsMemoryCache = items;
          clientsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_clients_cache', JSON.stringify(items));
        }
      } catch (e) {
        console.warn("[DBService] Local cache update error:", e);
      }
    };

    updateLocalCache();

    // 2. Synchronize to server API endpoint (/api/clients) in background
    const syncServerApi = async () => {
      try {
        await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientRecord)
        });
      } catch (e) {
        console.warn("[DBService] Server API client sync error:", e);
      }
    };

    // 3. Update in Supabase PostgreSQL database
    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, synchronizing via local API");
      await syncServerApi();
      return;
    }

    try {
      const dbClient = clientToDb(clientRecord);

      if (!matchedRowId && recId) {
        matchedRowId = recId;
      }

      if (matchedRowId) {
        console.log("[DBService] Updating existing client in Supabase:", matchedRowId);
        const { error: updateErr } = await client
          .from('licensed_clients')
          .update(dbClient)
          .eq('id', matchedRowId);

        if (updateErr) {
          console.warn("[DBService] Supabase client update error, attempting upsert fallback:", updateErr.message);
          await client.from('licensed_clients').upsert(dbClient, { onConflict: 'id' });
        }
      } else {
        console.log("[DBService] Inserting new client in Supabase:", dbClient.id);
        const { error: insertErr } = await client
          .from('licensed_clients')
          .upsert(dbClient, { onConflict: 'id' });

        if (insertErr) {
          console.error("[DBService] Supabase client insert error:", insertErr.message);
        }
      }

      // Also dispatch background backup sync to Express backend
      syncServerApi().catch(() => {});
    } catch (error: any) {
      console.warn("[DBService] Supabase saveClient exception, falling back to local API. Error:", error);
      await syncServerApi();
    }
  },

  async deleteClient(id: string): Promise<void> {
    const deleteLocal = async () => {
      console.log("[DBService] Deleting client via local API / storage...");
      try {
        await fetch(`/api/clients/${id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("[DBService] Local API deleteClient error:", e);
      }
      if (clientsMemoryCache) {
        clientsMemoryCache = clientsMemoryCache.filter(c => c.id !== id);
      }
      clientsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_clients_cache', id, 'id');
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, deleting from local storage");
      await deleteLocal();
      return;
    }

    try {
      const { error } = await client
        .from('licensed_clients')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn("[DBService] Supabase deleteClient failed, falling back to local storage. Error details:", error);
        await deleteLocal();
        return;
      }
      
      if (clientsMemoryCache) {
        clientsMemoryCache = clientsMemoryCache.filter(c => c.id !== id);
      }
      clientsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_clients_cache', id, 'id');
    } catch (error: any) {
      console.warn("[DBService] Supabase deleteClient exception, falling back to local storage. Error:", error);
      await deleteLocal();
    }
  },

  async saveClientsBulk(clientsList: LicensedClient[]): Promise<void> {
    const getMergedLocal = async () => {
      const currentClients = clientsMemoryCache || getArrayFromLocalStorage<LicensedClient>('kdb_clients_cache');
      const merged = [...currentClients];
      clientsList.forEach(newC => {
        const idx = merged.findIndex(c => c.id === newC.id);
        if (idx !== -1) {
          merged[idx] = newC;
        } else {
          merged.push(newC);
        }
      });
      return merged;
    };

    const saveLocal = async () => {
      console.log("[DBService] Saving clients bulk to local API / storage...");
      const merged = await getMergedLocal();
      clientsMemoryCache = merged;
      clientsCacheTimestamp = Date.now();
      safeSetLocalStorage('kdb_clients_cache', JSON.stringify(merged));
      try {
        await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        });
      } catch (e) {
        console.warn("[DBService] Local API saveClientsBulk warning:", e);
      }
    };

    const client = await getSupabase();
    if (!client) {
      console.warn("[DBService] Supabase not initialized, saving locally");
      await saveLocal();
      return;
    }

    try {
      console.log("[DBService] Attempting Supabase bulk upsert...", clientsList.length);
      const seenIds = new Set<string>();
      const dbClients = clientsList.map((c, idx) => {
        const dbObj = clientToDb(c);
        if (!dbObj.id || seenIds.has(dbObj.id)) {
          dbObj.id = `${dbObj.permitnumber || dbObj.id || 'CLI'}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        }
        seenIds.add(dbObj.id);
        return dbObj;
      });
      
      // Batch in chunks of 50 for max reliability
      const chunkSize = 50;
      for (let i = 0; i < dbClients.length; i += chunkSize) {
        const chunk = dbClients.slice(i, i + chunkSize);
        const { error } = await client
          .from('licensed_clients')
          .upsert(chunk);
        
        if (error) {
          console.error("[DBService] Supabase bulk upsert chunk error:", error);
          await saveLocal();
          return;
        }
      }
      
      console.log("[DBService] Supabase bulk upsert succeeded for", clientsList.length, "clients");
      const merged = await getMergedLocal();
      clientsMemoryCache = merged;
      clientsCacheTimestamp = Date.now();
      safeSetLocalStorage('kdb_clients_cache', JSON.stringify(merged));
      try {
        fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        }).catch(() => {});
      } catch {}
    } catch (error: any) {
      console.error("[DBService] Supabase bulk upsert exception, falling back to local API. Error:", error);
      await saveLocal();
    }
  },

  async getReturns(forceFresh: boolean = false): Promise<ClientReturn[]> {
    const now = Date.now();
    if (!forceFresh && returnsMemoryCache && Array.isArray(returnsMemoryCache) && (now - returnsCacheTimestamp < DEFAULT_CACHE_TTL_MS)) {
      return returnsMemoryCache;
    }

    if (returnsInFlightPromise) {
      return returnsInFlightPromise;
    }

    const fetchReturnsPromise = (async (): Promise<ClientReturn[]> => {
      const fetchLocal = async () => {
        const data = await safeFetchJson<any[]>('/api/returns');
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(r => returnFromDb(r));
          returnsMemoryCache = mapped;
          returnsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_returns_cache', JSON.stringify(mapped));
          return mapped;
        }
        const local = getArrayFromLocalStorage<ClientReturn>('kdb_returns_cache');
        const mapped = local.map(r => returnFromDb(r));
        returnsMemoryCache = mapped;
        returnsCacheTimestamp = Date.now();
        return mapped;
      };

      const client = await getSupabase();
      if (!client) {
        return await fetchLocal();
      }

      try {
        let allReturnsData: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await client
            .from('client_returns')
            .select('*')
            .order('year', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);
          
          if (error) {
            console.warn("[DBService] Supabase getReturns page failed:", error);
            break;
          }
          if (!data || data.length === 0) break;
          allReturnsData.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        if (allReturnsData.length > 0) {
          const mapped = allReturnsData.map(r => returnFromDb(r));
          returnsMemoryCache = mapped;
          returnsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_returns_cache', JSON.stringify(mapped));
          return mapped;
        }

        return await fetchLocal();
      } catch (e) {
        console.warn("[DBService] Supabase getReturns exception, falling back to local. Error:", e);
        return await fetchLocal();
      } finally {
        returnsInFlightPromise = null;
      }
    })();

    returnsInFlightPromise = fetchReturnsPromise;
    return fetchReturnsPromise;
  },

  async getReturnsPaginated(params: ReturnQueryParams = {}): Promise<PaginatedReturnsResult> {
    const page = Math.max(1, params.page || 1);
    const pageSize = [10, 25, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const client = await getSupabase();
    if (client) {
      try {
        let query = client.from('client_returns').select('*', { count: 'exact' });

        if (params.clientId) {
          query = query.eq('clientid', params.clientId);
        }

        if (params.year && params.year !== 'All') {
          query = query.eq('year', Number(params.year));
        }

        if (params.month && params.month !== 'All') {
          query = query.ilike('period', params.month.trim());
        }

        if (params.status && params.status !== 'All') {
          query = query.eq('paymentstatus', params.status);
        }

        if (params.search && params.search.trim()) {
          const term = `%${params.search.trim()}%`;
          query = query.or(`clientname.ilike.${term},txnref.ilike.${term},comments.ilike.${term}`);
        }

        const sortColumn = params.sortBy === 'returndate' ? 'returndate' : 'year';
        query = query.order(sortColumn, { ascending: params.sortOrder === 'asc' });
        query = query.order('id', { ascending: true });
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (!error && data) {
          const total = count ?? data.length;
          const mapped = data.map(r => returnFromDb(r));
          return {
            data: mapped,
            count: total,
            totalCount: total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1
          };
        }
      } catch (err) {
        console.warn("[DBService] Supabase getReturnsPaginated error:", err);
      }
    }

    // Call local backend with exact batch parameters to limit egress
    try {
      const qParams = new URLSearchParams();
      qParams.set('page', String(page));
      qParams.set('pageSize', String(pageSize));
      if (params.search && params.search.trim()) qParams.set('search', params.search.trim());
      if (params.clientId) qParams.set('clientId', params.clientId);
      if (params.year && params.year !== 'All') qParams.set('year', params.year);
      if (params.month && params.month !== 'All') qParams.set('month', params.month);
      if (params.status && params.status !== 'All') qParams.set('status', params.status);
      if (params.sortBy) qParams.set('sortBy', params.sortBy);
      if (params.sortOrder) qParams.set('sortOrder', params.sortOrder);

      const res = await fetch(`/api/returns?${qParams.toString()}`);
      if (res.ok) {
        const paginatedData = await res.json();
        if (paginatedData && Array.isArray(paginatedData.data)) {
          return paginatedData;
        }
      }
    } catch (e) {
      console.warn("[DBService] Local API getReturnsPaginated error:", e);
    }

    // Fallback to local / memory filtered pagination
    const all = returnsMemoryCache && Array.isArray(returnsMemoryCache)
      ? returnsMemoryCache
      : getArrayFromLocalStorage<ClientReturn>('kdb_returns_cache');
    let filtered = all;

    if (params.clientId) {
      filtered = filtered.filter(r => r.clientId === params.clientId);
    }

    if (params.year && params.year !== 'All') {
      filtered = filtered.filter(r => String(r.year) === String(params.year));
    }

    if (params.month && params.month !== 'All') {
      filtered = filtered.filter(r => (r.period || '').trim().toLowerCase() === params.month!.trim().toLowerCase());
    }

    if (params.status && params.status !== 'All') {
      filtered = filtered.filter(r => r.paymentStatus === params.status);
    }

    if (params.search && params.search.trim()) {
      filtered = filtered.filter(r => 
        searchMatches(r.clientName, params.search) ||
        searchMatches(r.txnRef, params.search) ||
        searchMatches(r.comments, params.search)
      );
    }

    const total = filtered.length;
    const paged = filtered.slice(from, from + pageSize);

    return {
      data: paged,
      count: total,
      totalCount: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    };
  },

  async getHubMetrics(): Promise<{ totalClients: number; operatingClients: number; totalReturns: number; totalVolume: number; totalOutstanding: number }> {
    const client = await getSupabase();
    if (client) {
      try {
        const [clientsCountRes, operatingClientsRes, returnsCountRes] = await Promise.all([
          client.from('licensed_clients').select('*', { count: 'exact', head: true }),
          client.from('licensed_clients').select('*', { count: 'exact', head: true }).eq('operationalstatus', 'operating'),
          client.from('client_returns').select('*', { count: 'exact', head: true })
        ]);
        const totalClients = clientsCountRes.count ?? 0;
        const operatingClients = operatingClientsRes.count ?? 0;
        const totalReturns = returnsCountRes.count ?? 0;

        return {
          totalClients,
          operatingClients,
          totalReturns,
          totalVolume: 0,
          totalOutstanding: 0
        };
      } catch (err) {
        console.warn("[DBService] Supabase getHubMetrics error:", err);
      }
    }

    try {
      const res = await fetch('/api/hub-summary');
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const localClients = getArrayFromLocalStorage<LicensedClient>('kdb_clients_cache') || [];
    const localReturns = getArrayFromLocalStorage<ClientReturn>('kdb_returns_cache') || [];
    return {
      totalClients: localClients.length,
      operatingClients: localClients.filter(c => c.operationalStatus === 'operating').length,
      totalReturns: localReturns.length,
      totalVolume: localReturns.reduce((sum, r) => sum + (r.qty || 0), 0),
      totalOutstanding: localReturns.reduce((sum, r) => sum + (r.outstandingBalance || 0), 0)
    };
  },

  async saveReturn(clientReturn: ClientReturn): Promise<void> {
    const saveLocal = async () => {
      try {
        await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientReturn)
        });
      } catch (e) {
        console.warn("[DBService] Local API saveReturn error:", e);
      }
      updateLocalStorageCollection('kdb_returns_cache', clientReturn, 'id');
      if (returnsMemoryCache) {
        const idx = returnsMemoryCache.findIndex(r => r.id === clientReturn.id);
        if (idx >= 0) returnsMemoryCache[idx] = clientReturn;
        else returnsMemoryCache.unshift(clientReturn);
      } else {
        returnsMemoryCache = [clientReturn];
      }
      returnsCacheTimestamp = Date.now();
    };

    const client = await getSupabase();
    if (!client) {
      await saveLocal();
      return;
    }

    try {
      const dbObj = returnToDb(clientReturn);
      const { error } = await client
        .from('client_returns')
        .upsert(dbObj);

      if (error) {
        console.warn("[DBService] Supabase saveReturn failed, falling back to local.", error);
        await saveLocal();
        return;
      }

      if (returnsMemoryCache) {
        const idx = returnsMemoryCache.findIndex(r => r.id === clientReturn.id);
        if (idx >= 0) returnsMemoryCache[idx] = clientReturn;
        else returnsMemoryCache.unshift(clientReturn);
      } else {
        returnsMemoryCache = [clientReturn];
      }
      returnsCacheTimestamp = Date.now();
      updateLocalStorageCollection('kdb_returns_cache', clientReturn, 'id');
    } catch (e) {
      console.warn("[DBService] Supabase saveReturn exception, falling back to local.", e);
      await saveLocal();
    }
  },

  async deleteReturn(id: string): Promise<void> {
    const deleteLocal = async () => {
      try {
        await fetch(`/api/returns/${id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn("[DBService] Local API deleteReturn error:", e);
      }
      if (returnsMemoryCache) {
        returnsMemoryCache = returnsMemoryCache.filter(r => r.id !== id);
      }
      returnsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_returns_cache', id, 'id');
    };

    const client = await getSupabase();
    if (!client) {
      await deleteLocal();
      return;
    }

    try {
      const { error } = await client
        .from('client_returns')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn("[DBService] Supabase deleteReturn failed, falling back to local.", error);
        await deleteLocal();
        return;
      }

      if (returnsMemoryCache) {
        returnsMemoryCache = returnsMemoryCache.filter(r => r.id !== id);
      }
      returnsCacheTimestamp = Date.now();
      removeFromLocalStorageCollection('kdb_returns_cache', id, 'id');
    } catch (e) {
      console.warn("[DBService] Supabase deleteReturn exception, falling back to local.", e);
      await deleteLocal();
    }
  },

  async saveReturnsBulk(returnsList: ClientReturn[]): Promise<void> {
    const getMergedLocal = async () => {
      const currentReturns = returnsMemoryCache || getArrayFromLocalStorage<ClientReturn>('kdb_returns_cache');
      const merged = [...currentReturns];
      returnsList.forEach(newR => {
        const idx = merged.findIndex(r => r.id === newR.id);
        if (idx !== -1) {
          merged[idx] = newR;
        } else {
          merged.push(newR);
        }
      });
      return merged;
    };

    const saveLocal = async () => {
      const merged = await getMergedLocal();
      returnsMemoryCache = merged;
      returnsCacheTimestamp = Date.now();
      safeSetLocalStorage('kdb_returns_cache', JSON.stringify(merged));
      try {
        await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        });
      } catch (e) {
        console.warn("[DBService] Local API saveReturnsBulk error:", e);
      }
    };

    const client = await getSupabase();
    if (!client) {
      await saveLocal();
      return;
    }

    try {
      console.log("[DBService] Attempting Supabase bulk upsert of", returnsList.length, "returns...");
      const dbObjs = returnsList.map(r => returnToDb(r));
      
      const chunkSize = 50;
      for (let i = 0; i < dbObjs.length; i += chunkSize) {
        const chunk = dbObjs.slice(i, i + chunkSize);
        const { error } = await client
          .from('client_returns')
          .upsert(chunk);

        if (error) {
          console.error("[DBService] Supabase saveReturnsBulk chunk error:", error);
          await saveLocal();
          return;
        }
      }

      console.log("[DBService] Supabase saveReturnsBulk succeeded for", returnsList.length, "returns");
      const merged = await getMergedLocal();
      returnsMemoryCache = merged;
      returnsCacheTimestamp = Date.now();
      safeSetLocalStorage('kdb_returns_cache', JSON.stringify(merged));
      try {
        fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        }).catch(() => {});
      } catch {}
    } catch (e) {
      console.error("[DBService] Supabase saveReturnsBulk exception, falling back to local.", e);
      await saveLocal();
    }
  },

  async getValidations(forceRefresh: boolean = false): Promise<DataValidation[]> {
    // 1. Fast memory cache check (0ms response)
    const now = Date.now();
    if (!forceRefresh && validationsMemoryCache && Array.isArray(validationsMemoryCache) && validationsMemoryCache.length > 0 && (now - validationsCacheTimestamp < VALIDATIONS_CACHE_TTL_MS)) {
      return validationsMemoryCache;
    }

    const cached = localStorage.getItem('kdb_validations_cache');

    const template: DataValidation = {
      id: '',
      clientId: '',
      clientName: '',
      premiseName: '',
      permitNo: '',
      location: '',
      category: '',
      contacts: '',
      expiryDate: '',
      year: 2026,
      period: '',
      quantityDeclared: '',
      unitPrice: 0,
      totalSales: 0,
      validatorName: '',
      validatedAt: '',
      status: 'Approved',
      remarks: '',
      pdfPath: ''
    };

    const fetchLocal = async (): Promise<DataValidation[]> => {
      const data = await safeFetchJson<any[]>('/api/validations');
      if (data && Array.isArray(data)) {
        validationsMemoryCache = data;
        validationsCacheTimestamp = Date.now();
        safeSetLocalStorage('kdb_validations_cache', JSON.stringify(data));
        return data;
      }
      const local = getArrayFromLocalStorage<DataValidation>('kdb_validations_cache');
      const safe = Array.isArray(local) ? local : [];
      validationsMemoryCache = safe;
      validationsCacheTimestamp = Date.now();
      return safe;
    };

    const fetchFromSupabase = async (client: any): Promise<DataValidation[]> => {
      const timeoutPromise = new Promise<{ status: 'rejected'; reason: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase getValidations query timeout')), 5000)
      );

      const queryPromise = Promise.allSettled([
        client.from('data_validations').select('*'),
        client.from('kdb_validations').select('*'),
        client.storage.from('ValidationPdfs').list('', { limit: 1000 })
      ]);

      const results = await Promise.race([queryPromise, timeoutPromise]) as PromiseSettledResult<any>[];
      const [res1, res2, resStorage] = results;

      const list1: any[] = res1.status === 'fulfilled' && !res1.value.error ? (res1.value.data || []) : [];
      const list2: any[] = res2.status === 'fulfilled' && !res2.value.error ? (res2.value.data || []) : [];
      const storageFiles: any[] = resStorage.status === 'fulfilled' && !resStorage.value.error ? (resStorage.value.data || []) : [];

      const mapped1 = list1.map(r => {
        const item = fromDb(r, template);
        const raw = typeof r.raw_data === 'string' ? (() => { try { return JSON.parse(r.raw_data); } catch { return {}; } })() : (r.raw_data || {});
        const mCount = r.months_count || r.monthsCount || (Array.isArray(raw?.sales) && raw.sales.length > 0 ? raw.sales.length : undefined) || getIndividualValidationsCount(item);
        const pdfP = r.pdf_path || r.pdfpath || r.pdf || raw.pdf_path || raw.pdfPath || raw.pdf || item.pdfPath || '';
        return { 
          ...item, 
          monthsCount: mCount,
          pdfPath: pdfP,
          rawData: raw
        };
      });

      const mapped2 = list2.map(r => {
        let year = 2026;
        let period = r.validation_period || '';
        
        if (r.validation_period) {
          const yMatch = r.validation_period.match(/\b(20\d{2})\b/);
          if (yMatch) {
            year = Number(yMatch[1]);
          } else {
            const shortMatch = r.validation_period.match(/-(\d{2})$/);
            if (shortMatch) {
              year = 2000 + Number(shortMatch[1]);
            }
          }
        } else if (r.date) {
          const d = new Date(r.date);
          if (!isNaN(d.getTime())) {
            period = d.toLocaleString('default', { month: 'long' });
            year = d.getFullYear();
          }
        }

        const raw = typeof r.raw_data === 'string' ? (() => { try { return JSON.parse(r.raw_data); } catch { return {}; } })() : (r.raw_data || {});
        const qDeclared = raw.sales?.[0]?.qtyDeclared || '';
        const bPrice = parseFloat(raw.sales?.[0]?.buyingPrice) || 0;
        const total = raw.sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.qtyDeclared) || 0) * (parseFloat(s.buyingPrice) || 0), 0) || 0;
        
        let mCount = Array.isArray(raw.sales) && raw.sales.length > 0 
          ? raw.sales.length 
          : (r.months_count || 1);
        if (mCount <= 1 && period) {
          mCount = getIndividualValidationsCount({ period, monthsCount: 0 } as any);
        }

        return {
          id: r.id || `${r.permit_no || ''}-${r.validation_period || ''}`,
          clientId: r.permit_no || '',
          clientName: r.dbo_name || '',
          premiseName: r.premise_name || '',
          permitNo: r.permit_no || '',
          location: r.location || '',
          category: r.category || '',
          contacts: r.contacts || raw.contacts || '',
          expiryDate: raw.expiryDate || '',
          year,
          period,
          quantityDeclared: qDeclared,
          unitPrice: bPrice,
          totalSales: total,
          validatorName: raw.complianceOfficer || '',
          validatedAt: r.date || '',
          status: 'Approved' as const,
          remarks: raw.comments || '',
          monthsCount: mCount,
          pdfPath: r.pdf_path || raw.pdf_path || raw.pdfPath || raw.pdf,
          rawData: raw
        };
      });

      const combined: DataValidation[] = [...mapped1];
      mapped2.forEach(m => {
        const exists = combined.some(c => 
          c.id === m.id || 
          (c.permitNo && m.permitNo && c.permitNo === m.permitNo && c.period.toLowerCase() === m.period.toLowerCase() && Number(c.year) === m.year)
        );
        if (!exists) {
          combined.push(m);
        }
      });

      // Reconcile with Supabase storage bucket ValidationPdfs
      if (Array.isArray(storageFiles) && storageFiles.length > 0) {
        const monthsRegex = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Q1|Q2|Q3|Q4)/i;

        storageFiles.forEach(f => {
          if (!f || !f.name || !f.name.toLowerCase().endsWith('.pdf')) return;
          
          let base = f.name.replace(/\.pdf$/i, '');
          const tsMatch = base.match(/_(\d{10,14})$/);
          let timestamp: number | null = null;
          if (tsMatch) {
            timestamp = parseInt(tsMatch[1], 10);
            base = base.substring(0, tsMatch.index);
          }
          const isAmendment = /_Amended(_v\d+)?$/i.test(base);
          base = base.replace(/_Amended(_v\d+)?$/i, '');

          const parts = base.split('_').filter(Boolean);
          let periodStartIndex = -1;
          for (let i = 0; i < parts.length; i++) {
            if (monthsRegex.test(parts[i])) {
              periodStartIndex = i;
              break;
            }
          }

          let pName = '';
          let pPeriod = '';
          let pYear = 2026;

          if (periodStartIndex > 0) {
            pName = parts.slice(0, periodStartIndex).join(' ').trim();
            pPeriod = parts.slice(periodStartIndex).join(' ').replace(/[*_]/g, ' ').replace(/\s+/g, ' ').trim();
            const yMatch = pPeriod.match(/\b(202\d)\b/);
            if (yMatch) pYear = parseInt(yMatch[1], 10);
          } else {
            pName = base.replace(/_/g, ' ').trim();
          }

          const cleanP = pName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanPeriod = pPeriod.toLowerCase().replace(/[^a-z0-9]/g, '');

          // Check if this storage file matches an existing table record
          const existing = combined.find(c => {
            if (c.pdfPath === f.name) return true;
            if (c.rawData && JSON.stringify(c.rawData).includes(f.name)) return true;
            const cPrem = (c.premiseName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cPeriod = (c.period || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return cPrem === cleanP && (cPeriod === cleanPeriod || cPeriod.includes(cleanPeriod) || cleanPeriod.includes(cPeriod));
          });

          if (existing) {
            if (!existing.pdfPath) {
              existing.pdfPath = f.name;
            }
          } else {
            // Unmatched storage file: add as a verified validation form
            const fileMonthsCount = getIndividualValidationsCount({ period: pPeriod, monthsCount: 0 } as any);
            const fileDate = timestamp ? new Date(timestamp).toISOString() : (f.created_at || new Date().toISOString());
            combined.push({
              id: `storage-${f.name}`,
              clientId: '',
              clientName: pName,
              premiseName: pName,
              permitNo: '',
              location: 'Kericho',
              category: 'Milk Bar',
              contacts: '',
              expiryDate: '',
              year: pYear,
              period: pPeriod || 'June 2026',
              quantityDeclared: '',
              unitPrice: 0,
              totalSales: 0,
              validatorName: 'Compliance Officer',
              validatedAt: fileDate.split('T')[0],
              status: 'Approved' as const,
              remarks: isAmendment ? 'Amended submission' : 'Submitted validation record',
              monthsCount: fileMonthsCount,
              pdfPath: f.name,
              rawData: { fromStorage: true, fileName: f.name, isAmendment }
            });
          }
        });
      }

      return combined;
    };

    const revalidate = async () => {
      if (isRevalidatingValidations) return;
      isRevalidatingValidations = true;
      lastRevalidationTime = Date.now();

      try {
        const client = await getSupabase();
        if (client) {
          const combined = await fetchFromSupabase(client);
          validationsMemoryCache = combined;
          validationsCacheTimestamp = Date.now();
          safeSetLocalStorage('kdb_validations_cache', JSON.stringify(combined));
        } else {
          await fetchLocal();
        }
      } catch (e) {
        console.warn("[DBService] Background validations sync note:", e);
      } finally {
        isRevalidatingValidations = false;
      }
    };

    if (!forceRefresh && cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          validationsMemoryCache = parsed;
          validationsCacheTimestamp = Date.now();
          // Only revalidate in background if more than 30 seconds since last sync
          if (Date.now() - lastRevalidationTime > 30000) {
            setTimeout(revalidate, 100);
          }
          return parsed;
        }
      } catch (e) {
        // Fall through
      }
    }

    const client = await getSupabase();
    if (!client) {
      return await fetchLocal();
    }

    try {
      const combined = await fetchFromSupabase(client);
      validationsMemoryCache = combined;
      validationsCacheTimestamp = Date.now();
      lastRevalidationTime = Date.now();
      safeSetLocalStorage('kdb_validations_cache', JSON.stringify(combined));
      return combined;
    } catch (e) {
      console.warn("[DBService] Supabase getValidations exception, falling back to local. Error:", e);
      const local = await fetchLocal();
      return Array.isArray(local) ? local : [];
    }
  },

  async saveValidation(validation: DataValidation): Promise<void> {
    const saveLocal = async () => {
      try {
        const response = await fetch('/api/validations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validation)
        });
        if (response.ok) return;
      } catch (e) {
        console.warn("[DBService] Local API saveValidation error:", e);
      }
      updateLocalStorageCollection('kdb_validations_cache', validation, 'id');
    };

    // 1. Always update local validations cache and in-memory cache immediately for 0ms searches
    const list = getArrayFromLocalStorage<DataValidation>('kdb_validations_cache');
    const index = list.findIndex(v => v.id === validation.id);
    if (index > -1) list[index] = validation;
    else list.unshift(validation); // add to beginning
    validationsMemoryCache = list;
    validationsCacheTimestamp = Date.now();
    safeSetLocalStorage('kdb_validations_cache', JSON.stringify(list));

    // 2. Always persist to local backend API file store
    await saveLocal();

    // 3. Persist to Supabase if configured
    const client = await getSupabase();
    if (!client) return;

    try {
      // Ensure valid UUID format for PostgreSQL UUID column
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const uuid = (validation.id && UUID_REGEX.test(validation.id)) 
        ? validation.id 
        : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

      let valPeriod = validation.period || '';
      if (valPeriod && validation.year && !valPeriod.includes(String(validation.year))) {
        valPeriod = `${valPeriod} ${validation.year}`;
      }

      const nowIso = new Date().toISOString();
      const rawData = validation.rawData || { ...validation };
      rawData.uuid = uuid;
      if (!rawData.id) rawData.id = validation.id;
      if (!rawData.timestamp) rawData.timestamp = nowIso;
      if (!rawData.created_at) rawData.created_at = nowIso;
      if (!rawData.createdAt) rawData.createdAt = nowIso;
      if (!rawData.submitted_at) rawData.submitted_at = nowIso;
      if (!rawData.submittedAt) rawData.submittedAt = nowIso;
      if (!rawData.validated_at) rawData.validated_at = validation.validatedAt || nowIso;
      if (!rawData.validatedAt) rawData.validatedAt = validation.validatedAt || nowIso;

      // Exact columns matching remote Supabase schema including timestamp fields
      const supabaseRow: Record<string, any> = {
        id: uuid,
        dbo_name: validation.clientName || rawData.dboName || '',
        premise_name: validation.premiseName || rawData.premiseName || '',
        branch: (validation as any).branch || rawData.branch || 'Kericho',
        date: validation.validatedAt || rawData.date || nowIso.split('T')[0],
        created_at: nowIso,
        submitted_at: nowIso,
        timestamp: nowIso,
        updated_at: nowIso,
        validation_period: valPeriod,
        category: validation.category || rawData.category || '',
        permit_no: validation.permitNo || rawData.permitNo || '',
        location: validation.location || rawData.location || '',
        county: (validation as any).county || rawData.county || 'Kericho',
        total_penalty: Number((validation as any).totalPenalty || rawData.totalPenalty || 0) || 0,
        raw_data: rawData,
        pdf_path: validation.pdfPath || rawData.pdf_path || rawData.pdfPath || null
      };

      const safeUpsert = async (tableName: string) => {
        let payload = { ...supabaseRow };
        for (let attempt = 0; attempt < 6; attempt++) {
          const { error } = await client.from(tableName).upsert([payload]);
          if (!error) {
            console.log(`[DBService] Supabase ${tableName} upsert SUCCESS with timestamp:`, uuid);
            return;
          }
          const errMsg = error.message || '';
          const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                        || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                        || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
          if (matchCol && matchCol[1] && payload.hasOwnProperty(matchCol[1])) {
            console.warn(`[DBService] Column "${matchCol[1]}" not present in "${tableName}", retrying without it...`);
            delete payload[matchCol[1]];
            continue;
          }
          console.warn(`[DBService] Supabase ${tableName} upsert error:`, error.message);
          break;
        }
      };

      await Promise.allSettled([
        safeUpsert('kdb_validations'),
        safeUpsert('data_validations')
      ]);
    } catch (e) {
      console.warn("[DBService] Supabase saveValidation exception:", e);
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_validations_updated', { detail: validation }));
        try {
          localStorage.setItem('kdb_validations_last_updated', String(Date.now()));
        } catch (_) {}
      }
    }
  },

  async deleteValidation(id: string): Promise<void> {
    if (validationsMemoryCache) {
      validationsMemoryCache = validationsMemoryCache.filter(v => v.id !== id);
      validationsCacheTimestamp = Date.now();
    }

    const deleteLocal = async () => {
      try {
        const response = await fetch(`/api/validations/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) return;
      } catch (e) {
        console.warn("[DBService] Local API deleteValidation error:", e);
      }
      removeFromLocalStorageCollection('kdb_validations_cache', id, 'id');
    };

    const client = await getSupabase();
    if (!client) {
      await deleteLocal();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_validations_updated', { detail: { deletedId: id } }));
        try {
          localStorage.setItem('kdb_validations_last_updated', String(Date.now()));
        } catch (_) {}
      }
      return;
    }

    try {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_REGEX.test(id)) {
        await Promise.allSettled([
          client.from('data_validations').delete().eq('id', id),
          client.from('kdb_validations').delete().eq('id', id)
        ]);
      } else {
        // Match by permit_no or raw_data id
        await Promise.allSettled([
          client.from('data_validations').delete().or(`permit_no.eq.${id},premise_name.eq.${id}`),
          client.from('kdb_validations').delete().or(`permit_no.eq.${id},premise_name.eq.${id}`)
        ]);
      }
      await deleteLocal();
    } catch (e) {
      console.warn("[DBService] Supabase deleteValidation exception, falling back to local.", e);
      await deleteLocal();
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kdb_validations_updated', { detail: { deletedId: id } }));
        try {
          localStorage.setItem('kdb_validations_last_updated', String(Date.now()));
        } catch (_) {}
      }
    }
  },

  async saveValidationsBulk(validationsList: DataValidation[]): Promise<void> {
    const saveLocal = async () => {
      const current = await this.getValidations();
      const merged = Array.isArray(current) ? [...current] : [];
      validationsList.forEach(newV => {
        const idx = merged.findIndex(v => v.id === newV.id);
        if (idx !== -1) {
          merged[idx] = newV;
        } else {
          merged.push(newV);
        }
      });
      validationsMemoryCache = merged;
      validationsCacheTimestamp = Date.now();
      safeSetLocalStorage('kdb_validations_cache', JSON.stringify(merged));

      const response = await fetch('/api/validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
      if (!response.ok) {
        const errMessage = await safeParseError(response, "Failed to save validations bulk");
        throw new Error(errMessage);
      }
    };

    const client = await getSupabase();
    if (!client) {
      await saveLocal();
      return;
    }

    try {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const dbObjs = validationsList.map(validation => {
        const uuid = (validation.id && UUID_REGEX.test(validation.id)) 
          ? validation.id 
          : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });

        let valPeriod = validation.period || '';
        if (valPeriod && validation.year && !valPeriod.includes(String(validation.year))) {
          valPeriod = `${valPeriod} ${validation.year}`;
        }
        const nowIso = new Date().toISOString();
        const rawData = validation.rawData || { ...validation };
        rawData.uuid = uuid;
        if (!rawData.id) rawData.id = validation.id;
        if (!rawData.timestamp) rawData.timestamp = nowIso;
        if (!rawData.created_at) rawData.created_at = nowIso;
        if (!rawData.createdAt) rawData.createdAt = nowIso;
        if (!rawData.submitted_at) rawData.submitted_at = nowIso;
        if (!rawData.submittedAt) rawData.submittedAt = nowIso;
        if (!rawData.validated_at) rawData.validated_at = validation.validatedAt || nowIso;
        if (!rawData.validatedAt) rawData.validatedAt = validation.validatedAt || nowIso;

        return {
          id: uuid,
          dbo_name: validation.clientName || rawData.dboName || '',
          premise_name: validation.premiseName || rawData.premiseName || '',
          branch: (validation as any).branch || rawData.branch || 'Kericho',
          date: validation.validatedAt || rawData.date || nowIso.split('T')[0],
          created_at: nowIso,
          submitted_at: nowIso,
          timestamp: nowIso,
          updated_at: nowIso,
          validation_period: valPeriod,
          category: validation.category || rawData.category || '',
          permit_no: validation.permitNo || rawData.permitNo || '',
          location: validation.location || rawData.location || '',
          county: (validation as any).county || rawData.county || 'Kericho',
          total_penalty: Number((validation as any).totalPenalty || rawData.totalPenalty || 0) || 0,
          raw_data: rawData,
          pdf_path: validation.pdfPath || rawData.pdf_path || null
        };
      });

      const safeBulkUpsert = async (tableName: string) => {
        let payload = dbObjs.map(o => ({ ...o }));
        for (let attempt = 0; attempt < 6; attempt++) {
          const { error } = await client.from(tableName).upsert(payload);
          if (!error) {
            console.log(`[DBService] Supabase ${tableName} bulk upsert SUCCESS with timestamps (${payload.length} items)`);
            return;
          }
          const errMsg = error.message || '';
          const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                        || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                        || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
          if (matchCol && matchCol[1]) {
            const col = matchCol[1];
            console.warn(`[DBService] Column "${col}" not present in "${tableName}" during bulk upsert, stripping and retrying...`);
            payload.forEach(item => { delete item[col]; });
            continue;
          }
          console.warn(`[DBService] Supabase ${tableName} bulk upsert error:`, error.message);
          break;
        }
      };

      await Promise.allSettled([
        safeBulkUpsert('kdb_validations'),
        safeBulkUpsert('data_validations')
      ]);
    } catch (e) {
      console.warn("[DBService] Supabase saveValidationsBulk exception, falling back to local.", e);
      await saveLocal();
    }
  },

  async getValidationDrafts(forceRefresh = false): Promise<ValidationDraft[]> {
    if (!forceRefresh && validationDraftsMemoryCache && (Date.now() - validationDraftsCacheTimestamp < 30000)) {
      return validationDraftsMemoryCache;
    }

    const localDrafts = getArrayFromLocalStorage<ValidationDraft>('kdb_validation_drafts_cache');
    const client = await getSupabase();
    if (!client) {
      validationDraftsMemoryCache = localDrafts;
      validationDraftsCacheTimestamp = Date.now();
      return localDrafts;
    }

    try {
      const { data, error } = await client
        .from('validation_drafts')
        .select('*')
        .neq('status', 'submitted')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped: ValidationDraft[] = data.map((row: any) => ({
          id: row.id,
          permitNo: row.permit_no || row.permitNo || '',
          permit_no: row.permit_no || row.permitNo || '',
          dboName: row.dbo_name || row.dboName || '',
          dbo_name: row.dbo_name || row.dboName || '',
          premiseName: row.premise_name || row.premiseName || '',
          premise_name: row.premise_name || row.premiseName || '',
          validationPeriod: row.validation_period || row.validationPeriod || '',
          validation_period: row.validation_period || row.validationPeriod || '',
          category: row.category || '',
          location: row.location || '',
          county: row.county || '',
          branch: row.branch || '',
          step: row.step ?? 0,
          status: row.status || 'draft',
          rawData: row.raw_data || row.rawData || {},
          raw_data: row.raw_data || row.rawData || {},
          createdAt: row.created_at || row.createdAt,
          created_at: row.created_at || row.createdAt,
          updatedAt: row.updated_at || row.updatedAt,
          updated_at: row.updated_at || row.updatedAt,
          signingToken: (row.raw_data || row.rawData)?.signingToken || row.signing_token,
          signingExpiresAt: (row.raw_data || row.rawData)?.signingExpiresAt || row.signing_expires_at,
          dboSignedAt: (row.raw_data || row.rawData)?.dboSignedAt || row.dbo_signed_at
        }));

        validationDraftsMemoryCache = mapped;
        validationDraftsCacheTimestamp = Date.now();
        safeSetLocalStorage('kdb_validation_drafts_cache', JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('[DBService] Supabase getValidationDrafts warning, using local cache:', err);
    }

    validationDraftsMemoryCache = localDrafts;
    validationDraftsCacheTimestamp = Date.now();
    return localDrafts;
  },

  async getValidationDraftById(id: string): Promise<ValidationDraft | null> {
    if (!id) return null;

    // 1. Try Supabase first for real-time remote updates
    const client = await getSupabase();
    if (client) {
      try {
        const { data, error } = await client
          .from('validation_drafts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (data && !error) {
          const raw = data.raw_data || data.rawData || {};
          const mapped: ValidationDraft = {
            id: data.id,
            permitNo: data.permit_no || data.permitNo || '',
            permit_no: data.permit_no || data.permitNo || '',
            dboName: data.dbo_name || data.dboName || '',
            dbo_name: data.dbo_name || data.dboName || '',
            premiseName: data.premise_name || data.premiseName || '',
            premise_name: data.premise_name || data.premiseName || '',
            validationPeriod: data.validation_period || data.validationPeriod || '',
            validation_period: data.validation_period || data.validationPeriod || '',
            category: data.category || '',
            location: data.location || '',
            county: data.county || '',
            branch: data.branch || '',
            step: data.step ?? 0,
            status: data.status || 'draft',
            rawData: raw,
            raw_data: raw,
            createdAt: data.created_at || data.createdAt,
            created_at: data.created_at || data.createdAt,
            updatedAt: data.updated_at || data.updatedAt,
            updated_at: data.updated_at || data.updatedAt,
            signingToken: raw.signingToken || data.signing_token,
            signingExpiresAt: raw.signingExpiresAt || data.signing_expires_at,
            dboSignedAt: raw.dboSignedAt || data.dbo_signed_at
          };

          // Update local cache
          const list = getArrayFromLocalStorage<ValidationDraft>('kdb_validation_drafts_cache');
          const idx = list.findIndex(d => d.id === id);
          if (idx > -1) list[idx] = mapped;
          else list.unshift(mapped);
          safeSetLocalStorage('kdb_validation_drafts_cache', JSON.stringify(list));

          return mapped;
        }
      } catch (err) {
        console.warn('[DBService] Supabase getValidationDraftById warning:', err);
      }
    }

    // 2. Try backend API endpoint
    try {
      const resp = await fetch(`/api/validation-drafts/${id}`);
      if (resp.ok) {
        const row = await resp.json();
        if (row && row.id) {
          const raw = row.raw_data || row.rawData || {};
          const mapped: ValidationDraft = {
            id: row.id,
            permitNo: row.permit_no || row.permitNo || '',
            dboName: row.dbo_name || row.dboName || '',
            premiseName: row.premise_name || row.premiseName || '',
            validationPeriod: row.validation_period || row.validationPeriod || '',
            category: row.category || '',
            location: row.location || '',
            county: row.county || 'Kericho',
            branch: row.branch || 'Kericho',
            step: row.step ?? 0,
            status: row.status || 'draft',
            rawData: raw,
            raw_data: raw,
            createdAt: row.created_at || row.createdAt,
            updatedAt: row.updated_at || row.updatedAt,
            signingToken: raw.signingToken || row.signing_token,
            signingExpiresAt: raw.signingExpiresAt || row.signing_expires_at,
            dboSignedAt: raw.dboSignedAt || row.dbo_signed_at
          };

          const list = getArrayFromLocalStorage<ValidationDraft>('kdb_validation_drafts_cache');
          const idx = list.findIndex(d => d.id === id);
          if (idx > -1) list[idx] = mapped;
          else list.unshift(mapped);
          safeSetLocalStorage('kdb_validation_drafts_cache', JSON.stringify(list));

          return mapped;
        }
      }
    } catch (apiErr) {
      console.warn('[DBService] API getValidationDraftById warning:', apiErr);
    }

    // 3. Fallback to localStorage
    const localDrafts = getArrayFromLocalStorage<ValidationDraft>('kdb_validation_drafts_cache');
    return localDrafts.find(d => d.id === id) || null;
  },

  async saveValidationDraft(draft: ValidationDraft): Promise<ValidationDraft> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const uuid = (draft.id && UUID_REGEX.test(draft.id)) 
      ? draft.id 
      : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    const nowIso = new Date().toISOString();
    const rawData = draft.rawData || draft.raw_data || { ...draft };
    if (draft.signingToken) rawData.signingToken = draft.signingToken;
    if (draft.signingExpiresAt) rawData.signingExpiresAt = draft.signingExpiresAt;
    if (draft.dboSignedAt) rawData.dboSignedAt = draft.dboSignedAt;

    const finalDraft: ValidationDraft = {
      ...draft,
      id: uuid,
      permitNo: draft.permitNo || draft.permit_no || '',
      permit_no: draft.permitNo || draft.permit_no || '',
      dboName: draft.dboName || draft.dbo_name || '',
      dbo_name: draft.dboName || draft.dbo_name || '',
      premiseName: draft.premiseName || draft.premise_name || '',
      premise_name: draft.premiseName || draft.premise_name || '',
      validationPeriod: draft.validationPeriod || draft.validation_period || '',
      validation_period: draft.validationPeriod || draft.validation_period || '',
      category: draft.category || '',
      location: draft.location || '',
      county: draft.county || 'Kericho',
      branch: draft.branch || 'Kericho',
      step: draft.step ?? 0,
      status: draft.status || 'draft',
      rawData: rawData,
      raw_data: rawData,
      createdAt: draft.createdAt || draft.created_at || nowIso,
      created_at: draft.createdAt || draft.created_at || nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
      signingToken: draft.signingToken || rawData.signingToken,
      signingExpiresAt: draft.signingExpiresAt || rawData.signingExpiresAt,
      dboSignedAt: draft.dboSignedAt || rawData.dboSignedAt
    };

    // 1. Update in-memory and local storage immediately
    const list = getArrayFromLocalStorage<ValidationDraft>('kdb_validation_drafts_cache');
    const idx = list.findIndex(d => d.id === finalDraft.id);
    if (idx > -1) list[idx] = finalDraft;
    else list.unshift(finalDraft);
    validationDraftsMemoryCache = list;
    validationDraftsCacheTimestamp = Date.now();
    safeSetLocalStorage('kdb_validation_drafts_cache', JSON.stringify(list));

    // 2. Persist to local backend API fallback
    try {
      await fetch('/api/validation-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalDraft)
      });
    } catch (apiErr) {
      console.warn('[DBService] Local API saveValidationDraft warning:', apiErr);
    }

    // 3. Upsert to Supabase validation_drafts table
    const client = await getSupabase();
    if (client) {
      try {
        const supabaseRow: Record<string, any> = {
          id: finalDraft.id,
          permit_no: finalDraft.permitNo || '',
          dbo_name: finalDraft.dboName || '',
          premise_name: finalDraft.premiseName || '',
          validation_period: finalDraft.validationPeriod || '',
          category: finalDraft.category || '',
          location: finalDraft.location || '',
          county: finalDraft.county || 'Kericho',
          branch: finalDraft.branch || 'Kericho',
          step: finalDraft.step ?? 0,
          status: finalDraft.status || 'draft',
          raw_data: finalDraft.rawData,
          created_at: finalDraft.createdAt,
          updated_at: finalDraft.updatedAt
        };

        for (let attempt = 0; attempt < 5; attempt++) {
          const { error } = await client.from('validation_drafts').upsert([supabaseRow]);
          if (!error) {
            console.log('[DBService] Saved draft to Supabase validation_drafts successfully:', finalDraft.id);
            break;
          }
          const errMsg = error.message || '';
          const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                        || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                        || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
          if (matchCol && matchCol[1] && supabaseRow.hasOwnProperty(matchCol[1])) {
            delete supabaseRow[matchCol[1]];
            continue;
          }
          console.warn('[DBService] Supabase save draft warning:', error.message);
          break;
        }
      } catch (sbErr) {
        console.warn('[DBService] Supabase saveValidationDraft exception:', sbErr);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('validation_drafts_updated', { detail: finalDraft }));
      try {
        localStorage.setItem('kdb_validation_drafts_last_updated', String(Date.now()));
      } catch (_) {}
    }

    return finalDraft;
  },

  async deleteValidationDraft(id: string): Promise<void> {
    if (validationDraftsMemoryCache) {
      validationDraftsMemoryCache = validationDraftsMemoryCache.filter(d => d.id !== id);
      validationDraftsCacheTimestamp = Date.now();
    }
    removeFromLocalStorageCollection('kdb_validation_drafts_cache', id, 'id');

    try {
      await fetch(`/api/validation-drafts/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('[DBService] Local API deleteValidationDraft warning:', e);
    }

    const client = await getSupabase();
    if (client) {
      try {
        await client.from('validation_drafts').delete().eq('id', id);
      } catch (err) {
        console.warn('[DBService] Supabase deleteValidationDraft warning:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('validation_drafts_updated', { detail: { deletedId: id } }));
      try {
        localStorage.setItem('kdb_validation_drafts_last_updated', String(Date.now()));
      } catch (_) {}
    }
  },

  async getScopeDisclosures(): Promise<ScopeDisclosureRecord[]> {
    try {
      const response = await fetch('/api/scope-disclosures');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          safeSetLocalStorage('kdb_scope_disclosures_cache', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('[DBService] Local API getScopeDisclosures warning:', e);
    }

    const client = await getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('scope_disclosures').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          const mapped = data.map(row => fromDb(row, {
            id: '', dboName: '', permitNo: '', premiseName: '', location: '', category: '',
            signerName: '', signerDesignation: '', signature: '', signedDate: '', status: 'draft',
            createdAt: '', updatedAt: '', signedAt: ''
          })) as ScopeDisclosureRecord[];
          safeSetLocalStorage('kdb_scope_disclosures_cache', JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('[DBService] Supabase getScopeDisclosures warning:', err);
      }
    }

    return getArrayFromLocalStorage<ScopeDisclosureRecord>('kdb_scope_disclosures_cache');
  },

  async saveScopeDisclosure(record: ScopeDisclosureRecord): Promise<ScopeDisclosureRecord> {
    const nowIso = new Date().toISOString();
    const finalRecord: ScopeDisclosureRecord = {
      ...record,
      id: record.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'SD-' + Date.now()),
      createdAt: record.createdAt || nowIso,
      updatedAt: nowIso
    };

    updateLocalStorageCollection('kdb_scope_disclosures_cache', finalRecord, 'id');

    try {
      await fetch('/api/scope-disclosures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalRecord)
      });
    } catch (e) {
      console.warn('[DBService] Local API saveScopeDisclosure warning:', e);
    }

    const client = await getSupabase();
    if (client) {
      try {
        await client.from('scope_disclosures').upsert(toDb(finalRecord));
      } catch (err) {
        console.warn('[DBService] Supabase saveScopeDisclosure warning:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scope_disclosure_updated', { detail: finalRecord }));
    }

    return finalRecord;
  },

  async deleteScopeDisclosure(id: string): Promise<void> {
    removeFromLocalStorageCollection('kdb_scope_disclosures_cache', id, 'id');

    try {
      await fetch(`/api/scope-disclosures/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('[DBService] Local API deleteScopeDisclosure warning:', e);
    }

    const client = await getSupabase();
    if (client) {
      try {
        await client.from('scope_disclosures').delete().eq('id', id);
      } catch (err) {
        console.warn('[DBService] Supabase deleteScopeDisclosure warning:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scope_disclosure_deleted', { detail: { id } }));
    }
  }
};
