const HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

export function isPlaidConfigured(): boolean {
  return Boolean(Deno.env.get("PLAID_CLIENT_ID") && Deno.env.get("PLAID_SECRET"));
}

export async function plaidRequest<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const env = Deno.env.get("PLAID_ENV") ?? "sandbox";
  const host = HOSTS[env] ?? HOSTS.sandbox;
  const response = await fetch(`${host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": Deno.env.get("PLAID_CLIENT_ID") ?? "",
      "PLAID-SECRET": Deno.env.get("PLAID_SECRET") ?? "",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error_message?: string;
    error_code?: string;
  } & T;
  if (!response.ok) {
    throw new Error(
      payload.error_message || payload.error_code || "Plaid error",
    );
  }
  return payload;
}
