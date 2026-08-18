"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/Spinner";

export function QueueHandoffButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handoff() {
    setBusy(true); setError(null);
    const response = await fetch(`/api/posts/${id}/handoff`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "Handoff failed"); else router.refresh();
    setBusy(false);
  }
  return <span><button onClick={handoff} disabled={busy}>{busy ? <Spinner label="Posting…" /> : "Mark as posted"}</button>{error ? <small className="error-text">{error}</small> : null}</span>;
}
