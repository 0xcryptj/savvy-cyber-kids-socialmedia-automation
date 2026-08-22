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
  const [postizApiKey, setPostizApiKey] = useState("");
  const [postizApiUrl, setPostizApiUrl] = useState("https://api.postiz.com/public/v1");
  const [postiz, setPostiz] = useState<{ configured: boolean; apiUrl: string; lastTest?: { status: "success" | "failed"; testedAt: string; reason?: string; channelCount?: number } }>({ configured: false, apiUrl: "https://api.postiz.com/public/v1" });
  const [pingBusy, setPingBusy] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  useEffect(() => { fetch("/api/settings").then(r => r.json()).then(data => { setProvider(data.provider); setModel(data.model); setBaseUrl(data.baseUrl || ""); setProviders(data.providers || []); setConfigured(data.configured); setPostiz(data.postiz || { configured: false, apiUrl: "https://api.postiz.com/public/v1" }); setPostizApiUrl(data.postiz?.apiUrl || "https://api.postiz.com/public/v1"); }); }, []);
  async function save() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, baseUrl, apiKey, postizApiKey: postizApiKey || undefined, postizApiUrl }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not save settings"); else { setConfigured(data.configured); setPostiz(data.postiz); setPostizApiKey(""); setMessage("Settings saved securely."); }
    setSaving(false);
  }
  async function testPing() {
    setPingBusy(true); setPingMessage(null);
    const response = await fetch("/api/settings", { method: "POST" });
    const data = await response.json();
    if (!response.ok) setPingMessage(data.error || "Connectivity test failed"); else { setPostiz(current => ({ ...current, lastTest: { status: "success", testedAt: data.testedAt, channelCount: data.channelCount } })); setPingMessage(`Connected — ${data.channelCount} channel${data.channelCount === 1 ? "" : "s"} available`); }
    setPingBusy(false);
  }
  const postizStatus = !postiz.configured ? "Not configured" : postiz.lastTest?.status === "success" ? `Connected — ${postiz.lastTest.channelCount ?? 0} channel${postiz.lastTest.channelCount === 1 ? "" : "s"}` : postiz.lastTest?.status === "failed" ? `Last test failed — ${postiz.lastTest.reason || "unknown reason"}` : "Key saved, connection not tested";
  return <>
    <div className="page-intro"><div><p className="eyebrow">WORKSPACE / SETTINGS</p><h2>Configuration and status</h2><p>Choose a provider and enter its key locally. Keys are written server-side with restricted file permissions and are never returned to the browser.</p></div></div>
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">CONFIGURATION</p><h3>AI writing engine</h3></div><span className={configured ? "status" : "count"}>{configured ? "KEY READY" : "KEY NEEDED"}</span></div><div className="settings-grid"><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value)}>{providers.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Model<input value={model} onChange={e=>setModel(e.target.value)} placeholder="gpt-4o-mini" /><small>{providers.find(item=>item.id===provider)?.hint || "Use the exact model name from your provider."}</small></label><label className="settings-wide">API key<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured ? "Leave blank to keep the saved key" : "Paste provider key"} /><small>Stored locally only. It is never displayed, logged, or sent back to this page.</small></label>{provider === "openai-compatible" ? <label className="settings-wide">Endpoint URL<input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /><small>HTTPS is required for remote endpoints. HTTP is accepted only for localhost/Ollama.</small></label> : null}</div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save model settings"}</button>{message ? <span className="copy-confirm">{message}</span> : null}</div></section>
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">PUBLISHING / POSTIZ</p><h3>Multi-platform scheduling</h3><p className="field-hint">Connect Postiz so approved content can be scheduled to multiple channels from the queue.</p></div><span className={postiz.configured ? "status" : "count"}>{postiz.configured ? "KEY READY" : "NOT CONFIGURED"}</span></div><div className="settings-grid"><label className="settings-wide">Postiz API key<input type="password" autoComplete="new-password" value={postizApiKey} onChange={e=>setPostizApiKey(e.target.value)} placeholder={postiz.configured ? "Leave blank to keep the saved key" : "Paste Postiz API key"} /><small>Stored locally only and never returned to the browser.</small></label><label className="settings-wide">Postiz API URL<input value={postizApiUrl} onChange={e=>setPostizApiUrl(e.target.value)} placeholder="https://api.postiz.com/public/v1" /><small>Use the default cloud URL or your self-hosted Postiz public API URL.</small></label></div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Postiz settings"}</button><button className="outline" onClick={testPing} disabled={pingBusy || !postiz.configured}>{pingBusy ? "Testing…" : "Test Postiz connection"}</button>{pingMessage ? <span className="copy-confirm">{pingMessage}</span> : null}</div><p className="field-hint">Status: {postizStatus}</p></section>
    <section className="settings-status-section"><p className="eyebrow">STATUS</p><div className="queue-list settings-status-list">{rows.map(([name,status,note])=><div className="card queue-row" key={name}><div><h3>{name}</h3><p>{note}</p></div><span className={status === "Ready" || status === "Safe" || status === "Configured" || status === "Connected" ? "status" : "count"}>{status}</span></div>)}</div></section>
    <div className="card side-card section"><p className="eyebrow">REFERENCE LINKS</p><div className="quick-links">{links.map(link=><a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div></div>
  </>;
}
