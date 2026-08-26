import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

export function supabaseSecretKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function createAdminClient(): SupabaseClient | null {
  const key = supabaseSecretKey();
  if (!key) return null;
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
