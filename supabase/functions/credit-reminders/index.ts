import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsPreflight, json } from "../_shared/cors.ts";
import {
  formatCreditReminderEmail,
  isCreditReminderDay,
  lastDateOfMonth,
  testReminderEmail,
  todayISO,
  unusedExpiringCredits,
  type ReminderBenefit,
  type ReminderEmail,
  type ReminderRedemption,
} from "../_shared/reminders.ts";

type SettingsRow = {
  user_id: string;
  credit_reminders: boolean;
  last_credit_reminder_on: string | null;
};

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isCronRequest(req: Request): boolean {
  const secret = Deno.env.get("CREDIT_REMINDER_SECRET") ?? "";
  if (!secret) return false;
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function sendEmail(to: string, email: ReminderEmail) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY is not set" };
  }
  const from =
    Deno.env.get("RESEND_FROM") ?? "Ledger <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    return {
      ok: false as const,
      error:
        payload.error?.message ||
        payload.message ||
        `Resend failed (${response.status})`,
    };
  }
  return { ok: true as const };
}

function mapBenefit(row: Record<string, unknown>): ReminderBenefit {
  const frequency = String(row.frequency);
  return {
    id: String(row.id),
    name: String(row.name),
    frequency:
      frequency === "semiannual" || frequency === "annual"
        ? frequency
        : "monthly",
    expectedAmount:
      row.expected_amount == null ? null : Number(row.expected_amount),
    cycleStartMonth: Number(row.cycle_start_month ?? 1),
    active: row.active !== false,
  };
}

async function emailForUser(
  admin: SupabaseClient,
  userId: string,
  fallback?: string | null,
) {
  if (fallback) return fallback;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

async function reminderForUser(
  supabase: SupabaseClient,
  userId: string,
  options: { force: boolean; today: string; email?: string | null },
) {
  const settingsRes = await supabase
    .from("user_settings")
    .select("user_id, credit_reminders, last_credit_reminder_on")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsRes.error) {
    return { userId, skipped: settingsRes.error.message };
  }
  const settings = settingsRes.data as SettingsRow | null;
  if (!settings?.credit_reminders) {
    return { userId, skipped: "reminders off" };
  }

  const to =
    options.email ?? (await emailForUser(serviceClient(), userId));
  if (!to) return { userId, skipped: "no email" };

  const month = options.today.slice(0, 7);
  if (
    !options.force &&
    settings.last_credit_reminder_on &&
    settings.last_credit_reminder_on.slice(0, 7) === month
  ) {
    return { userId, skipped: "already sent this month" };
  }
  if (!options.force && !isCreditReminderDay(options.today)) {
    return { userId, skipped: "not reminder day" };
  }

  const [benefitsRes, redemptionsRes] = await Promise.all([
    supabase
      .from("card_benefits")
      .select(
        "id, name, frequency, expected_amount, cycle_start_month, active",
      )
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("benefit_redemptions")
      .select("benefit_id, period_start")
      .eq("user_id", userId),
  ]);
  if (benefitsRes.error) return { userId, skipped: benefitsRes.error.message };
  if (redemptionsRes.error) {
    return { userId, skipped: redemptionsRes.error.message };
  }

  const benefits = (benefitsRes.data ?? []).map((row) =>
    mapBenefit(row as Record<string, unknown>),
  );
  const redemptions: ReminderRedemption[] = (redemptionsRes.data ?? []).map(
    (row) => ({
      benefitId: String((row as { benefit_id: string }).benefit_id),
      periodStart: String((row as { period_start: string }).period_start),
    }),
  );
  const unused = unusedExpiringCredits(benefits, redemptions, options.today);
  const email =
    formatCreditReminderEmail(unused, lastDateOfMonth(month)) ??
    (options.force ? testReminderEmail() : null);
  if (!email) return { userId, skipped: "none expiring" };

  const sent = await sendEmail(to, email);
  if (!sent.ok) {
    return { userId, error: sent.error };
  }

  if (!options.force) {
    await supabase
      .from("user_settings")
      .update({ last_credit_reminder_on: options.today })
      .eq("user_id", userId);
  }

  return { userId, sent: true, credits: unused.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = body?.force === true;
  } catch {
    force = false;
  }

  const today = todayISO();
  const cron = isCronRequest(req);

  if (cron) {
    const admin = serviceClient();
    const listed = await admin
      .from("user_settings")
      .select("user_id")
      .eq("credit_reminders", true);
    if (listed.error) {
      return json(req, { error: listed.error.message }, 500);
    }
    const results = [];
    for (const row of listed.data ?? []) {
      results.push(
        await reminderForUser(admin, String(row.user_id), { force, today }),
      );
    }
    return json(req, { today, results });
  }

  const supabase = userClient(req);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json(req, { error: "Sign in required" }, 401);
  }

  const result = await reminderForUser(supabase, user.id, {
    force,
    today,
    email: user.email,
  });
  if ("error" in result && result.error) {
    return json(req, result, 502);
  }
  return json(req, { today, ...result });
});
