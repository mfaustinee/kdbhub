import { LicensedClient, ClientBranch, ClientReturn, IntegratedClientAccount } from '../types';
import { DBService } from './db';

// Clean permit numbers for accurate identification
export const cleanPermitNumber = (permit: string | undefined | null): string => {
  if (!permit) return '';
  return permit.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// Normalize names for flexible string comparison
export const normalizeName = (name: string | undefined | null): string => {
  if (!name) return '';
  return name.toString().toLowerCase().trim().replace(/[\s\-_.,/()]+/g, ' ');
};

// Alphanumeric stem extraction
export const normalizeAlphanumeric = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Comprehensive 4-tier client matching
export const matchClientForReturn = (
  rawNameOrPermit: string,
  clients: LicensedClient[]
): { client: LicensedClient; branch?: ClientBranch; matchType: 'permit' | 'exact_name' | 'fuzzy_name' | 'stem' } | null => {
  if (!rawNameOrPermit || !clients || clients.length === 0) return null;

  const cleanPerm = cleanPermitNumber(rawNameOrPermit);
  const normTarget = normalizeName(rawNameOrPermit);
  const alphaTarget = normalizeAlphanumeric(rawNameOrPermit);

  // 1. Cleaned Permit / ID match (Highest Priority)
  if (cleanPerm) {
    for (const c of clients) {
      if (cleanPermitNumber(c.permitNumber) === cleanPerm || cleanPermitNumber(c.id) === cleanPerm) {
        return { client: c, matchType: 'permit' };
      }
      if (c.branches && c.branches.length > 0) {
        const matchedBranch = c.branches.find(b => cleanPermitNumber(b.permitNumber) === cleanPerm || cleanPermitNumber(b.id) === cleanPerm);
        if (matchedBranch) {
          return { client: c, branch: matchedBranch, matchType: 'permit' };
        }
      }
    }
  }

  // 2. Exact or Normalized Name / Premise match
  for (const c of clients) {
    if (normalizeName(c.clientName) === normTarget || normalizeName(c.premiseName) === normTarget) {
      return { client: c, matchType: 'exact_name' };
    }
    if (c.branches && c.branches.length > 0) {
      const matchedBranch = c.branches.find(b => normalizeName(b.premiseName) === normTarget);
      if (matchedBranch) {
        return { client: c, branch: matchedBranch, matchType: 'exact_name' };
      }
    }
  }

  // 3. Flexible Substring / Fuzzy Search
  for (const c of clients) {
    const cName = normalizeName(c.clientName);
    const pName = normalizeName(c.premiseName);
    if ((normTarget.length >= 4 && (cName.includes(normTarget) || normTarget.includes(cName))) ||
        (normTarget.length >= 4 && (pName.includes(normTarget) || normTarget.includes(pName)))) {
      return { client: c, matchType: 'fuzzy_name' };
    }
    if (c.branches && c.branches.length > 0) {
      const matchedBranch = c.branches.find(b => {
        const bName = normalizeName(b.premiseName);
        return normTarget.length >= 4 && (bName.includes(normTarget) || normTarget.includes(bName));
      });
      if (matchedBranch) {
        return { client: c, branch: matchedBranch, matchType: 'fuzzy_name' };
      }
    }
  }

  // 4. Alphanumeric Stem Containment (for typos, punctuation, spacing variations)
  if (alphaTarget.length >= 5) {
    for (const c of clients) {
      const cAlpha = normalizeAlphanumeric(c.clientName);
      const pAlpha = normalizeAlphanumeric(c.premiseName);
      if (cAlpha.includes(alphaTarget) || alphaTarget.includes(cAlpha) ||
          pAlpha.includes(alphaTarget) || alphaTarget.includes(pAlpha)) {
        return { client: c, matchType: 'stem' };
      }
    }
  }

  return null;
};

// Auto-provisions a client stub when an imported return introduces a new operator
export const autoProvisionClientStub = (
  rawClientName: string,
  year?: number,
  period?: string,
  defaultCounty: string = 'Uasin Gishu'
): LicensedClient => {
  const cleanName = rawClientName.trim();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const stem = cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'CLIENT';

  const newClient: LicensedClient = {
    id: `CLI-${timestamp}-${randomSuffix}`,
    clientName: cleanName,
    premiseName: cleanName,
    permitNumber: `PENDING-${stem}-${timestamp.toString().slice(-4)}`,
    premiseCategory: 'Milk Bar',
    location: 'Head Office / Registered Premise',
    county: defaultCounty,
    tel: '',
    contactPerson: 'Authorized Officer',
    startYear: year || new Date().getFullYear(),
    startMonth: period || 'January',
    endYear: null,
    endMonth: null,
    permitStatus: 'active',
    operationalStatus: 'operating',
    levyInfo: 'QFR',
    branches: []
  };

  return newClient;
};

// Build integrated accounts mapping clients, branches, returns, and financial health
export const buildIntegratedAccounts = (
  clients: LicensedClient[],
  returns: ClientReturn[]
): IntegratedClientAccount[] => {
  if (!clients || clients.length === 0) return [];

  // Group returns by matched client ID
  const returnsByClientId = new Map<string, ClientReturn[]>();
  const returnsByClientName = new Map<string, ClientReturn[]>();

  for (const ret of (returns || [])) {
    if (ret.clientId) {
      const existing = returnsByClientId.get(ret.clientId) || [];
      existing.push(ret);
      returnsByClientId.set(ret.clientId, existing);
    }
    if (ret.clientName) {
      const norm = normalizeName(ret.clientName);
      const existing = returnsByClientName.get(norm) || [];
      existing.push(ret);
      returnsByClientName.set(norm, existing);
    }
  }

  return clients.map(client => {
    // 1. Locate all returns belonging to this client (by ID primary, or normalized name)
    const directReturns = returnsByClientId.get(client.id) || [];
    const nameReturns = returnsByClientName.get(normalizeName(client.clientName)) || [];
    const premiseReturns = returnsByClientName.get(normalizeName(client.premiseName)) || [];

    // Deduplicate returns by ID
    const returnMap = new Map<string, ClientReturn>();
    [...directReturns, ...nameReturns, ...premiseReturns].forEach(r => {
      if (r && r.id) returnMap.set(r.id, r);
    });
    const clientReturns = Array.from(returnMap.values());

    // Sort returns chronologically
    const monthsOrder = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    clientReturns.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const mIdxA = monthsOrder.indexOf((a.period || '').toLowerCase());
      const mIdxB = monthsOrder.indexOf((b.period || '').toLowerCase());
      return mIdxB - mIdxA;
    });

    // 2. Compute aggregate financial and volume statistics
    let totalVolume = 0;
    let totalInvoice = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let unpaidCount = 0;

    for (const r of clientReturns) {
      totalVolume += Number(r.qty) || 0;
      totalInvoice += Number(r.invoiceAmount) || 0;
      totalPaid += Number(r.paymentAmount) || 0;
      totalBalance += Number(r.outstandingBalance) || 0;
      if (r.paymentStatus !== 'Fully Paid' && (r.outstandingBalance > 0 || r.paymentStatus === 'Unpaid')) {
        unpaidCount++;
      }
    }

    // Determine latest filing period
    const latestReturn = clientReturns[0];
    const latestFilingPeriod = latestReturn ? `${latestReturn.period} ${latestReturn.year}` : 'None';

    // Determine compliance status
    let complianceStatus: 'compliant' | 'non_filer' | 'in_arrears' = 'compliant';
    if (clientReturns.length === 0) {
      complianceStatus = 'non_filer';
    } else if (totalBalance > 0) {
      complianceStatus = 'in_arrears';
    } else {
      complianceStatus = 'compliant';
    }

    const averageMonthlyVolume = clientReturns.length > 0 ? Math.round(totalVolume / clientReturns.length) : 0;

    return {
      client,
      branches: client.branches || [],
      returns: clientReturns,
      summary: {
        totalVolumeDeclared: totalVolume,
        totalInvoiceAmount: totalInvoice,
        totalPaidAmount: totalPaid,
        totalOutstandingBalance: totalBalance,
        complianceStatus,
        latestFilingPeriod,
        returnsCount: clientReturns.length,
        unpaidReturnsCount: unpaidCount,
        averageMonthlyVolume
      }
    };
  });
};

// Dual-Ingestion Pipeline with Auto-Discovery:
// Validates the 14 mandatory columns and auto-provisions client profile stubs when returns have new clients
export interface IngestionResult {
  validatedReturns: ClientReturn[];
  newClientsProvisioned: LicensedClient[];
  errors: string[];
}

export const parseCleanFloat = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const processReturnsIngestion = async (
  rawRows: string[][],
  existingClients: LicensedClient[],
  existingReturns: ClientReturn[],
  options: { autoProvisionClients?: boolean; defaultCounty?: string } = { autoProvisionClients: true, defaultCounty: 'Uasin Gishu' }
): Promise<IngestionResult> => {
  const monthsList = [
    'january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  const errors: string[] = [];
  const validatedReturns: ClientReturn[] = [];
  const newClientsMap = new Map<string, LicensedClient>();
  const activeClientsList = [...existingClients];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // account for header line + 1-based index
    const values = rawRows[i];

    if (!values || values.length === 0 || values.every(v => !v || v.trim() === '')) {
      continue;
    }

    if (values.length < 14) {
      errors.push(`Row ${rowNum}: Has ${values.length} columns instead of the required 14 columns.`);
      continue;
    }

    // 14 standard columns
    const csvClientName = (values[0] || '').trim();
    const rawYear = (values[1] || '').trim();
    const yearVal = parseInt(rawYear);
    const rawPeriod = (values[2] || '').trim();
    const periodVal = rawPeriod ? rawPeriod.charAt(0).toUpperCase() + rawPeriod.slice(1).toLowerCase() : '';
    const qtyVal = parseCleanFloat(values[3]);
    const invoiceVal = parseCleanFloat(values[4]);
    const retDateVal = (values[5] || '').trim() || new Date().toISOString().slice(0, 10);
    const payVal = parseCleanFloat(values[6]);
    const payDateVal = (values[7] || '').trim() || null;
    const refVal = (values[8] || '').trim();
    const cfVal = parseCleanFloat(values[9]);
    const rawOutstanding = values[10];
    const rawAging = values[11];
    const rawPayStatus = (values[12] || '').trim();
    const commsVal = (values[13] || '').trim();

    if (!csvClientName) {
      errors.push(`Row ${rowNum}: clientname is required.`);
      continue;
    }

    // Match against active client registry
    let matchResult = matchClientForReturn(csvClientName, activeClientsList);
    let matchedClient = matchResult?.client;

    // Option B: Auto-Discovery Pipeline
    if (!matchedClient) {
      if (options.autoProvisionClients !== false) {
        // Check if we already auto-provisioned this client in this batch
        const normBatch = normalizeName(csvClientName);
        if (newClientsMap.has(normBatch)) {
          matchedClient = newClientsMap.get(normBatch)!;
        } else {
          // Auto-provision client stub
          const stub = autoProvisionClientStub(csvClientName, yearVal, periodVal, options.defaultCounty || 'Uasin Gishu');
          newClientsMap.set(normBatch, stub);
          activeClientsList.push(stub);
          matchedClient = stub;
        }
      } else {
        errors.push(`Row ${rowNum}: Could not find a registered client matching "${csvClientName}".`);
        continue;
      }
    }

    // Validate Year
    if (isNaN(yearVal) || yearVal < 1980 || yearVal > 2035) {
      errors.push(`Row ${rowNum}: Invalid Year "${rawYear}". Must be a number between 1980 and 2035.`);
      continue;
    }

    // Validate Period
    if (!monthsList.includes(periodVal.toLowerCase())) {
      errors.push(`Row ${rowNum}: Invalid Period "${rawPeriod}". Must be a valid month (e.g. January).`);
      continue;
    }

    // Calculate Outstanding Balance & Aging
    const outstanding = rawOutstanding ? parseCleanFloat(rawOutstanding) : Math.max(0, invoiceVal - payVal - cfVal);
    let aging = 0;
    if (rawAging) {
      aging = parseInt(rawAging.replace(/,/g, '')) || 0;
    } else if (outstanding > 0 && retDateVal) {
      const retDateObj = new Date(retDateVal);
      const today = new Date();
      if (!isNaN(retDateObj.getTime())) {
        const diffTime = Math.abs(today.getTime() - retDateObj.getTime());
        aging = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Determine Payment Status
    let status: 'Fully Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (rawPayStatus && ['Fully Paid', 'Partially Paid', 'Unpaid'].includes(rawPayStatus)) {
      status = rawPayStatus as any;
    } else {
      if (outstanding <= 0) {
        status = 'Fully Paid';
      } else if (payVal > 0) {
        status = 'Partially Paid';
      }
    }

    // Determine deterministic Return ID (or update existing)
    const existing = existingReturns.find(r => 
      (r.clientId === matchedClient!.id || normalizeName(r.clientName) === normalizeName(matchedClient!.clientName)) &&
      r.year === yearVal &&
      (r.period || '').trim().toLowerCase() === periodVal.toLowerCase()
    );

    const returnId = existing 
      ? existing.id 
      : `RET-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const returnRecord: ClientReturn = {
      id: returnId,
      clientId: matchedClient!.id,
      clientName: matchedClient!.clientName,
      year: yearVal,
      period: periodVal,
      qty: isNaN(qtyVal) ? 0 : qtyVal,
      invoiceAmount: isNaN(invoiceVal) ? 0 : invoiceVal,
      returnDate: retDateVal,
      paymentAmount: isNaN(payVal) ? 0 : payVal,
      paymentDate: payDateVal || '',
      txnRef: refVal,
      lessCF: isNaN(cfVal) ? 0 : cfVal,
      outstandingBalance: outstanding,
      agingDays: aging,
      paymentStatus: status,
      comments: commsVal || `Imported return for ${periodVal} ${yearVal}`
    };

    // Replace if duplicate within batch
    const duplicateIdx = validatedReturns.findIndex(r => 
      r.clientId === matchedClient!.id && 
      r.year === yearVal && 
      (r.period || '').trim().toLowerCase() === periodVal.toLowerCase()
    );

    if (duplicateIdx >= 0) {
      validatedReturns[duplicateIdx] = returnRecord;
    } else {
      validatedReturns.push(returnRecord);
    }
  }

  return {
    validatedReturns,
    newClientsProvisioned: Array.from(newClientsMap.values()),
    errors
  };
};

export const ClientReturnsPipeline = {
  cleanPermitNumber,
  normalizeName,
  normalizeAlphanumeric,
  matchClientForReturn,
  autoProvisionClientStub,
  buildIntegratedAccounts,
  processReturnsIngestion
};
