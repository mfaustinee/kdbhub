export async function onRequest(context: { request: Request; env: Record<string, string> }) {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders });
  }

  const env = context.env || {};
  let clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL : '');
  let privateKey = env.GOOGLE_PRIVATE_KEY || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_PRIVATE_KEY : '');
  let spreadsheetId = env.GOOGLE_SPREADSHEET_ID || (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_SPREADSHEET_ID : '');

  if (clientEmail) clientEmail = clientEmail.trim().replace(/^["']|["']$/g, '');
  if (privateKey) privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
  if (spreadsheetId) spreadsheetId = spreadsheetId.trim().replace(/^["']|["']$/g, '');

  const isConfigured = Boolean(
    clientEmail && 
    privateKey && 
    privateKey.includes("-----BEGIN PRIVATE KEY-----")
  );

  // Mask client email for security: e.g. "kdb-****@project.iam.gserviceaccount.com"
  let maskedEmail = '';
  if (clientEmail) {
    const atIndex = clientEmail.indexOf('@');
    if (atIndex > 4) {
      maskedEmail = `${clientEmail.slice(0, 4)}••••${clientEmail.slice(atIndex)}`;
    } else {
      maskedEmail = clientEmail;
    }
  }

  return new Response(
    JSON.stringify({
      configured: isConfigured,
      clientEmail: maskedEmail,
      spreadsheetId: spreadsheetId,
      managedBy: "Cloudflare Environment Variables & Secrets",
      hasPrivateKey: Boolean(privateKey),
      platform: "cloudflare-pages"
    }),
    { headers: jsonHeaders }
  );
}
