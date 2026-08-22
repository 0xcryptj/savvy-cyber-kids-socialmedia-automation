"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { WorkspacePost } from "@/src/workspace/types";

type Integration = { id: string; name: string; identifier: string; profile?: string };

function defaultDate() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return new Date(next.getTime() - next.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function PostizBulkScheduler({ posts }: { posts: WorkspacePost[] }) {
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = posts.length > 0 && selectedPosts.length === posts.length;
  const selectedCount = selectedPosts.length;
  const selectedCaptions = useMemo(() => posts.filter(post => selectedPosts.includes(post.id)), [posts, selectedPosts]);

  function togglePost(id: string) {
    setSelectedPosts(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleChannel(id: string) {
    setSelectedChannels(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function loadChannels() {
    if (integrations.length || loadingChannels) return;
    setLoadingChannels(true); setMessage(null);
    const response = await fetch("/api/postiz/integrations");
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not load Postiz channels");
    else { setIntegrations(data.integrations || []); setSelectedChannels((data.integrations || []).map((item: Integration) => item.id)); }
    setLoadingChannels(false);
  }

  async function schedule() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/posts/postiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postIds: selectedPosts, integrationIds: selectedChannels, date: new Date(date).toISOString() }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Could not schedule posts");
    else { setMessage(`${data.scheduled.length} post${data.scheduled.length === 1 ? "" : "s"} scheduled in Postiz${data.failed?.length ? ` · ${data.failed.length} failed` : ""}.`); window.setTimeout(() => window.location.reload(), 900); }
    setSaving(false);
  }

  return <>
    <div className="queue-toolbar card"><div><p className="eyebrow">BULK SCHEDULING</p><strong>{selectedCount ? `${selectedCount} selected` : "Select approved content"}</strong><span className="field-hint">Preview the package here before sending it to Postiz.</span></div><div className="queue-toolbar-actions"><button className="outline" onClick={() => setSelectedPosts(allSelected ? [] : posts.map(post => post.id))}>{allSelected ? "Clear all" : "Select all"}</button><button onClick={loadChannels} disabled={!selectedCount || loadingChannels}>{loadingChannels ? <Spinner label="Loading channels…" /> : "Choose schedule"}</button></div></div>
    {selectedCount ? <section className="card bulk-schedule-panel"><div className="bulk-panel-heading"><div><p className="eyebrow">POSTIZ DELIVERY</p><h3>Schedule {selectedCount} approved post{selectedCount === 1 ? "" : "s"}</h3></div><span className="status">{selectedChannels.length} channel{selectedChannels.length === 1 ? "" : "s"}</span></div><div className="bulk-schedule-grid"><label>Publish date and time<input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label><div><p className="field-hint">Connected Postiz channels</p>{loadingChannels ? <Spinner label="Loading channels…" /> : integrations.length ? <div className="postiz-channel-list">{integrations.map(integration => <label className="postiz-channel" key={integration.id}><input type="checkbox" checked={selectedChannels.includes(integration.id)} onChange={() => toggleChannel(integration.id)} /><span>{integration.name}</span><small>{integration.profile || integration.identifier}</small></label>)}</div> : <p className="field-hint">Select “Choose schedule” to load channels.</p>}</div></div><div className="actions"><button onClick={schedule} disabled={saving || !selectedChannels.length || !date || !integrations.length}>{saving ? <Spinner label="Scheduling…" /> : `Schedule ${selectedCount} post${selectedCount === 1 ? "" : "s"} in Postiz`}</button>{message ? <span className={message.includes("failed") || message.includes("Could not") ? "error-text" : "copy-confirm"}>{message}</span> : null}</div></section> : null}
    <div className="bulk-post-list">{posts.map(post => <article className={`card bulk-post-card ${selectedPosts.includes(post.id) ? "selected" : ""}`} key={post.id}><label className="bulk-post-select"><input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePost(post.id)} aria-label={`Select ${post.articleTitle}`} /><span /></label><div className="bulk-post-media"><img src={post.graphicPath} alt="" /></div><div className="bulk-post-copy"><div className="bulk-post-meta"><span className="status">APPROVED</span><span>{post.category}</span></div><h3>{post.topicHeading}</h3><p className="bulk-article-title">{post.articleTitle}</p><p>{post.caption}</p><p className="hashtags">{post.hashtags.join(" ")}</p></div></article>)}</div>
    {selectedCaptions.length > 1 ? <p className="field-hint bulk-selection-note">You’re scheduling these as separate posts at the same scheduled time across the selected Postiz channels.</p> : null}
  </>;
}
