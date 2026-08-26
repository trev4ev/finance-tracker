import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAlreadyRegistered(error: { message: string; code?: string }) {
  const message = error.message.toLowerCase();
  const code = error.code?.toLowerCase() ?? "";
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists")
  );
}

function isAllowedRedirect(redirectTo: string) {
  try {
    const url = new URL(redirectTo);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.pathname === "/auth/callback"
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let email = "";
  let redirectTo = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    redirectTo = String(body.redirectTo ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!EMAIL_RE.test(email)) {
    return json({ error: "Enter a valid email" }, 400);
  }
  if (!isAllowedRedirect(redirectTo)) {
    return json({ error: "Invalid redirect" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !serviceRole || !anon) {
    return json({ error: "Auth is not configured" }, 503);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error && !isAlreadyRegistered(created.error)) {
    return json({ error: created.error.message }, 400);
  }
  if (created.error) {
    let page = 1;
    let existing: { id: string; email_confirmed_at?: string | null } | undefined;
    for (;;) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) return json({ error: listed.error.message }, 400);
      existing = listed.data.users.find(
        (user) => user.email?.toLowerCase() === email,
      );
      if (existing || listed.data.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }
    if (existing && !existing.email_confirmed_at) {
      const updated = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      });
      if (updated.error) return json({ error: updated.error.message }, 400);
    }
  }

  const publicClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: otpError } = await publicClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (otpError) {
    return json({ error: otpError.message }, 400);
  }

  return json({ ok: true });
});
