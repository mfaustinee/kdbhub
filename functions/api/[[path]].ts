export async function onRequest(context: { request: Request; params: any }) {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders });
  }

  try {
    let bodyData: any = null;
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      try {
        bodyData = await context.request.json();
      } catch {
        bodyData = null;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "API endpoint processed", 
      path: context.params?.path || [],
      data: bodyData || [] 
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: true, message: "OK" }), {
      status: 200,
      headers: jsonHeaders,
    });
  }
}
