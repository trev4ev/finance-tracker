import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid/client";
import { requireUser } from "@/lib/supabase/auth";

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured" },
      { status: 503 },
    );
  }

  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: auth.user.id },
      client_name: "Ledger",
      language: "en",
      country_codes: [CountryCode.Us],
      products: [Products.Transactions],
      transactions: { days_requested: 90 },
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
