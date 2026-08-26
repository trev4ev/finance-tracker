import { createClient } from "@/lib/supabase/client";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export async function invokeFunction<T>(
  name: string,
  body?: unknown,
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? supabasePublishableKey();
  const response = await fetch(`${supabaseUrl()}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabasePublishableKey(),
      "Content-Type": "application/json",
    },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || `Function ${name} failed`);
  }
  return payload;
}
