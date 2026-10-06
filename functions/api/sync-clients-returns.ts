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

    // 1. Get spreadsheet metadata to resolve tab names
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Google Sheets API metadata error (${metaRes.status}): ${errText}`);
    }

    const metaData: any = await metaRes.json();
    const sheetTitles = (metaData.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);

    const customClientsTab = (body.clientsTab || '').trim();
    let clientsTab = sheetTitles.find((s: string) => s.toLowerCase().trim() === customClientsTab.toLowerCase().trim());
    if (!clientsTab) {
      clientsTab = sheetTitles.find((s: string) => ['clients', 'clients_db', 'clients db', 'clients registry'].includes(s.toLowerCase().trim()));
    }
    if (!clientsTab) {
      clientsTab = sheetTitles.find((s: string) => s.toLowerCase().includes('client')) || 'Clients';
    }

    const customReturnsTab = (body.returnsTab || '').trim();
    let returnsTab = sheetTitles.find((s: string) => s.toLowerCase().trim() === customReturnsTab.toLowerCase().trim());
    if (!returnsTab) {
      returnsTab = sheetTitles.find((s: string) => ['returns', 'returns_db', 'returns db', 'client returns', 'returns registry'].includes(s.toLowerCase().trim()));
    }
    if (!returnsTab) {
      returnsTab = sheetTitles.find((s: string) => s.toLowerCase().includes('return')) || 'Returns';
    }

    // 2. Fetch data from both tabs
    const fetchValues = async (tab: string, range: string) => {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      return data.values || [];
    };

    const [clientRows, returnRows] = await Promise.all([
      fetchValues(clientsTab, 'A1:R10000'),
      fetchValues(returnsTab, 'A1:N10000')
    ]);

    // 3. Parse client rows (18 columns schema)
    const clients: any[] = [];
    if (clientRows.length > 1) {
      const headers = (clientRows[0] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
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

      for (let i = 1; i < clientRows.length; i++) {
        const r = clientRows[i];
        if (!r || r.length === 0 || !r[clientNameIdx]) continue;
        const cName = String(r[clientNameIdx] || '').trim();
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
          startYear: Number(r[startYearIdx]) || new Date().getFullYear(),
          startMonth: String(r[startMonthIdx] || 'January').trim(),
          endYear: r[endYearIdx] ? Number(r[endYearIdx]) : null,
          endMonth: r[endMonthIdx] ? String(r[endMonthIdx]).trim() : null,
          tel: String(r[telIdx] || '').trim(),
          contactPerson: String(r[contactPersonIdx] || '').trim(),
          location: String(r[locationIdx] || 'N/A').trim(),
          county: String(r[countyIdx] || 'N/A').trim(),
          coolingCapacity: r[coolingCapIdx] ? Number(r[coolingCapIdx]) : undefined,
          permitStatus: String(r[permitStatusIdx] || 'valid').trim(),
          operationalStatus: String(r[opStatusIdx] || 'operating').trim(),
          levyInfo: String(r[levyInfoIdx] || '').trim(),
          expiryDate: String(r[expiryDateIdx] || '').trim(),
          permitNumber: permitNo,
          branches: branchesList
        });
      }
    }

    // 4. Parse return rows (14 columns schema)
    const returns: any[] = [];
    if (returnRows.length > 1) {
      const headers = (returnRows[0] || []).map((h: any) => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
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

      for (let i = 1; i < returnRows.length; i++) {
        const r = returnRows[i];
        if (!r || r.length === 0 || !r[cNameIdx]) continue;
        const cName = String(r[cNameIdx] || '').trim();
        const rawYear = Number(r[yearIdx]) || new Date().getFullYear();
        const rawPeriod = String(r[periodIdx] || 'January').trim();
        const rawQty = Number(r[qtyIdx]) || 0;
        const rawInv = Number(r[invoiceAmtIdx]) || 0;
        const rawPay = Number(r[payAmtIdx]) || 0;
        const rawTxn = String(r[txnRefIdx] || '').trim();
        const rawLessCf = Number(r[lessCfIdx]) || 0;
        const rawOutBal = r[outBalIdx] !== undefined ? Number(r[outBalIdx]) : (rawInv - rawPay - rawLessCf);
        const rawAging = Number(r[agingIdx]) || 0;

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
          comments: String(r[commentsIdx] || '').trim()
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
