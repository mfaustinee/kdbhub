import { getGoogleAccessToken, appendToGoogleSheet } from "../utils/googleSheets";

const formatSellingPriceForSheets = (sellingPriceInput: any): string => {
  if (sellingPriceInput === undefined || sellingPriceInput === null) return "";
  
  let priceList: string[] = [];

  // Helper to extract clean numeric price value from a string (e.g. "Raw Milk: 53", "53", "Raw Milk: Kshs 53")
  const cleanSinglePrice = (val: any): string => {
    if (val === undefined || val === null) return "";
    let str = String(val).trim();
    if (!str) return "";
    
    // If string contains "Product: Price", extract the portion after the colon
    if (str.includes(':')) {
      str = str.substring(str.lastIndexOf(':') + 1).trim();
    }
    // Strip common currency prefixes and suffixes
    str = str.replace(/^(?:kshs?\.?|kes\.?)\s*/i, '').replace(/\s*(?:\/=|per\s+.*)$/i, '').trim();
    return str;
  };

  if (typeof sellingPriceInput === 'number') {
    return String(sellingPriceInput);
  }

  if (Array.isArray(sellingPriceInput)) {
    priceList = sellingPriceInput
      .map(cleanSinglePrice)
      .filter(p => p !== '');
    return priceList.join(' | ');
  }

  if (typeof sellingPriceInput === 'object') {
    priceList = Object.values(sellingPriceInput)
      .map(cleanSinglePrice)
      .filter(p => p !== '');
    return priceList.join(' | ');
  }

  const sellingPriceStr = String(sellingPriceInput).trim();
  if (!sellingPriceStr) return "";

  // Check if string is a JSON object or array
  if ((sellingPriceStr.startsWith('{') && sellingPriceStr.endsWith('}')) || 
      (sellingPriceStr.startsWith('[') && sellingPriceStr.endsWith(']'))) {
    try {
      const parsed = JSON.parse(sellingPriceStr);
      if (Array.isArray(parsed)) {
        priceList = parsed.map(cleanSinglePrice).filter(p => p !== '');
        if (priceList.length > 0) return priceList.join(' | ');
      } else if (typeof parsed === 'object' && parsed !== null) {
        priceList = Object.values(parsed).map(cleanSinglePrice).filter(p => p !== '');
        if (priceList.length > 0) return priceList.join(' | ');
      }
    } catch {
      // Not JSON, continue with string splitting
    }
  }

  // Handle strings like "Raw Milk: 53 | Mala: 60" or "Raw Milk: 53, Mala: 60"
  const delimiter = sellingPriceStr.includes('|') ? '|' : (sellingPriceStr.includes(';') ? ';' : ',');
  const parts = sellingPriceStr.split(delimiter);

  parts.forEach(part => {
    const cleaned = cleanSinglePrice(part);
    if (cleaned) {
      priceList.push(cleaned);
    }
  });

  if (priceList.length > 0) {
    return priceList.join(' | ');
  }

  return cleanSinglePrice(sellingPriceStr);
};

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

  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const body: any = await context.request.json();
    const data = body.data;

    if (!data) {
      return new Response(JSON.stringify({ error: "Missing 'data' object" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const env = context.env || {};
    let clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL : '');
    let privateKey = env.GOOGLE_PRIVATE_KEY || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_PRIVATE_KEY : '');
    let spreadsheetId = env.GOOGLE_SPREADSHEET_ID || body.spreadsheetId || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SPREADSHEET_ID : '');

    if (clientEmail) clientEmail = clientEmail.trim().replace(/^["']|["']$/g, '');
    if (privateKey) privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    if (spreadsheetId) spreadsheetId = spreadsheetId.trim().replace(/^["']|["']$/g, '');

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: "Spreadsheet ID missing. Please set GOOGLE_SPREADSHEET_ID environment variable in Cloudflare dashboard." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (!clientEmail || !privateKey) {
      return new Response(
        JSON.stringify({ error: "Service Account credentials (EMAIL/PRIVATE_KEY) are missing in Cloudflare environment variables." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Map rows according to category
    const allRows: { sheet: string; rows: any[][] }[] = [];

    if (
      data.category === "Mini Dairy" ||
      data.category === "Cottage Industry" ||
      data.category === "Milk Bar" ||
      data.category === "Dispenser"
    ) {
      const sheet =
        data.category === "Mini Dairy" || data.category === "Cottage Industry"
          ? "MD & CI - Distribution"
          : "Dispensers & Milk Bars";

      const isMiniOrCottage =
        data.category === "Mini Dairy" || data.category === "Cottage Industry";

      let distNameFormatted = "";
      let distContactsFormatted = "";
      let distVolPerDayFormatted = "";
      let distPermitNoFormatted = "";
      let distAreaOfSaleFormatted = "";
      let distOutletsFormatted = "";
      let distNatureOfProduceFormatted = "";
      let distPriceFormatted = "";

      if (isMiniOrCottage) {
        const distributors =
          Array.isArray(data.distributors) && data.distributors.length > 0
            ? data.distributors
            : [
                {
                  name: data.distName,
                  contacts: data.distContacts,
                  volPerDay: data.distVolPerDay,
                  permitNo: data.distPermitNo,
                  areaOfSale: data.distAreaOfSale,
                  outlets: data.distOutlets || [],
                  natureOfProduce: data.distNatureOfProduce || [],
                  prices: {
                    [data.distNatureOfProduce?.[0] || "Produce"]: data.distPrice,
                  },
                },
              ];

        distNameFormatted = distributors.map((d: any) => d.name || "").join(" | ");
        distContactsFormatted = distributors.map((d: any) => d.contacts || "").join(" | ");
        distVolPerDayFormatted = distributors.map((d: any) => d.volPerDay || "").join(" | ");
        distPermitNoFormatted = distributors.map((d: any) => d.permitNo || "").join(" | ");
        distAreaOfSaleFormatted = distributors.map((d: any) => d.areaOfSale || "").join(" | ");

        distOutletsFormatted = distributors
          .map((d: any, dIdx: number) => {
            const outletsStr = Array.isArray(d.outlets)
              ? d.outlets
                  .map(
                    (o: any) =>
                      `${o.location} (Vol: ${o.volPerDay}, Permit: ${o.permitStatus}, Levy: ${o.levyInfo})`
                  )
                  .join(", ")
              : "";
            return `Distributor #${dIdx + 1}: ${outletsStr}`;
          })
          .join(" | ");

        distNatureOfProduceFormatted = distributors
          .map((d: any, dIdx: number) => {
            const prodStr = Array.isArray(d.natureOfProduce)
              ? d.natureOfProduce.join(", ")
              : "";
            return `Distributor #${dIdx + 1}: ${prodStr}`;
          })
          .join(" | ");

        distPriceFormatted = distributors
          .map((d: any, dIdx: number) => {
            const priceStr =
              d.prices && Object.keys(d.prices).length > 0
                ? formatSellingPriceForSheets(d.prices)
                : formatSellingPriceForSheets(d.distPrice || "");
            return `Distributor #${dIdx + 1}: ${priceStr}`;
          })
          .join(" | ");
      }

      const rows = (data.sales || []).map((sale: any) => [
        data.dboName,
        data.location,
        data.contacts,
        data.permitNo,
        data.expiryDate,
        sale.avgVolPerDay || "",
        sale.buyingPrice || "",
        formatSellingPriceForSheets(sale.sellingPrice),
        data.traceability,
        `${sale.month} ${sale.year}`,
        sale.qtyDeclared,
        sale.verifiedQty,
        sale.underDeclared,
        data.date,
        data.startTime,
        data.endTime,
        Array.isArray(data.natureOfProduce)
          ? data.natureOfProduce.join(", ")
          : (data.natureOfProduce || ""),
        distNameFormatted,
        distContactsFormatted,
        distVolPerDayFormatted,
        distPermitNoFormatted,
        distAreaOfSaleFormatted,
        distOutletsFormatted,
        distNatureOfProduceFormatted,
        distPriceFormatted,
      ]);
      allRows.push({ sheet, rows });
    } else if (
      data.category === "CP<5,000 L/D" ||
      data.category === "CP>5,000 L/D" ||
      data.category === "Processor"
    ) {
      const sheet = "Cooling Plants";

      const intakeRows = (data.intakes || []).map((intake: any) => [
        data.dboName,
        data.location,
        data.contacts,
        data.permitNo,
        data.expiryDate,
        intake.avgVolPerDay || "",
        intake.farmerPrice || "",
        intake.processorPrice || "",
        data.traceability,
        `${intake.month} ${intake.year}`,
        intake.quantity,
        "TOTAL INTAKE",
        "",
        "",
        data.date,
        data.startTime,
        data.endTime,
        Array.isArray(data.natureOfProduce)
          ? data.natureOfProduce.join(", ")
          : (data.natureOfProduce || ""),
      ]);
      allRows.push({ sheet, rows: intakeRows });

      const salesRows = (data.sales || [])
        .filter((s: any) => s.qtyDeclared || s.verifiedQty)
        .map((sale: any) => [
          data.dboName,
          data.location,
          data.contacts,
          data.permitNo,
          data.expiryDate,
          sale.avgVolPerDay || "",
          sale.buyingPrice || "",
          formatSellingPriceForSheets(sale.sellingPrice),
          data.traceability,
          `${sale.month} ${sale.year}`,
          sale.qtyDeclared,
          "LOCAL SALES",
          sale.verifiedQty,
          sale.underDeclared,
          data.date,
          data.startTime,
          data.endTime,
          Array.isArray(data.natureOfProduce)
            ? data.natureOfProduce.join(", ")
            : (data.natureOfProduce || ""),
        ]);
      if (salesRows.length > 0) {
        allRows.push({ sheet, rows: salesRows });
      }
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    for (const item of allRows) {
      if (item.rows.length > 0) {
        await appendToGoogleSheet(accessToken, spreadsheetId, item.sheet, item.rows);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: jsonHeaders,
    });
  } catch (error: any) {
    console.error("[Submit Cloudflare Function Error]:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to submit data to Google Sheets" }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
