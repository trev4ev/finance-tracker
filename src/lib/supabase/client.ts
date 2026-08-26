import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

const CLIENT_KEY = "__ledgerSupabaseClient" as const;

type GlobalWithClient = typeof globalThis & {
  [CLIENT_KEY]?: SupabaseClient;
};

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const globalStore = globalThis as GlobalWithClient;
  if (!globalStore[CLIENT_KEY]) {
    globalStore[CLIENT_KEY] = createSupabaseClient(
      supabaseUrl(),
      supabasePublishableKey(),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      },
    );
  }
  return globalStore[CLIENT_KEY];
}
