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

  return new Response(
    JSON.stringify({ status: "ok", mode: "production", platform: "cloudflare-pages" }),
    { headers: jsonHeaders }
  );
}
