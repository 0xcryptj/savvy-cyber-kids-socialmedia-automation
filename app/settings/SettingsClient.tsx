"use client";

import { useEffect, useState } from "react";

type Provider = { id: string; label: string; hint: string; models: string[] };
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
  // Tracked so an untouched field is never sent back: persisting a URL the
  // operator never set would pin it and shadow POSTIZ_API_URL from then on.
  const [loadedApiUrl, setLoadedApiUrl] = useState("https://api.postiz.com/public/v1");
  const [postiz, setPostiz] = useState<{ configured: boolean; apiUrl: string; apiUrlSource?: "saved" | "environment" | "default"; apiKeySource?: "saved" | "environment" | "none"; lastTest?: { status: "success" | "failed"; testedAt: string; reason?: string; channelCount?: number } }>({ configured: false, apiUrl: "https://api.postiz.com/public/v1" });
  const [pingBusy, setPingBusy] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  useEffect(() => { fetch("/api/settings").then(r => r.json()).then(data => { setProvider(data.provider); setModel(data.model); setBaseUrl(data.baseUrl || ""); setProviders(data.providers || []); setConfigured(data.configured); setPostiz(data.postiz || { configured: false, apiUrl: "https://api.postiz.com/public/v1" }); setPostizApiUrl(data.postiz?.apiUrl || "https://api.postiz.com/public/v1"); setLoadedApiUrl(data.postiz?.apiUrl || "https://api.postiz.com/public/v1"); }); }, []);
  const selectedProvider = providers.find(item => item.id === provider);
  const modelOptions = selectedProvider?.models || [];
  const hasPresetModel = modelOptions.includes(model);
  function changeProvider(nextProvider: string) {
    setProvider(nextProvider);
    const next = providers.find(item => item.id === nextProvider);
    if (next?.models.length) setModel(next.models[0]);
  }
  async function save() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, baseUrl, apiKey: apiKey || undefined, postizApiKey: postizApiKey || undefined, postizApiUrl: postizApiUrl === loadedApiUrl ? undefined : postizApiUrl }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not save settings"); else { setConfigured(data.configured); setPostiz(data.postiz); setPostizApiUrl(data.postiz?.apiUrl || loadedApiUrl); setLoadedApiUrl(data.postiz?.apiUrl || loadedApiUrl); setPostizApiKey(""); setMessage("Settings saved securely."); }
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
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">CONFIGURATION</p><h3>AI writing engine</h3><p className="field-hint">Choose a provider and a supported model preset. Custom model names are available only for compatible endpoints.</p></div><span className={configured ? "status" : "count"}>{configured ? "KEY SAVED" : "KEY NEEDED"}</span></div><div className="settings-grid"><label>Provider<select value={provider} onChange={e=>changeProvider(e.target.value)}>{providers.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><small>{selectedProvider?.hint}</small></label><label>Model{modelOptions.length ? <select value={hasPresetModel ? model : "__custom"} onChange={e=>setModel(e.target.value)}>{modelOptions.map(option=><option key={option} value={option}>{option}</option>)}<option value="__custom">Custom model</option></select> : <input value={model} onChange={e=>setModel(e.target.value.replace(/[^A-Za-z0-9._:/-]/g, ""))} placeholder="provider/model-name" />}<small>{modelOptions.length && !hasPresetModel ? "Custom model selected" : "Model selection is sanitized before saving."}</small></label><label className="settings-wide">API key<div className="secret-input"><input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured ? "Saved — leave blank to keep it" : "Paste provider key"} />{configured ? <span className="secret-saved">Saved</span> : null}</div><small>Write-only. The saved key is never returned, displayed, or logged.</small></label>{provider === "openai-compatible" ? <label className="settings-wide">Endpoint URL<input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /><small>HTTPS is required for remote endpoints. HTTP is accepted only for localhost/Ollama.</small></label> : null}</div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save model settings"}</button>{message ? <span className="copy-confirm">{message}</span> : null}</div></section>
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">PUBLISHING / POSTIZ</p><h3>Multi-platform scheduling</h3><p className="field-hint">Connect Postiz so approved content can be scheduled to multiple channels from the queue.</p></div><span className={postiz.configured ? "status" : "count"}>{postiz.configured ? "KEY READY" : "NOT CONFIGURED"}</span></div><div className="settings-grid"><label className="settings-wide">Postiz API key<input type="password" autoComplete="new-password" value={postizApiKey} onChange={e=>setPostizApiKey(e.target.value)} placeholder={postiz.configured ? "Leave blank to keep the saved key" : "Paste Postiz API key"} /><small>{postiz.apiKeySource === "environment" ? "Currently using POSTIZ_API_KEY from .env. Saving a key here takes over from it." : postiz.apiKeySource === "saved" ? "Using the key saved here. Stored locally and never returned to the browser." : "Stored locally only and never returned to the browser."}</small></label><label className="settings-wide">Postiz API URL<input value={postizApiUrl} onChange={e=>setPostizApiUrl(e.target.value)} placeholder="https://api.postiz.com/public/v1" /><small>{postiz.apiUrlSource === "saved" ? "Saved here, which overrides POSTIZ_API_URL. Clear the field to go back to the environment value." : postiz.apiUrlSource === "environment" ? "Coming from POSTIZ_API_URL in .env. Editing this saves an override." : "Postiz Cloud default. Use your self-hosted public API URL if you run your own."}</small></label></div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Postiz settings"}</button><button className="outline" onClick={testPing} disabled={pingBusy || !postiz.configured}>{pingBusy ? "Testing…" : "Test Postiz connection"}</button>{pingMessage ? <span className="copy-confirm">{pingMessage}</span> : null}</div><p className="field-hint">Status: {postizStatus}</p></section>
    <section className="settings-status-section"><p className="eyebrow">STATUS</p><div className="queue-list settings-status-list">{rows.map(([name,status,note])=><div className="card queue-row" key={name}><div><h3>{name}</h3><p>{note}</p></div><span className={status === "Ready" || status === "Safe" || status === "Configured" || status === "Connected" ? "status" : "count"}>{status}</span></div>)}</div></section>
    <div className="card side-card section"><p className="eyebrow">REFERENCE LINKS</p><div className="quick-links">{links.map(link=><a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div></div>
  </>;
}
