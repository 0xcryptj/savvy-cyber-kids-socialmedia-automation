"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) router.replace("/"); else setError((await response.json().catch(() => null))?.error ?? "Sign in failed");
    setBusy(false);
  }
  return <main><section className="card settings-panel" style={{ maxWidth: 480, margin: "15vh auto" }}><p className="eyebrow">SAVVY CYBER KIDS</p><h2>Sign in to the workspace</h2><p>Your workspace credentials are protected behind this account.</p><form onSubmit={submit} className="settings-grid"><label className="settings-wide">Workspace password<input autoFocus type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} /></label><button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><a href="/forgot-password">Forgot password?</a>{error ? <p role="alert">{error}</p> : null}</form></section></main>;
}
