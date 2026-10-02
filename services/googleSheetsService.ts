import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut,
  Auth
} from 'firebase/auth';
import { LicensedClient, ClientReturn, ClientBranch } from '../types';

const defaultFirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0410181080",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1076874979005:web:25682e11a674c9e298b9d4",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0410181080.firebaseapp.com",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0410181080.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1076874979005",
  measurementId: "",
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || "1076874979005-9tjub8fadialv782dqrs0i6s5bhpfudk.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

const getSafeAuth = (): Auth | null => {
  if (authInstance) return authInstance;
  try {
    if (typeof window === 'undefined') return null;
    const resolvedApiKey = import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey || '';
    if (!resolvedApiKey) {
      // API key is not configured or has been scrubbed for security
      return null;
    }
    const resolvedConfig = {
      ...defaultFirebaseConfig,
      apiKey: resolvedApiKey
    };
    appInstance = getApps().length > 0 ? getApp() : initializeApp(resolvedConfig);
    authInstance = getAuth(appInstance);
    return authInstance;
  } catch (err) {
    console.warn('[GoogleSheetsService] Firebase Auth initialization warning:', err);
    return null;
  }
};

const getProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  return provider;
};

// In-memory token cache (do NOT store token in localStorage for security)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// 18-column header schema for Clients Registry
export const CLIENTS_HEADERS = [
  'clientname',
  'premisename',
  'premisecategory',
  'startyear',
  'startmonth',
  'endyear',
  'endmonth',
  'tel',
  'contactperson',
  'location',
  'county',
  'coolingcapacity',
  'permitstatus',
  'operationalstatus',
  'levyinfo',
  'expirydate',
  'permitnumber',
  'branches'
];

// 14-column header schema for Returns Registry
export const RETURNS_HEADERS = [
  'clientname',
  'year',
  'period',
  'qty',
  'invoiceamount',
  'returndate',
  'paymentamount',
  'paymentdate',
  'txnref',
  'lesscf',
  'outstandingbalance',
  'agingdays',
  'paymentstatus',
  'comments'
];

export const SPREADSHEET_ID_STORAGE_KEY = 'kdb_google_spreadsheet_id';
export const CLIENTS_TAB_STORAGE_KEY = 'kdb_google_clients_tab';
export const RETURNS_TAB_STORAGE_KEY = 'kdb_google_returns_tab';

export const GoogleSheetsService = {
  // Tab Name Management to avoid colliding with other existing tabs
  getClientsTabName(): string {
    try {
      const stored = localStorage.getItem(CLIENTS_TAB_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch (_) {}
    return 'Clients_DB';
  },

  setClientsTabName(name: string): void {
    try {
      localStorage.setItem(CLIENTS_TAB_STORAGE_KEY, name.trim());
    } catch (_) {}
  },

  getReturnsTabName(): string {
    try {
      const stored = localStorage.getItem(RETURNS_TAB_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch (_) {}
    return 'Returns_DB';
  },

  setReturnsTabName(name: string): void {
    try {
      localStorage.setItem(RETURNS_TAB_STORAGE_KEY, name.trim());
    } catch (_) {}
  },
  // Setup Auth state listener
  initAuth(
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
  ) {
    try {
      const auth = getSafeAuth();
      if (!auth) {
        if (onAuthFailure) onAuthFailure();
        return () => {};
      }
      return onAuthStateChanged(auth, async (user: User | null) => {
        try {
          if (user) {
            if (cachedAccessToken) {
              if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
            } else if (!isSigningIn) {
              cachedAccessToken = null;
              if (onAuthFailure) onAuthFailure();
            }
          } else {
            cachedAccessToken = null;
            if (onAuthFailure) onAuthFailure();
          }
        } catch (innerErr) {
          console.warn('[GoogleSheetsService] onAuthStateChanged callback notice:', innerErr);
          if (onAuthFailure) onAuthFailure();
        }
      });
    } catch (err) {
      console.warn('[GoogleSheetsService] initAuth notice:', err);
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }
  },

  // Interactive Sign In with Google
  async signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
    const auth = getSafeAuth();
    if (!auth) {
      throw new Error('Google Authentication service is not initialized.');
    }

    try {
      isSigningIn = true;
      const provider = getProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Could not obtain Google OAuth access token. Please grant permissions.');
      }
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (err: any) {
      console.error('[GoogleSheetsService] Sign-in error:', err);
      throw err;
    } finally {
      isSigningIn = false;
    }
  },

  async getAccessToken(): Promise<string | null> {
    return cachedAccessToken;
  },

  async isConnected(): Promise<boolean> {
    const auth = getSafeAuth();
    return !!cachedAccessToken && !!auth?.currentUser;
  },

  getCurrentUser(): User | null {
    try {
      const auth = getSafeAuth();
      return auth ? auth.currentUser : null;
    } catch (_) {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      const auth = getSafeAuth();
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('[GoogleSheetsService] logout notice:', err);
    }
    cachedAccessToken = null;
  },

  // Spreadsheet ID Management
  getSpreadsheetId(): string {
    try {
      const stored = localStorage.getItem(SPREADSHEET_ID_STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch (_) {}
    return '';
  },

  setSpreadsheetId(idOrUrl: string): string {
    let cleanId = idOrUrl.trim();
    // Support pasting full Google Sheets URL
    const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }
    // Clean any quotes
    cleanId = cleanId.replace(/^["']|["']$/g, '');
    try {
      localStorage.setItem(SPREADSHEET_ID_STORAGE_KEY, cleanId);
    } catch (_) {}
    return cleanId;
  },

  // Helper to make authenticated Google Sheets API fetch
  async sheetsApiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Google Account is not connected. Please connect with Google first.');
    }

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      let errMsg = `Google Sheets API Error (${res.status})`;
      try {
        const errJson = await res.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return await res.json();
  },

  // Inspect existing sheet metadata and tabs
  async getSpreadsheetMetadata(spreadsheetId?: string): Promise<{ title: string; sheets: string[] }> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) throw new Error('No Spreadsheet ID configured.');

    const data = await this.sheetsApiFetch(sId);
    const sheetTitles = (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
    return {
      title: data.properties?.title || 'Google Sheet',
      sheets: sheetTitles
    };
  },

  // Find matching sheet title (respects custom configured tab names to avoid touching other existing tabs)
  async resolveTabName(spreadsheetId: string, preferredNames: string[], defaultFallback: string): Promise<string> {
    try {
      const isClients = preferredNames.some(p => p.toLowerCase().includes('client'));
      const isReturns = preferredNames.some(p => p.toLowerCase().includes('return'));
      
      const customTab = isClients ? this.getClientsTabName() : (isReturns ? this.getReturnsTabName() : null);

      const meta = await this.getSpreadsheetMetadata(spreadsheetId);
      
      // If user selected a custom tab name and it exists in the spreadsheet, prioritize it
      if (customTab) {
        const foundCustom = meta.sheets.find(s => s.toLowerCase().trim() === customTab.toLowerCase().trim());
        if (foundCustom) return foundCustom;
      }

      // Otherwise match preferred names
      for (const pref of preferredNames) {
        const found = meta.sheets.find(s => s.toLowerCase().trim() === pref.toLowerCase().trim());
        if (found) return found;
      }
    } catch (_) {}
    return defaultFallback;
  },

  // Ensure dedicated Clients and Returns tabs and headers are set up in the sheet without disturbing other existing tabs
  async initializeSheetTabsAndHeaders(
    spreadsheetId?: string, 
    customClientsTab?: string, 
    customReturnsTab?: string
  ): Promise<{ success: boolean; message: string; clientsTab: string; returnsTab: string }> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) throw new Error('No Spreadsheet ID configured.');

    const meta = await this.getSpreadsheetMetadata(sId);
    const existingTitles = meta.sheets.map(s => s.toLowerCase().trim());

    // Use dedicated names like 'Clients_DB' and 'Returns_DB' by default so existing custom 'Clients' or 'Returns' tabs are never modified
    const targetClientsTab = (customClientsTab || this.getClientsTabName() || 'Clients_DB').trim();
    const targetReturnsTab = (customReturnsTab || this.getReturnsTabName() || 'Returns_DB').trim();

    this.setClientsTabName(targetClientsTab);
    this.setReturnsTabName(targetReturnsTab);

    const requests: any[] = [];

    // Create targetClientsTab if it doesn't exist
    if (!existingTitles.includes(targetClientsTab.toLowerCase().trim())) {
      requests.push({
        addSheet: {
          properties: { title: targetClientsTab, gridProperties: { rowCount: 1000, columnCount: 20 } }
        }
      });
    }

    // Create targetReturnsTab if it doesn't exist
    if (!existingTitles.includes(targetReturnsTab.toLowerCase().trim())) {
      requests.push({
        addSheet: {
          properties: { title: targetReturnsTab, gridProperties: { rowCount: 1000, columnCount: 16 } }
        }
      });
    }

    if (requests.length > 0) {
      await this.sheetsApiFetch(`${sId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests })
      });
    }

    // Set header rows strictly on these isolated tabs
    const token = await this.getAccessToken();
    const updateHeader = async (sheetName: string, headers: string[]) => {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodeURIComponent(sheetName)}!A1:Z1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${sheetName}!A1:Z1`,
            majorDimension: 'ROWS',
            values: [headers]
          })
        }
      );
    };

    await Promise.all([
      updateHeader(targetClientsTab, CLIENTS_HEADERS),
      updateHeader(targetReturnsTab, RETURNS_HEADERS)
    ]);

    return {
      success: true,
      clientsTab: targetClientsTab,
      returnsTab: targetReturnsTab,
      message: `Dedicated tabs "${targetClientsTab}" and "${targetReturnsTab}" configured. All other tabs in your workbook remain 100% untouched.`
    };
  },

  // ----------------------------------------------------------------------
  // CLIENTS REGISTRY OPERATIONS (18 Columns)
  // ----------------------------------------------------------------------
  async getClients(spreadsheetId?: string): Promise<LicensedClient[]> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return [];

    const token = await this.getAccessToken();
    if (!token) {
      // Not connected to Google, cleanly return empty list so local storage database handles it
      return [];
    }

    try {
      const tabName = await this.resolveTabName(sId, ['Clients', 'Clients Registry'], 'Clients');
      const range = `${encodeURIComponent(tabName)}!A1:R10000`;
      const res = await this.sheetsApiFetch(`${sId}/values/${range}`);
      const rows = res.values || [];
      if (rows.length <= 1) return []; // Only header or empty

      const headers: string[] = (rows[0] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
      
      // Find index helper
      const getIdx = (name: string, fallbackIdx: number) => {
        const idx = headers.indexOf(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return idx >= 0 ? idx : fallbackIdx;
      };

      const clientNameIdx = getIdx('clientname', 0);
      const premiseNameIdx = getIdx('premisename', 1);
      const categoryIdx = getIdx('premisecategory', 2);
      const startYearIdx = getIdx('startyear', 3);
      const startMonthIdx = getIdx('startmonth', 4);
      const endYearIdx = getIdx('endyear', 5);
      const endMonthIdx = getIdx('endmonth', 6);
      const telIdx = getIdx('tel', 7);
      const contactPersonIdx = getIdx('contactperson', 8);
      const locationIdx = getIdx('location', 9);
      const countyIdx = getIdx('county', 10);
      const coolingCapIdx = getIdx('coolingcapacity', 11);
      const permitStatusIdx = getIdx('permitstatus', 12);
      const opStatusIdx = getIdx('operationalstatus', 13);
      const levyInfoIdx = getIdx('levyinfo', 14);
      const expiryDateIdx = getIdx('expirydate', 15);
      const permitNumIdx = getIdx('permitnumber', 16);
      const branchesIdx = getIdx('branches', 17);

      const clients: LicensedClient[] = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0 || !r[clientNameIdx]) continue;

        const cName = String(r[clientNameIdx] || '').trim();
        const pName = String(r[premiseNameIdx] || '').trim();
        const permitNo = String(r[permitNumIdx] || '').trim();
        const rawStartYear = Number(r[startYearIdx]) || new Date().getFullYear();
        const rawEndYear = r[endYearIdx] ? Number(r[endYearIdx]) : null;
        const rawCoolingCap = r[coolingCapIdx] ? Number(r[coolingCapIdx]) : undefined;

        let branchesList: ClientBranch[] = [];
        const rawBranches = r[branchesIdx];
        if (rawBranches) {
          if (typeof rawBranches === 'string' && rawBranches.trim().startsWith('[')) {
            try {
              branchesList = JSON.parse(rawBranches);
            } catch (_) {}
          }
        }

        const clientObj: LicensedClient = {
          id: permitNo ? `CLI-${permitNo.replace(/[^a-zA-Z0-9]/g, '-')}` : `CLI-ROW-${i}-${cName.replace(/[^a-zA-Z0-9]/g, '')}`,
          customerNumber: permitNo ? `CUST-${permitNo.replace(/[^a-zA-Z0-9]/g, '')}` : `CUST-${10000 + i}`,
          clientName: cName,
          premiseName: pName || cName,
          premiseCategory: String(r[categoryIdx] || 'Milk Bar').trim() as any,
          startYear: rawStartYear,
          startMonth: String(r[startMonthIdx] || 'January').trim(),
          endYear: rawEndYear,
          endMonth: r[endMonthIdx] ? String(r[endMonthIdx]).trim() : null,
          tel: String(r[telIdx] || '').trim(),
          contactPerson: String(r[contactPersonIdx] || '').trim(),
          location: String(r[locationIdx] || 'N/A').trim(),
          county: String(r[countyIdx] || 'N/A').trim(),
          coolingCapacity: rawCoolingCap,
          permitStatus: (String(r[permitStatusIdx] || 'valid').trim() as any),
          operationalStatus: (String(r[opStatusIdx] || 'operating').trim() as any),
          levyInfo: (String(r[levyInfoIdx] || '').trim() as any),
          expiryDate: String(r[expiryDateIdx] || '').trim(),
          permitNumber: permitNo,
          branches: branchesList
        };

        clients.push(clientObj);
      }

      return clients;
    } catch (err) {
      console.warn('[GoogleSheetsService] getClients error, serving local fallback:', err);
      return [];
    }
  },

  // Map LicensedClient object to 18-element row array
  clientToRow(c: LicensedClient): any[] {
    return [
      c.clientName || '',
      c.premiseName || '',
      c.premiseCategory || 'Milk Bar',
      c.startYear || new Date().getFullYear(),
      c.startMonth || 'January',
      c.endYear || '',
      c.endMonth || '',
      c.tel || '',
      c.contactPerson || '',
      c.location || '',
      c.county || '',
      c.coolingCapacity ?? '',
      c.permitStatus || 'valid',
      c.operationalStatus || 'operating',
      c.operationalStatus === 'closed' ? 'DNQ-R' : (c.levyInfo || ''),
      c.expiryDate || '',
      c.permitNumber || '',
      c.branches && c.branches.length > 0 ? JSON.stringify(c.branches) : ''
    ];
  },

  // Save/Append or Update Client in Sheets
  async saveClient(client: LicensedClient, spreadsheetId?: string): Promise<void> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return;

    const token = await this.getAccessToken();
    if (!token) return;

    try {
      const tabName = await this.resolveTabName(sId, ['Clients', 'Clients Registry'], 'Clients');
      const existingClients = await this.getClients(sId);

      const clean = (s: any) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const targetPermit = clean(client.permitNumber);
      const targetName = clean(client.clientName);
      const targetPremise = clean(client.premiseName);

      const matchIdx = existingClients.findIndex(c => {
        if (targetPermit && clean(c.permitNumber) === targetPermit) return true;
        if (targetName && clean(c.clientName) === targetName && targetPremise && clean(c.premiseName) === targetPremise) return true;
        return false;
      });

      const rowValues = this.clientToRow(client);

      if (matchIdx >= 0) {
        const rowIndex = matchIdx + 2;
        const updateRange = `${encodeURIComponent(tabName)}!A${rowIndex}:R${rowIndex}`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: updateRange,
              majorDimension: 'ROWS',
              values: [rowValues]
            })
          }
        );
      } else {
        const appendRange = `${encodeURIComponent(tabName)}!A:R`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: appendRange,
              majorDimension: 'ROWS',
              values: [rowValues]
            })
          }
        );
      }
    } catch (err) {
      console.warn('[GoogleSheetsService] saveClient warning:', err);
    }
  },

  // Bulk save all clients to Sheets
  async saveClientsBulk(clients: LicensedClient[], spreadsheetId?: string): Promise<void> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return;

    const token = await this.getAccessToken();
    if (!token) return;

    try {
      const tabName = await this.resolveTabName(sId, ['Clients', 'Clients Registry'], 'Clients');
      const rows = [CLIENTS_HEADERS, ...clients.map(c => this.clientToRow(c))];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodeURIComponent(tabName)}!A:R:clear`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodeURIComponent(tabName)}!A1:R${rows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${tabName}!A1:R${rows.length}`,
            majorDimension: 'ROWS',
            values: rows
          })
        }
      );
    } catch (err) {
      console.warn('[GoogleSheetsService] saveClientsBulk warning:', err);
    }
  },

  // ----------------------------------------------------------------------
  // RETURNS REGISTRY OPERATIONS (14 Columns)
  // ----------------------------------------------------------------------
  async getReturns(spreadsheetId?: string): Promise<ClientReturn[]> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return [];

    const token = await this.getAccessToken();
    if (!token) {
      return [];
    }

    try {
      const tabName = await this.resolveTabName(sId, ['Returns', 'Client Returns'], 'Returns');
      const range = `${encodeURIComponent(tabName)}!A1:N10000`;
      const res = await this.sheetsApiFetch(`${sId}/values/${range}`);
      const rows = res.values || [];
      if (rows.length <= 1) return [];

      const headers: string[] = (rows[0] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

      const getIdx = (name: string, fallbackIdx: number) => {
        const idx = headers.indexOf(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return idx >= 0 ? idx : fallbackIdx;
      };

      const cNameIdx = getIdx('clientname', 0);
      const yearIdx = getIdx('year', 1);
      const periodIdx = getIdx('period', 2);
      const qtyIdx = getIdx('qty', 3);
      const invoiceAmtIdx = getIdx('invoiceamount', 4);
      const retDateIdx = getIdx('returndate', 5);
      const payAmtIdx = getIdx('paymentamount', 6);
      const payDateIdx = getIdx('paymentdate', 7);
      const txnRefIdx = getIdx('txnref', 8);
      const lessCfIdx = getIdx('lesscf', 9);
      const outBalIdx = getIdx('outstandingbalance', 10);
      const agingIdx = getIdx('agingdays', 11);
      const payStatusIdx = getIdx('paymentstatus', 12);
      const commentsIdx = getIdx('comments', 13);

      const returnsList: ClientReturn[] = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0 || !r[cNameIdx]) continue;

        const cName = String(r[cNameIdx] || '').trim();
        const rawYear = Number(r[yearIdx]) || 2026;
        const rawPeriod = String(r[periodIdx] || 'January').trim();
        const rawQty = Number(r[qtyIdx]) || 0;
        const rawInv = Number(r[invoiceAmtIdx]) || 0;
        const rawPay = Number(r[payAmtIdx]) || 0;
        const rawLessCf = Number(r[lessCfIdx]) || 0;
        const rawOutBal = Number(r[outBalIdx]) || Math.max(0, rawInv - rawPay - rawLessCf);
        const rawAging = Number(r[agingIdx]) || 0;
        const rawTxn = String(r[txnRefIdx] || '').trim();

        const returnObj: ClientReturn = {
          id: `RET-${rawYear}-${rawPeriod.slice(0, 3)}-${cName.replace(/[^a-zA-Z0-9]/g, '')}-${i}`,
          clientId: cName,
          clientName: cName,
          year: rawYear,
          period: rawPeriod,
          qty: rawQty,
          invoiceAmount: rawInv,
          returnDate: String(r[retDateIdx] || new Date().toISOString().slice(0, 10)).trim(),
          paymentAmount: rawPay,
          paymentDate: String(r[payDateIdx] || '').trim(),
          txnRef: rawTxn,
          lessCF: rawLessCf,
          outstandingBalance: rawOutBal,
          agingDays: rawAging,
          paymentStatus: (String(r[payStatusIdx] || (rawOutBal <= 0 ? 'Paid' : 'Unpaid')).trim() as any),
          comments: String(r[commentsIdx] || '').trim()
        };

        returnsList.push(returnObj);
      }

      return returnsList;
    } catch (err) {
      console.warn('[GoogleSheetsService] getReturns warning, serving local fallback:', err);
      return [];
    }
  },

  returnToRow(r: ClientReturn): any[] {
    return [
      r.clientName || '',
      r.year || 2026,
      r.period || 'January',
      r.qty ?? 0,
      r.invoiceAmount ?? 0,
      r.returnDate || '',
      r.paymentAmount ?? 0,
      r.paymentDate || '',
      r.txnRef || '',
      r.lessCF ?? 0,
      r.outstandingBalance ?? 0,
      r.agingDays ?? 0,
      r.paymentStatus || 'Unpaid',
      r.comments || ''
    ];
  },

  async saveReturn(ret: ClientReturn, spreadsheetId?: string): Promise<void> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return;

    const token = await this.getAccessToken();
    if (!token) return;

    try {
      const tabName = await this.resolveTabName(sId, ['Returns', 'Client Returns'], 'Returns');
      const existingReturns = await this.getReturns(sId);

      const clean = (s: any) => String(s || '').toLowerCase().trim();
      const targetClient = clean(ret.clientName);
      const targetYear = String(ret.year);
      const targetPeriod = clean(ret.period);

      const matchIdx = existingReturns.findIndex(r => {
        return clean(r.clientName) === targetClient && String(r.year) === targetYear && clean(r.period) === targetPeriod;
      });

      const rowValues = this.returnToRow(ret);

      if (matchIdx >= 0) {
        const rowIndex = matchIdx + 2;
        const updateRange = `${encodeURIComponent(tabName)}!A${rowIndex}:N${rowIndex}`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: updateRange,
              majorDimension: 'ROWS',
              values: [rowValues]
            })
          }
        );
      } else {
        const appendRange = `${encodeURIComponent(tabName)}!A:N`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: appendRange,
              majorDimension: 'ROWS',
              values: [rowValues]
            })
          }
        );
      }
    } catch (err) {
      console.warn('[GoogleSheetsService] saveReturn warning:', err);
    }
  },

  async saveReturnsBulk(returnsList: ClientReturn[], spreadsheetId?: string): Promise<void> {
    const sId = spreadsheetId || this.getSpreadsheetId();
    if (!sId) return;

    const token = await this.getAccessToken();
    if (!token) return;

    try {
      const tabName = await this.resolveTabName(sId, ['Returns', 'Client Returns'], 'Returns');
      const rows = [RETURNS_HEADERS, ...returnsList.map(r => this.returnToRow(r))];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodeURIComponent(tabName)}!A:N:clear`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sId}/values/${encodeURIComponent(tabName)}!A1:N${rows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${tabName}!A1:N${rows.length}`,
            majorDimension: 'ROWS',
            values: rows
          })
        }
      );
    } catch (err) {
      console.warn('[GoogleSheetsService] saveReturnsBulk warning:', err);
    }
  }
};
