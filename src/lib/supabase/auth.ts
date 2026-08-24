import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";

export async function requireUser(): Promise<
  | { error: NextResponse; supabase: null; user: null }
  | { error: null; supabase: Awaited<ReturnType<typeof createClient>>; user: User }
> {
  if (!isSupabaseConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      ),
      supabase: null,
      user: null,
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      error: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
      supabase: null,
      user: null,
    };
  }
  return { error: null, supabase, user: data.user };
}
