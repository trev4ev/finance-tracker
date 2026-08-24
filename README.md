# Ledger

A personal finance tracker for income, expenses, transfers, cash flow, and
category budgets. Data can stay in the browser, or sync to Supabase when you
sign in. Linked banks import accounts, balances, and transactions through Plaid.

## Features

- Overview dashboard with income, expenses, net cash flow, net worth, category spending, and a 6-month cash-flow chart
- Transactions with search, type filters, and add/edit/delete
- Accounts (checking, savings, credit, cash, investment, loan) with live balances
- Monthly budgets per spending category
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

Without env vars the app still runs on `localStorage`.

## Supabase

1. Create a Supabase project (a dedicated Ledger project is recommended).
2. Copy the project URL and publishable/anon key into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Apply `supabase/migrations/20260824000000_ledger_finance.sql` in the SQL editor or with the Supabase CLI (`supabase db push`).
4. Enable Email auth. Sign up from `/login`.

Signed-in users store accounts, categories, transactions, budgets, and Plaid items in Postgres with RLS. Plaid access tokens are encrypted at rest. The first time you sign in, non-sample local data is uploaded if the cloud ledger is empty.

## Plaid

1. Create a [Plaid](https://dashboard.plaid.com) sandbox app.
2. Add to `.env.local`:
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`
   - `PLAID_ENV=sandbox`
   - `PLAID_TOKEN_ENCRYPTION_KEY` (optional; `openssl rand -hex 32`)
3. Sign in, open **Accounts**, and click **Link bank**.
4. In sandbox, use Plaid’s test credentials (for example user `user_good` / password `pass_good`).

Linking an item stores accounts and current balances, then pulls transactions with `/transactions/sync`. Use **Sync banks** for later updates.

## Stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres)
- Plaid Link

## Privacy

Local-only mode never leaves the browser. After you sign in, finance data is stored in your Supabase project. Bank credentials are entered only in Plaid Link; this app stores an encrypted Plaid access token, never the bank password.
