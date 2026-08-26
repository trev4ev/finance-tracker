"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark } from "lucide-react";
import { invokeFunction } from "@/lib/functions";

export function PlaidLinkButton({
  disabled,
  onLinked,
}: {
  disabled?: boolean;
  onLinked: () => Promise<void> | void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSuccess = useCallback(
    async (
      publicToken: string | null,
      metadata: { institution?: { name?: string | null } | null },
    ) => {
      if (!publicToken) {
        setError("Plaid did not return a public token");
        setBusy(false);
        setToken(null);
        return;
      }
      setBusy(true);
      setError("");
      try {
        await invokeFunction("plaid", {
          action: "exchange",
          public_token: publicToken,
          institution: metadata.institution,
        });
        await onLinked();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not link bank");
      } finally {
        setBusy(false);
        setToken(null);
      }
    },
    [onLinked],
  );

  const onExit = useCallback(() => {
    setBusy(false);
    setToken(null);
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (token && ready) open();
  }, [open, ready, token]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const payload = await invokeFunction<{ link_token?: string }>("plaid", {
        action: "link-token",
      });
      if (!payload.link_token) {
        throw new Error("Could not start Plaid Link");
      }
      setToken(payload.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Plaid Link");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void start()}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
      >
        <Landmark size={16} />
        {busy ? "Connecting…" : "Link bank"}
      </button>
      {error ? <p className="text-xs text-expense">{error}</p> : null}
    </div>
  );
}
