import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsPreflight, json } from "../_shared/cors.ts";
import { encryptSecret } from "../_shared/crypto.ts";
import { isPlaidConfigured, plaidRequest } from "../_shared/plaid-api.ts";
import { syncAllPlaidItems, syncPlaidItem } from "../_shared/plaid-sync.ts";

function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);

  if (!isPlaidConfigured()) {
    return json(req, { error: "Plaid is not configured" }, 503);
  }

  const supabase = userClient(req);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json(req, { error: "Sign in required" }, 401);
  }

  let action = new URL(req.url).searchParams.get("action") ?? "";
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      const parsed = (await req.json()) as Record<string, unknown>;
      body = parsed ?? {};
      if (!action && typeof parsed?.action === "string") action = parsed.action;
    } catch {
      body = {};
    }
  }
  if (!action && req.method === "GET") action = "status";

  try {
    if (action === "status") {
      return json(req, {
        configured: true,
        env: Deno.env.get("PLAID_ENV") ?? "sandbox",
      });
    }

    if (action === "link-token") {
      const created = await plaidRequest<{ link_token: string }>(
        "/link/token/create",
        {
          user: { client_user_id: user.id },
          client_name: "Ledger",
          language: "en",
          country_codes: ["US"],
          products: ["transactions"],
          transactions: { days_requested: 90 },
        },
      );
      return json(req, { link_token: created.link_token });
    }

    if (action === "sync") {
      const result = await syncAllPlaidItems(supabase, user.id);
      return json(req, result);
    }

    if (action === "exchange") {
      const publicToken = String(body.public_token ?? "");
      if (!publicToken) {
        return json(req, { error: "public_token is required" }, 400);
      }
      const institution = body.institution as
        | { institution_id?: string; name?: string }
        | null
        | undefined;
      const exchanged = await plaidRequest<{
        access_token: string;
        item_id: string;
      }>("/item/public_token/exchange", { public_token: publicToken });

      const { data: item, error } = await supabase
        .from("plaid_items")
        .insert({
          user_id: user.id,
          plaid_item_id: exchanged.item_id,
          access_token_encrypted: await encryptSecret(exchanged.access_token),
          institution_id: institution?.institution_id ?? null,
          institution_name: institution?.name ?? null,
          status: "active",
        })
        .select("id, access_token_encrypted, transactions_cursor")
        .single();
      if (error) throw error;

      const sync = await syncPlaidItem(supabase, user.id, item);
      return json(req, { ok: true, ...sync });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid error";
    return json(req, { error: message }, 500);
  }
});
