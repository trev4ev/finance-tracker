# Ledger

A local-first personal finance tracker. Record income, expenses, and transfers across accounts, watch monthly cash flow, and keep category budgets — all in the browser.

## Features

- **Overview dashboard** with income, expenses, net cash flow, net worth, category spending, and a 6-month cash-flow chart
- **Transactions** with search, type filters, and add/edit/delete
- **Accounts** (checking, savings, credit, cash, investment) with live balances
- **Monthly budgets** per spending category
- **CSV import/export**
- Sample data on first visit so the app is usable immediately
- Data stored in `localStorage` (nothing leaves your machine)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

## Stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS

## Privacy

This app is designed for personal use. Transaction data is saved only in the browser that is running it. Export a CSV from Settings before switching devices or clearing site data.
