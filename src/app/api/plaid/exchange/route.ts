import { NextResponse } from "next/server";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/plaid/crypto";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { requireUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    public_token?: string;
    institution?: { institution_id?: string; name?: string } | null;
  };
  if (!body.public_token) {
    return NextResponse.json({ error: "public_token is required" }, { status: 400 });
  }

  try {
    const client = getPlaidClient();
    const exchanged = await client.itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const accessToken = exchanged.data.access_token;
    const plaidItemId = exchanged.data.item_id;

    const { data: item, error } = await auth.supabase
      .from("plaid_items")
      .insert({
        user_id: auth.user.id,
        plaid_item_id: plaidItemId,
        access_token_encrypted: encryptSecret(accessToken),
        institution_id: body.institution?.institution_id ?? null,
        institution_name: body.institution?.name ?? null,
        status: "active",
      })
      .select("id, access_token_encrypted, transactions_cursor")
      .single();
    if (error) throw error;

    const sync = await syncPlaidItem(auth.supabase, auth.user.id, item);
    return NextResponse.json({ ok: true, ...sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
