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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    password = String(body.password ?? "");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!EMAIL_RE.test(email)) {
    return json({ error: "Enter a valid email" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRole) {
    return json({ error: "Auth is not configured" }, 503);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!created.error) {
    return json({ ok: true });
  }
  if (!isAlreadyRegistered(created.error)) {
    return json({ error: created.error.message }, 400);
  }

  let page = 1;
  let existing: { id: string } | undefined;
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
  if (!existing) {
    return json({ error: created.error.message }, 400);
  }

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) {
    return json({ error: updated.error.message }, 400);
  }

  return json({ ok: true });
});
