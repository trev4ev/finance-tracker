"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace("/login");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const supabase = createClient();

    async function finish() {
      try {
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        router.replace("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete sign-in");
      }
    }

    void finish();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">Signing in…</h1>
      {error ? <p className="mt-2 text-sm text-expense">{error}</p> : (
        <p className="mt-2 text-sm text-muted">Finishing authentication.</p>
      )}
    </main>
  );
}
