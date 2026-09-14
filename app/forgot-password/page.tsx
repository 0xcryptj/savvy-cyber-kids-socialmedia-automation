"use client";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("info@savvycyberkids.org");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setError(body?.error ?? "Password reset email could not be sent.");
      setBusy(false);
      return;
    }
    setSent(true);
    setBusy(false);
  }

  return <main><section className="card settings-panel" style={{ maxWidth: 480, margin: "15vh auto" }}><p className="eyebrow">SAVVY CYBER KIDS</p><h2>Reset your password</h2>{sent ? <p>If the address is eligible, a reset email has been sent to the workspace recovery inbox.</p> : <form onSubmit={submit} className="settings-grid"><label className="settings-wide">Account email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button disabled={busy}>{busy ? "Sending..." : "Send reset email"}</button>{error ? <p role="alert">{error}</p> : null}</form>}</section></main>;
}
