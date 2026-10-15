"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BudgetsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/benefits");
  }, [router]);
  return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
}
