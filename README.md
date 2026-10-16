# Ledger

A personal finance tracker for income, expenses, transfers, cash flow, and
credit card benefits. Data can stay in the browser, or sync to Supabase when you
sign in. Linked banks import accounts, balances, and transactions through Plaid.

The UI is a static Next.js export (GitHub Pages). Auth signup and Plaid run as
Supabase Edge Functions.

## Features

- Overview dashboard with income, expenses, net cash flow, net worth, category spending, and a 6-month cash-flow chart
- Transactions with search, type filters, and add/edit/delete
- Merchant recategorization rules (“apply to similar” and future Plaid matches)
- Review inbox for posted bank transactions until you mark them reviewed (refresh does not clear the queue)
- Accounts (checking, savings, credit, cash, investment, loan) with live balances
- Credit card benefits (monthly, semiannual, and annual credits) with optional transaction links
- Suggested benefit matches from merchant names (confirm to link; viewing never auto-links)
- Optional unused-credit email a week before month-end (Resend free tier)
- CSV import/export
- Optional **Supabase** persistence for transactions, accounts, and balance snapshots
- Optional **Plaid Link** to connect banks and sync transactions/balances
- Sample data on first visit when you are not signed in

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without env vars the app still runs on `localStorage`. `next build` writes a
static site to `out/`.

## Supabase

1. Create a Supabase project (a dedicated Ledger project is recommended).
2. Copy the project URL and publishable/anon key into `.env.local` (and GitHub Actions secrets for Pages):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Apply migrations in `supabase/migrations/` (`supabase db push` or the SQL editor).
4. Deploy Edge Functions (JWT verification off; each function checks auth itself):

```bash
supabase functions deploy password-account --no-verify-jwt
supabase functions deploy send-auth-code --no-verify-jwt
supabase functions deploy plaid --no-verify-jwt
supabase functions deploy credit-reminders --no-verify-jwt
```

### Unused-credit emails

A week before month-end (the day 7 days before the last calendar day), an Edge Function emails unused credits whose period ends that month. Monthly DoorDash/Uber/Lyft credits are included every month; 6-month and yearly credits only when that period is ending. Mail goes to the signed-in Auth email.

1. Apply `supabase/migrations/20261014020000_user_settings.sql`.
2. Deploy `credit-reminders` (JWT verification off; the function checks a user session or `CREDIT_REMINDER_SECRET`).
3. Create a free [Resend](https://resend.com) API key and set secrets:

```bash
supabase secrets set CREDIT_REMINDER_SECRET=$(openssl rand -hex 32)
supabase secrets set RESEND_API_KEY=re_...
# After you verify a domain, override the From address (defaults to onboarding@resend.dev, which can only mail the Resend account email):
# supabase secrets set RESEND_FROM='Ledger <reminders@yourdomain.com>'
```

4. Sign in, open **Settings**, turn on **Email me unused credits**.
5. For the monthly send without opening the app, add a GitHub Actions secret `CREDIT_REMINDER_SECRET` (same value as the Supabase secret). The workflow `credit-reminders.yml` POSTs the function daily; opening Ledger while signed in is a backup trigger. The function sends at most once per user per month.

6. Enable Email auth. Sign in from `/login` with email and password.

Signed-in users store accounts, categories, transactions, card benefits, and Plaid items in Postgres with RLS. Plaid access tokens are encrypted at rest. The first time you sign in, non-sample local data is uploaded if the cloud ledger is empty.

## Plaid

Set these on the **Supabase project** (not in the static frontend):

```bash
supabase secrets set PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
supabase secrets set PLAID_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

Then sign in, open **Accounts**, and click **Link bank**. In sandbox, use Plaid’s test credentials (for example user `user_good` / password `pass_good`).

Linking stores accounts and balances, then pulls transactions with `/transactions/sync`. Use **Sync banks** for later updates.

## GitHub Pages

1. In the repo, add Actions secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Settings → Pages → Build and deployment → **GitHub Actions**.
3. Push to `main`. The workflow publishes `out/` with `NEXT_PUBLIC_BASE_PATH=/finance-tracker` (this repo’s project site).

In the [Plaid Dashboard](https://dashboard.plaid.com) allowed redirect URIs / allowed origins, include `https://<user>.github.io`. In Supabase Auth URL config, add `https://<user>.github.io/finance-tracker/**` (and `/auth/callback/`).

For a custom domain at the site root, drop `NEXT_PUBLIC_BASE_PATH` from the workflow.

## Stack

- Next.js (static export) and React
- TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Edge Functions)
- Plaid Link

## Privacy

Local-only mode never leaves the browser. After you sign in, finance data is stored in your Supabase project. Bank credentials are entered only in Plaid Link; this app stores an encrypted Plaid access token, never the bank password.
