"use client";

import { useEffect, useState } from "react";

type Provider = { id: string; label: string; hint: string };
export function SettingsClient({ rows, links }: { rows: string[][]; links: { label: string; href: string }[] }) {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { fetch("/api/settings").then(r => r.json()).then(data => { setProvider(data.provider); setModel(data.model); setBaseUrl(data.baseUrl || ""); setProviders(data.providers || []); setConfigured(data.configured); }); }, []);
  async function save() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, baseUrl, apiKey }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not save settings"); else { setConfigured(data.configured); setApiKey(""); setMessage("AI settings saved securely. New posts will use this model."); }
    setSaving(false);
  }
  return <>
    <div className="page-intro"><div><p className="eyebrow">WORKSPACE / CONFIGURATION</p><h2>Connector status</h2><p>Choose a provider and enter its key locally. Keys are written server-side with restricted file permissions and are never returned to the browser.</p></div></div>
    <section className="card settings-panel"><div className="settings-heading"><div><p className="eyebrow">AI WRITING ENGINE</p><h3>Model preferences</h3></div><span className={configured ? "status" : "count"}>{configured ? "KEY READY" : "KEY NEEDED"}</span></div><div className="settings-grid"><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value)}>{providers.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Model<input value={model} onChange={e=>setModel(e.target.value)} placeholder="gpt-4o-mini" /><small>{providers.find(item=>item.id===provider)?.hint || "Use the exact model name from your provider."}</small></label><label className="settings-wide">API key<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured ? "Leave blank to keep the saved key" : "Paste provider key"} /><small>Stored locally only. It is never displayed, logged, or sent back to this page.</small></label>{provider === "openai-compatible" ? <label className="settings-wide">Endpoint URL<input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /><small>HTTPS is required for remote endpoints. HTTP is accepted only for localhost/Ollama.</small></label> : null}</div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save model settings"}</button>{message ? <span className="copy-confirm">{message}</span> : null}</div></section>
    <div className="queue-list">{rows.map(([name,status,note])=><div className="card queue-row" key={name}><div><h3>{name}</h3><p>{note}</p></div><span className={status === "Ready" || status === "Safe" || status === "Configured" || status === "Connected" ? "status" : "count"}>{status}</span></div>)}</div>
    <div className="card side-card section"><p className="eyebrow">REFERENCE LINKS</p><div className="quick-links">{links.map(link=><a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div></div>
  </>;
}
