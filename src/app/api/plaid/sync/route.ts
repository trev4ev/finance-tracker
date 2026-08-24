import { NextResponse } from "next/server";
import { isPlaidConfigured } from "@/lib/plaid/client";
import { syncAllPlaidItems } from "@/lib/plaid/sync";
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
    const result = await syncAllPlaidItems(auth.supabase, auth.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plaid sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
