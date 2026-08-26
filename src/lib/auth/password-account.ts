import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 20) return null;
  }
}

async function upsertConfirmedPasswordUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!created.error) return { error: null };
  if (!isAlreadyRegistered(created.error)) {
    return { error: created.error.message };
  }

  const existing = await findUserByEmail(admin, email);
  if (!existing) return { error: created.error.message };

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) return { error: updated.error.message };
  return { error: null };
}

export async function upsertPasswordAccount(options: {
  email: string;
  password: string;
}): Promise<{ error: string | null }> {
  const email = options.email.trim().toLowerCase();
  const password = options.password;
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email" };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const admin = createAdminClient();
  if (admin) {
    return upsertConfirmedPasswordUser(admin, email, password);
  }

  const response = await fetch(
    `${supabaseUrl()}/functions/v1/password-account`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabasePublishableKey()}`,
        apikey: supabasePublishableKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    return { error: payload.error ?? "Could not create account" };
  }
  return { error: null };
}
