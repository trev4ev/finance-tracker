import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function getPlaidClient(): PlaidApi {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured");
  }
  const env = process.env.PLAID_ENV ?? "sandbox";
  const basePath = PlaidEnvironments[env] ?? PlaidEnvironments.sandbox;
  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    }),
  );
}
