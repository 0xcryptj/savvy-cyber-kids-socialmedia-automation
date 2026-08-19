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
  const [makeWebhookUrl, setMakeWebhookUrl] = useState("");
  const [appPublicUrl, setAppPublicUrl] = useState("");
  const [handoff, setHandoff] = useState<{ makeWebhookConfigured: boolean; appPublicUrlConfigured: boolean; lastTest?: { status: "success" | "failed"; testedAt: string; reason?: string } }>({ makeWebhookConfigured: false, appPublicUrlConfigured: false });
  const [pingBusy, setPingBusy] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  useEffect(() => { fetch("/api/settings").then(r => r.json()).then(data => { setProvider(data.provider); setModel(data.model); setBaseUrl(data.baseUrl || ""); setProviders(data.providers || []); setConfigured(data.configured); setHandoff(data.handoff || { makeWebhookConfigured: false, appPublicUrlConfigured: false }); }); }, []);
  async function save() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, baseUrl, apiKey, makeWebhookUrl: makeWebhookUrl || undefined, appPublicUrl: appPublicUrl || undefined }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not save settings"); else { setConfigured(data.configured); setHandoff(data.handoff); setApiKey(""); setMakeWebhookUrl(""); setAppPublicUrl(""); setMessage("Settings saved securely."); }
    setSaving(false);
  }
  async function testPing() {
    setPingBusy(true); setPingMessage(null);
    const response = await fetch("/api/settings", { method: "POST" });
    const data = await response.json();
    if (!response.ok) setPingMessage(data.error || "Connectivity test failed"); else { setHandoff(current => ({ ...current, lastTest: { status: "success", testedAt: data.testedAt } })); setPingMessage(`Test succeeded at ${new Date(data.testedAt).toLocaleString()}`); }
    setPingBusy(false);
  }
  const handoffStatus = !handoff.makeWebhookConfigured || !handoff.appPublicUrlConfigured ? "Not configured" : handoff.lastTest?.status === "success" ? `Last test: success at ${new Date(handoff.lastTest.testedAt).toLocaleString()}` : handoff.lastTest?.status === "failed" ? `Last test: failed - ${handoff.lastTest.reason || "unknown reason"}` : "Configured, ping not yet tested";
  return <>
    <div className="page-intro"><div><p className="eyebrow">WORKSPACE / SETTINGS</p><h2>Configuration and status</h2><p>Choose a provider and enter its key locally. Keys are written server-side with restricted file permissions and are never returned to the browser.</p></div></div>
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">CONFIGURATION</p><h3>AI writing engine</h3></div><span className={configured ? "status" : "count"}>{configured ? "KEY READY" : "KEY NEEDED"}</span></div><div className="settings-grid"><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value)}>{providers.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Model<input value={model} onChange={e=>setModel(e.target.value)} placeholder="gpt-4o-mini" /><small>{providers.find(item=>item.id===provider)?.hint || "Use the exact model name from your provider."}</small></label><label className="settings-wide">API key<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured ? "Leave blank to keep the saved key" : "Paste provider key"} /><small>Stored locally only. It is never displayed, logged, or sent back to this page.</small></label>{provider === "openai-compatible" ? <label className="settings-wide">Endpoint URL<input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /><small>HTTPS is required for remote endpoints. HTTP is accepted only for localhost/Ollama.</small></label> : null}</div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save model settings"}</button>{message ? <span className="copy-confirm">{message}</span> : null}</div></section>
    <section className="card settings-panel settings-configuration"><div className="settings-heading"><div><p className="eyebrow">CONFIGURATION</p><h3>Social posting handoff</h3><p className="field-hint">Connect the approved-post queue to Make.com and SocialBee.</p></div><span className={handoff.makeWebhookConfigured && handoff.appPublicUrlConfigured ? "status" : "count"}>{handoff.makeWebhookConfigured && handoff.appPublicUrlConfigured ? "CONFIGURED" : "NOT CONFIGURED"}</span></div><div className="settings-grid"><label className="settings-wide">Make.com Webhook URL<input type="password" autoComplete="new-password" value={makeWebhookUrl} onChange={e=>setMakeWebhookUrl(e.target.value)} placeholder={handoff.makeWebhookConfigured ? "Leave blank to keep the saved URL" : "Paste Make.com webhook URL"} /><small>Stored locally only. HTTPS is required, except localhost for local development.</small></label><label className="settings-wide">Public App URL<input value={appPublicUrl} onChange={e=>setAppPublicUrl(e.target.value)} placeholder={handoff.appPublicUrlConfigured ? "Leave blank to keep the saved URL" : "https://your-hosted-app.example.com"} /><small>This must be a real internet-reachable HTTPS URL, not localhost, because Make.com and SocialBee fetch the generated graphic from it.</small></label></div><div className="actions settings-actions"><button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save handoff settings"}</button><button className="outline" onClick={testPing} disabled={pingBusy || !handoff.makeWebhookConfigured} title={!handoff.makeWebhookConfigured ? "Set a webhook URL first" : "Send a connectivity-only test"}>{pingBusy ? "Testing…" : "Send test ping"}</button>{pingMessage ? <span className="copy-confirm">{pingMessage}</span> : null}</div><p className="field-hint">Status: {handoffStatus}</p><details className="setup-help"><summary>Show the 8-step Make.com and SocialBee setup</summary><ol><li>Create a free <a href="https://www.make.com/en/register" target="_blank" rel="noreferrer">Make.com account</a>.</li><li>Create a scenario, import <code>docs/make-socialbee-blueprint.json</code>.</li><li>Open the SocialBee module and connect your SocialBee account.</li><li>Open the Webhook module and copy its URL.</li><li>Paste it above into Make.com Webhook URL.</li><li>Set Public App URL to this app’s hosted HTTPS URL.</li><li>Save, then click Send test ping and confirm success.</li><li>Turn the Make.com scenario ON; imported scenarios start OFF.</li></ol><p className="field-hint">Double-check the SocialBee field mappings in Make after import; Make renders those fields live.</p></details></section>
    <section className="settings-status-section"><p className="eyebrow">STATUS</p><div className="queue-list settings-status-list">{rows.map(([name,status,note])=><div className="card queue-row" key={name}><div><h3>{name}</h3><p>{note}</p></div><span className={status === "Ready" || status === "Safe" || status === "Configured" || status === "Connected" ? "status" : "count"}>{status}</span></div>)}</div></section>
    <div className="card side-card section"><p className="eyebrow">REFERENCE LINKS</p><div className="quick-links">{links.map(link=><a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div></div>
  </>;
}
