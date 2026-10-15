"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, Plus } from "lucide-react";
import { invokeFunction } from "@/lib/functions";

type PlaidInstitution = {
  institution_id?: string;
  name?: string | null;
} | null;

type PlaidSuccessMetadata = {
  institution?: PlaidInstitution;
  accounts?: { id?: string | null }[] | null;
};

export function PlaidLinkButton({
  disabled,
  onLinked,
  plaidItemId,
  label,
}: {
  disabled?: boolean;
  onLinked: () => Promise<void> | void;
  /** When set, opens Plaid Link in update mode to add/change accounts on this bank. */
  plaidItemId?: string;
  label?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"link" | "update">("link");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSuccess = useCallback(
    async (publicToken: string | null, metadata: PlaidSuccessMetadata) => {
      setBusy(true);
      setError("");
      const accountIds = (metadata.accounts ?? [])
        .map((account) => account.id)
        .filter((id): id is string => Boolean(id));
      try {
        if (mode === "update" && activeItemId) {
          // Update mode keeps the same Item/access token; sync whatever accounts
          // are now shared on the Item (including newly selected ones).
          await invokeFunction("plaid", {
            action: "sync",
            plaid_item_id: activeItemId,
          });
        } else {
          if (!publicToken) {
            throw new Error("Plaid did not return a public token");
          }
          await invokeFunction("plaid", {
            action: "exchange",
            public_token: publicToken,
            institution: metadata.institution
              ? {
                  institution_id: metadata.institution.institution_id,
                  name: metadata.institution.name,
                }
              : null,
            account_ids: accountIds,
          });
        }
        await onLinked();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not link bank");
      } finally {
        setBusy(false);
        setToken(null);
        setActiveItemId(null);
        setMode("link");
      }
    },
    [activeItemId, mode, onLinked],
  );

  const onExit = useCallback(() => {
    setBusy(false);
    setToken(null);
    setActiveItemId(null);
    setMode("link");
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
      const payload = await invokeFunction<{
        link_token?: string;
        mode?: "link" | "update";
        plaid_item_id?: string;
      }>("plaid", {
        action: "link-token",
        ...(plaidItemId ? { plaid_item_id: plaidItemId } : {}),
      });
      if (!payload.link_token) {
        throw new Error("Could not start Plaid Link");
      }
      setMode(payload.mode === "update" ? "update" : "link");
      setActiveItemId(payload.plaid_item_id ?? plaidItemId ?? null);
      setToken(payload.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Plaid Link");
      setBusy(false);
    }
  }

  const isUpdate = Boolean(plaidItemId);
  const buttonLabel = label
    ? busy
      ? "Connecting…"
      : label
    : busy
      ? "Connecting…"
      : isUpdate
        ? "Add accounts"
        : "Link bank";

  return (
    <div className="shrink-0 space-y-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void start()}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-border px-4 text-sm active:bg-surface-2 disabled:opacity-50"
      >
        {isUpdate ? <Plus size={16} /> : <Landmark size={16} />}
        {buttonLabel}
      </button>
      {error ? <p className="text-xs text-expense">{error}</p> : null}
    </div>
  );
}
