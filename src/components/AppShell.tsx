"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";
import { useFinance } from "@/lib/store";

const links = [
  { href: "/", label: "Overview", shortLabel: "Home", icon: LayoutDashboard },
  {
    href: "/transactions",
    label: "Transactions",
    shortLabel: "Activity",
    icon: List,
  },
  { href: "/accounts", label: "Accounts", shortLabel: "Accounts", icon: Wallet },
  { href: "/budgets", label: "Budgets", shortLabel: "Budgets", icon: PiggyBank },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, cloudEnabled, error } = useFinance();

  if (pathname === "/login") {
    return (
      <div className="min-h-full min-h-dvh bg-background text-foreground">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-full min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-surface/80 px-4 py-6 lg:block">
        <div className="mb-8 px-2">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
            Ledger
          </p>
          <h1 className="mt-1 text-xl font-semibold">Finance</h1>
        </div>
        <nav className="space-y-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2/60 hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-4 bottom-6">
          {cloudEnabled ? (
            user ? (
              <p className="truncate px-2 text-xs text-muted">{user.email}</p>
            ) : (
              <Link
                href="/login"
                className="block rounded-xl px-3 py-2 text-sm text-accent hover:bg-surface-2"
              >
                Sign in for cloud sync
              </Link>
            )
          ) : (
            <p className="px-2 text-xs text-muted">Local-only mode</p>
          )}
        </div>
      </aside>

      <main className="pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:ml-60 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-28 sm:px-6 lg:py-6 lg:pb-0">
          {error ? (
            <p className="mb-4 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
              {error}
            </p>
          ) : null}
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 pt-2 pb-1.5 text-[10px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent"
                  />
                ) : null}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    active ? "bg-accent/15" : ""
                  }`}
                >
                  <Icon size={20} />
                </span>
                {link.shortLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
