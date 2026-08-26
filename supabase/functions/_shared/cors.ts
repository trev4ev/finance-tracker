export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin && origin !== "null" ? origin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

export function corsPreflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
