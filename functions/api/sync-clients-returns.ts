import { getGoogleAccessToken } from "../utils/googleSheets";

export async function onRequest(context: { request: Request; env: Record<string, string> }) {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders });
  }

  try {
    const env = context.env || {};
    let body: any = {};
    if (context.request.method === "POST") {
      try {
        body = await context.request.json();
      } catch (_) {}
    }

    let clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL : '');
    let privateKey = env.GOOGLE_PRIVATE_KEY || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_PRIVATE_KEY : '');
    let spreadsheetId = 
      env.CLIENTS_RETURNS_SPREADSHEET_ID || 
      body.spreadsheetId || 
      env.GOOGLE_SPREADSHEET_ID || 
      (typeof process !== 'undefined' && process.env ? (process.env.CLIENTS_RETURNS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID) : '');

    if (clientEmail) clientEmail = clientEmail.trim().replace(/^["']|["']$/g, '');
    if (privateKey) privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    if (spreadsheetId) spreadsheetId = spreadsheetId.trim().replace(/^["']|["']$/g, '');

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: "Clients & Returns Spreadsheet ID is missing. Please configure it in Settings or Cloudflare secrets." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (!clientEmail || !privateKey) {
      return new Response(
        JSON.stringify({ error: "Google Service Account credentials (EMAIL/PRIVATE_KEY) are missing in environment variables." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const token = await getGoogleAccessToken(clientEmail, privateKey);

    const cleanNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const str = String(val).replace(/,/g, '').replace(/[\s-]/g, '').trim();
      if (!str) return 0;
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const isSummaryRow = (name: string): boolean => {
      const n = (name || '').toLowerCase().trim();
      return !n || n === 'summary' || n === 'total' || n.startsWith('total ') || n === 'milk bars' ||
        n === 'dispensers' || n === 'cooling plants' || n === 'mini dairy' || n === 'processors' ||
        n.startsWith('valid:') || n.includes('status count');
    };

    const fetchValues = async (tab: string, range: string) => {
      try {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!${range}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data.values || [];
      } catch (_) {
        return null;
      }
    };

    // Fast-path: Attempt direct fetch of 'Clients' and 'Returns' tabs first
    let clientsTab = (body.clientsTab || 'Clients').trim();
    let returnsTab = (body.returnsTab || 'Returns').trim();

    let [clientRows, returnRows] = await Promise.all([
      fetchValues(clientsTab, 'A1:R10000'),
      fetchValues(returnsTab, 'A1:N10000')
    ]);

    // If direct fetch didn't succeed, query spreadsheet metadata to resolve tab names dynamically
    if (!clientRows || !returnRows) {
      try {
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (metaRes.ok) {
          const metaData: any = await metaRes.json();
          const sheetTitles = (metaData.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);

          if (!clientRows) {
            const foundClientTab = sheetTitles.find((s: string) => s.toLowerCase().trim() === clientsTab.toLowerCase().trim()) ||
              sheetTitles.find((s: string) => ['clients', 'clients_db', 'clients db', 'clients registry'].includes(s.toLowerCase().trim())) ||
              sheetTitles.find((s: string) => s.toLowerCase().includes('client')) ||
              'Clients';
            clientsTab = foundClientTab;
            clientRows = await fetchValues(clientsTab, 'A1:R10000');
          }

          if (!returnRows) {
            const foundReturnTab = sheetTitles.find((s: string) => s.toLowerCase().trim() === returnsTab.toLowerCase().trim()) ||
              sheetTitles.find((s: string) => ['returns', 'returns_db', 'returns db', 'client returns', 'returns registry'].includes(s.toLowerCase().trim())) ||
              sheetTitles.find((s: string) => s.toLowerCase().includes('return')) ||
              'Returns';
            returnsTab = foundReturnTab;
            returnRows = await fetchValues(returnsTab, 'A1:N10000');
          }
        }
      } catch (metaErr) {
        console.warn('Metadata resolution warning:', metaErr);
      }
    }

    clientRows = clientRows || [];
    returnRows = returnRows || [];

    // 3. Parse client rows (18 columns schema) with dynamic header row detection
    const clients: any[] = [];
    let clientHeaderRowIdx = clientRows.findIndex((row: any) => 
      Array.isArray(row) && row.some((cell: any) => {
        const c = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return c === 'clientname' || c === 'client' || c === 'premisename' || c === 'dbo';
      })
    );
    if (clientHeaderRowIdx === -1 && clientRows.length > 0) clientHeaderRowIdx = 0;

    if (clientHeaderRowIdx !== -1 && clientRows.length > clientHeaderRowIdx + 1) {
      const headers = (clientRows[clientHeaderRowIdx] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
      const getIdx = (name: string, fallbackIdx: number) => {
        const idx = headers.findIndex((h: string) => h.includes(name));
        return idx >= 0 ? idx : fallbackIdx;
      };

      const clientNameIdx = getIdx('client', 0);
      const premiseNameIdx = getIdx('premise', 1);
      const categoryIdx = getIdx('category', 2);
      const startYearIdx = getIdx('startyear', 3);
      const startMonthIdx = getIdx('startmonth', 4);
      const endYearIdx = getIdx('endyear', 5);
      const endMonthIdx = getIdx('endmonth', 6);
      const telIdx = getIdx('contact', getIdx('tel', 7));
      const contactPersonIdx = getIdx('person', 8);
      const locationIdx = getIdx('location', 9);
      const countyIdx = getIdx('county', 10);
      const coolingCapIdx = getIdx('capacity', 11);
      const permitStatusIdx = getIdx('permitstatus', 12);
      const opStatusIdx = getIdx('operationalstatus', 13);
      const levyInfoIdx = getIdx('levy', 14);
      const expiryDateIdx = getIdx('expiry', 15);
      const permitNumIdx = getIdx('permitnumber', 16);
      const branchesIdx = getIdx('branch', 17);

      for (let i = clientHeaderRowIdx + 1; i < clientRows.length; i++) {
        const r = clientRows[i];
        if (!r || r.length === 0 || !r[clientNameIdx]) continue;
        const cName = String(r[clientNameIdx] || '').trim();
        if (isSummaryRow(cName)) continue;

        const pName = String(r[premiseNameIdx] || '').trim();
        const permitNo = String(r[permitNumIdx] || '').trim();

        let branchesList: any[] = [];
        const rawBranches = r[branchesIdx];
        if (rawBranches && typeof rawBranches === 'string' && rawBranches.trim().startsWith('[')) {
          try { branchesList = JSON.parse(rawBranches); } catch (_) {}
        }

        clients.push({
          id: permitNo ? `CLI-${permitNo.replace(/[^a-zA-Z0-9]/g, '-')}` : `CLI-ROW-${i}-${cName.replace(/[^a-zA-Z0-9]/g, '')}`,
          customerNumber: permitNo ? `CUST-${permitNo.replace(/[^a-zA-Z0-9]/g, '')}` : `CUST-${10000 + i}`,
          clientName: cName,
          premiseName: pName || cName,
          premiseCategory: String(r[categoryIdx] || 'Milk Bar').trim(),
          startYear: cleanNum(r[startYearIdx]) || new Date().getFullYear(),
          startMonth: String(r[startMonthIdx] || 'January').trim(),
          endYear: r[endYearIdx] ? cleanNum(r[endYearIdx]) : null,
          endMonth: r[endMonthIdx] ? String(r[endMonthIdx]).trim() : null,
          tel: String(r[telIdx] || '').trim(),
          contactPerson: String(r[contactPersonIdx] || '').trim(),
          location: String(r[locationIdx] || 'N/A').trim(),
          county: String(r[countyIdx] || 'N/A').trim(),
          coolingCapacity: r[coolingCapIdx] ? cleanNum(r[coolingCapIdx]) : undefined,
          permitStatus: String(r[permitStatusIdx] || 'valid').trim(),
          operationalStatus: String(r[opStatusIdx] || 'operating').trim(),
          levyInfo: String(r[levyInfoIdx] || '').trim(),
          expiryDate: String(r[expiryDateIdx] || '').trim(),
          permitNumber: permitNo,
          branches: branchesList
        });
      }
    }

    // 4. Parse return rows (14 columns schema) with dynamic header row detection
    const returns: any[] = [];
    let returnHeaderRowIdx = returnRows.findIndex((row: any) => 
      Array.isArray(row) && row.some((cell: any) => {
        const c = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return c.includes('dboname') || c.includes('clientname') || (c.includes('period') && c.includes('qty'));
      })
    );
    if (returnHeaderRowIdx === -1 && returnRows.length > 0) returnHeaderRowIdx = 0;

    if (returnHeaderRowIdx !== -1 && returnRows.length > returnHeaderRowIdx + 1) {
      const headers = (returnRows[returnHeaderRowIdx] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
      const getIdx = (name: string, fallbackIdx: number) => {
        const idx = headers.findIndex((h: string) => h.includes(name));
        return idx >= 0 ? idx : fallbackIdx;
      };

      const cNameIdx = getIdx('dbo', getIdx('client', 0));
      const yearIdx = getIdx('year', 1);
      const periodIdx = getIdx('period', 2);
      const qtyIdx = getIdx('qty', 3);
      const invoiceAmtIdx = getIdx('invoice', 4);
      const retDateIdx = getIdx('returndate', 5);
      const payAmtIdx = getIdx('paymentamount', getIdx('paid', 6));
      const payDateIdx = getIdx('paymentdate', 7);
      const txnRefIdx = getIdx('txn', getIdx('mr', 8));
      const lessCfIdx = getIdx('cf', 9);
      const outBalIdx = getIdx('outstanding', getIdx('balance', 10));
      const agingIdx = getIdx('aging', 11);
      const payStatusIdx = getIdx('status', 12);
      const commentsIdx = getIdx('comment', 13);

      for (let i = returnHeaderRowIdx + 1; i < returnRows.length; i++) {
        const r = returnRows[i];
        if (!r || r.length === 0 || !r[cNameIdx]) continue;
        const cName = String(r[cNameIdx] || '').trim();
        if (isSummaryRow(cName) || cName.toLowerCase() === 'dbo name') continue;

        const rawYear = cleanNum(r[yearIdx]) || new Date().getFullYear();
        const rawPeriod = String(r[periodIdx] || 'January').trim();
        const rawQty = cleanNum(r[qtyIdx]);
        const rawInv = cleanNum(r[invoiceAmtIdx]);
        const rawPay = cleanNum(r[payAmtIdx]);
        const rawTxn = String(r[txnRefIdx] || '').trim();
        const rawLessCf = cleanNum(r[lessCfIdx]);
        const rawOutBal = r[outBalIdx] !== undefined ? cleanNum(r[outBalIdx]) : (rawInv - rawPay - rawLessCf);
        const rawAging = cleanNum(r[agingIdx]);

        returns.push({
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
          paymentStatus: String(r[payStatusIdx] || (rawOutBal <= 0 ? 'Paid' : 'Unpaid')).trim(),
          comments: commentsIdx >= 0 && r[commentsIdx] ? String(r[commentsIdx]).trim() : ''
        });
      }
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Response(JSON.stringify({
      success: true,
      clients,
      returns,
      clientsCount: clients.length,
      returnsCount: returns.length,
      time: now,
      clientsTab,
      returnsTab
    }), { headers: jsonHeaders });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to sync clients and returns from Google Sheets" }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
