"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/Spinner";

export function FailedRetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function retry() {
    setBusy(true); setError(null);
    const response = await fetch(`/api/posts/${id}/regenerate`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Retry failed"); else router.refresh();
    setBusy(false);
  }
  return <span><button onClick={retry} disabled={busy}>{busy ? <Spinner label="Retrying…" /> : "Retry generation"}</button>{error ? <small className="error-text">{error}</small> : null}</span>;
}
