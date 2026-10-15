import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsPreflight, json } from "../_shared/cors.ts";
import { decryptSecret, encryptSecret } from "../_shared/crypto.ts";
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: unknown }).id ?? "");
      }
      return "";
    })
    .filter(Boolean);
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
      const plaidItemId =
        typeof body.plaid_item_id === "string" ? body.plaid_item_id : "";

      if (plaidItemId) {
        const { data: item, error } = await supabase
          .from("plaid_items")
          .select("id, access_token_encrypted")
          .eq("id", plaidItemId)
          .eq("user_id", user.id)
          .neq("status", "revoked")
          .maybeSingle();
        if (error) throw error;
        if (!item) {
          return json(req, { error: "Linked bank not found" }, 404);
        }

        const accessToken = await decryptSecret(item.access_token_encrypted);
        // Update mode + account select: add a new card/account to the same Item
        // (required for Chase) without creating a duplicate Item.
        const created = await plaidRequest<{ link_token: string }>(
          "/link/token/create",
          {
            user: { client_user_id: user.id },
            client_name: "Ledger",
            language: "en",
            country_codes: ["US"],
            access_token: accessToken,
            update: { account_selection_enabled: true },
          },
        );
        return json(req, {
          link_token: created.link_token,
          mode: "update",
          plaid_item_id: item.id,
        });
      }

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
      return json(req, { link_token: created.link_token, mode: "link" });
    }

    if (action === "sync") {
      const plaidItemId =
        typeof body.plaid_item_id === "string" ? body.plaid_item_id : "";
      if (plaidItemId) {
        const { data: item, error } = await supabase
          .from("plaid_items")
          .select(
            "id, access_token_encrypted, transactions_cursor, institution_name",
          )
          .eq("id", plaidItemId)
          .eq("user_id", user.id)
          .neq("status", "revoked")
          .maybeSingle();
        if (error) throw error;
        if (!item) {
          return json(req, { error: "Linked bank not found" }, 404);
        }
        const selectedAccountIds = asStringArray(body.account_ids);
        const result = await syncPlaidItem(supabase, user.id, item, {
          selectedAccountIds:
            selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        });
        return json(req, { ok: true, ...result, itemCount: 1 });
      }

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
      const selectedAccountIds = asStringArray(body.account_ids);
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
        .select(
          "id, access_token_encrypted, transactions_cursor, institution_name",
        )
        .single();
      if (error) throw error;

      const sync = await syncPlaidItem(supabase, user.id, item, {
        selectedAccountIds:
          selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
      });

      // Re-linking the same bank creates a new Plaid Item. Revoke prior Items for
      // that institution so later syncs don't reintroduce rematched accounts.
      const institutionId = institution?.institution_id ?? null;
      if (institutionId) {
        const { data: priorItems, error: priorError } = await supabase
          .from("plaid_items")
          .select("id, access_token_encrypted")
          .eq("user_id", user.id)
          .eq("institution_id", institutionId)
          .neq("id", item.id)
          .neq("status", "revoked");
        if (priorError) throw priorError;

        for (const prior of priorItems ?? []) {
          try {
            const priorToken = await decryptSecret(
              prior.access_token_encrypted,
            );
            await plaidRequest("/item/remove", { access_token: priorToken });
          } catch {
            // Item may already be removed on Plaid's side; still mark revoked locally.
          }
          await supabase
            .from("plaid_items")
            .update({
              status: "revoked",
              error_message: "Replaced by a newer link for this institution",
            })
            .eq("id", prior.id)
            .eq("user_id", user.id);
        }
      }

      return json(req, { ok: true, ...sync });
    }

    if (action === "remove") {
      const plaidItemId =
        typeof body.plaid_item_id === "string" ? body.plaid_item_id : "";
      if (!plaidItemId) {
        return json(req, { error: "plaid_item_id is required" }, 400);
      }

      const { data: item, error } = await supabase
        .from("plaid_items")
        .select("id, access_token_encrypted")
        .eq("id", plaidItemId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!item) {
        return json(req, { error: "Linked bank not found" }, 404);
      }

      // Removes the Item on Plaid so it no longer counts toward trial/item limits.
      try {
        const accessToken = await decryptSecret(item.access_token_encrypted);
        await plaidRequest("/item/remove", { access_token: accessToken });
      } catch {
        // Item may already be gone on Plaid; still clean up locally.
      }

      // Keep ledger history: convert linked accounts to manual before delete
      // (accounts.plaid_item_id cascades on plaid_items delete).
      const { error: unlinkError } = await supabase
        .from("accounts")
        .update({
          plaid_item_id: null,
          plaid_account_id: null,
          source: "manual",
          last_synced_at: null,
        })
        .eq("user_id", user.id)
        .eq("plaid_item_id", item.id);
      if (unlinkError) throw unlinkError;

      const { error: deleteError } = await supabase
        .from("plaid_items")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;

      return json(req, { ok: true });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid error";
    return json(req, { error: message }, 500);
  }
});
