"use client";

import { useState } from "react";
import { Spinner } from "@/app/components/Spinner";

type Integration = { id: string; name: string; identifier: string; picture?: string; profile?: string };

export function PostizScheduleButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return new Date(next.getTime() - next.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [message, setMessage] = useState<string | null>(null);

  async function openScheduler() {
    setOpen(true); setMessage(null);
    if (integrations.length || loading) return;
    setLoading(true);
    const response = await fetch("/api/postiz/integrations");
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not load Postiz channels");
    else { setIntegrations(data.integrations || []); setSelected((data.integrations || []).map((item: Integration) => item.id)); }
    setLoading(false);
  }

  function toggle(idToToggle: string) {
    setSelected(current => current.includes(idToToggle) ? current.filter(id => id !== idToToggle) : [...current, idToToggle]);
  }

  async function schedule() {
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/posts/${id}/handoff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integrationIds: selected, date: new Date(date).toISOString() }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not schedule in Postiz");
    else { setMessage("Scheduled in Postiz."); window.setTimeout(() => window.location.reload(), 700); }
    setSaving(false);
  }

  return <div className="postiz-scheduler"><button onClick={openScheduler} disabled={loading}>{loading ? <Spinner label="Loading channels…" /> : "Schedule in Postiz"}</button>{open ? <div className="postiz-panel"><div className="postiz-panel-heading"><strong>Schedule to Postiz</strong><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close scheduler">×</button></div>{loading ? <Spinner label="Loading channels…" /> : integrations.length ? <><label className="postiz-date">Publish date and time<input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label><p className="field-hint">Choose the connected channels for this post.</p><div className="postiz-channel-list">{integrations.map(integration => <label className="postiz-channel" key={integration.id}><input type="checkbox" checked={selected.includes(integration.id)} onChange={() => toggle(integration.id)} /><span>{integration.name}</span><small>{integration.profile || integration.identifier}</small></label>)}</div><button onClick={schedule} disabled={saving || !selected.length || !date}>{saving ? <Spinner label="Scheduling…" /> : `Schedule to ${selected.length} channel${selected.length === 1 ? "" : "s"}`}</button></> : <p className="field-hint">No connected Postiz channels were found.</p>}{message ? <p className={message.startsWith("Scheduled") ? "copy-confirm" : "error-text"}>{message}</p> : null}</div> : null}</div>;
}
