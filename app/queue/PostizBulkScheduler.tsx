"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { WorkspacePost } from "@/src/workspace/types";

type Integration = { id: string; name: string; identifier: string; profile?: string };
type PreflightIssue = { level: "block" | "warn"; code: string; message: string; integrationId?: string };
type PostPreflight = { postId: string; title: string; ok: boolean; contentLength: number; issues: PreflightIssue[] };
type Preflight = {
  ok: boolean;
  posts: PostPreflight[];
  blockedChannels: { integrationId: string; name: string; reason: string }[];
  budget: { remaining: number; required: number; resetAt?: string };
  issues: PreflightIssue[];
};
type ExportOutcome = { postId: string; status: "exported" | "skipped" | "failed"; reason?: string; uncertain?: boolean; results: { integrationName: string }[] };
type ExportRecord = { postId: string; status: "exported" | "failed"; exportedAt: string; results: { integrationName: string; postizPostId?: string }[]; lastError?: string; uncertain?: boolean };

function defaultDate() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return new Date(next.getTime() - next.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function PostizBulkScheduler({ posts }: { posts: WorkspacePost[] }) {
  const [livePosts, setLivePosts] = useState(posts);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [sendBackId, setSendBackId] = useState<string | null>(null);
  const [sendBackNote, setSendBackNote] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [exportType, setExportType] = useState<"schedule" | "draft">("schedule");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [records, setRecords] = useState<Record<string, ExportRecord>>({});
  const [outcomes, setOutcomes] = useState<Record<string, ExportOutcome>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = livePosts.length > 0 && selectedPosts.length === livePosts.length;
  const selectedCount = selectedPosts.length;
  const preflightByPost = useMemo(() => new Map((preflight?.posts ?? []).map((entry) => [entry.postId, entry])), [preflight]);

  // What already reached Postiz, so a reviewer can see it before selecting.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/postiz?postIds=${posts.map((post) => post.id).join(",")}`)
      .then((response) => (response.ok ? response.json() : { records: [] }))
      .then((data: { records?: ExportRecord[] }) => {
        if (cancelled) return;
        setRecords(Object.fromEntries((data.records ?? []).map((record) => [record.postId, record])));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [posts]);

  const loadChannels = useCallback(async () => {
    if (loadingChannels) return;
    setLoadingChannels(true); setError(null);
    try {
      const response = await fetch("/api/postiz/integrations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Postiz channels");
      const list: Integration[] = data.integrations || [];
      setIntegrations(list);
      setSelectedChannels((current) => (current.length ? current.filter((id) => list.some((item) => item.id === id)) : list.map((item) => item.id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Postiz channels");
    } finally {
      setLoadingChannels(false);
    }
  }, [loadingChannels]);

  // Re-check whenever the package changes, so problems surface here rather than
  // as a failed export against the API.
  const checkToken = useRef(0);
  useEffect(() => {
    if (!selectedPosts.length || !selectedChannels.length) { setPreflight(null); return; }
    const token = ++checkToken.current;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const response = await fetch("/api/postiz/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds: selectedPosts, integrationIds: selectedChannels })
        });
        const data = await response.json();
        if (token !== checkToken.current) return;
        if (!response.ok) { setPreflight(null); setError(data.error || "Could not check the package"); }
        else { setPreflight(data); setError(null); }
      } catch {
        if (token === checkToken.current) setPreflight(null);
      } finally {
        if (token === checkToken.current) setChecking(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedPosts, selectedChannels]);

  function openSendBack(id: string) {
    setSendBackId((current) => (current === id ? null : id));
    setSendBackNote("");
    setMessage(null);
  }

  async function sendBackToReview(id: string) {
    setSendingBack(true); setMessage(null); setError(null);
    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW", feedbackNote: sendBackNote })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the post back");
      setLivePosts((current) => current.filter((post) => post.id !== id));
      setSelectedPosts((current) => current.filter((item) => item !== id));
      setSendBackId(null); setSendBackNote("");
      setMessage("Moved back to the review queue.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the post back");
    } finally {
      setSendingBack(false);
    }
  }

  const togglePost = (id: string) => setSelectedPosts((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleChannel = (id: string) => setSelectedChannels((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  async function runExport() {
    setSaving(true); setMessage(null); setError(null);
    try {
      const response = await fetch("/api/posts/postiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: selectedPosts, integrationIds: selectedChannels, date: new Date(date).toISOString(), type: exportType })
      });
      const data = await response.json();
      if (data.outcomes) setOutcomes(Object.fromEntries((data.outcomes as ExportOutcome[]).map((outcome) => [outcome.postId, outcome])));
      if (!response.ok) { setError(data.error || "Could not export to Postiz"); return; }

      const exported: string[] = data.exported ?? [];
      const skipped: string[] = data.skipped ?? [];
      const failed: string[] = data.failed ?? [];
      const parts = [
        exported.length ? `${exported.length} sent to Postiz` : null,
        skipped.length ? `${skipped.length} already sent` : null,
        failed.length ? `${failed.length} failed` : null
      ].filter(Boolean);
      setMessage(parts.join(" · ") || "Nothing to send.");
      // Exported posts leave the approved queue; failures stay put for a retry.
      if (exported.length) {
        setLivePosts((current) => current.filter((post) => !exported.includes(post.id)));
        setSelectedPosts((current) => current.filter((id) => !exported.includes(id)));
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export to Postiz");
    } finally {
      setSaving(false);
    }
  }

  const blockingIssues = preflight?.issues.filter((issue) => issue.level === "block") ?? [];
  const readyCount = preflight?.posts.filter((entry) => entry.ok).length ?? 0;
  const canExport = Boolean(preflight?.ok) && !checking && !saving && selectedChannels.length > 0 && Boolean(date);

  function postBadge(post: WorkspacePost) {
    const outcome = outcomes[post.id];
    if (outcome) {
      if (outcome.status === "exported") return <span className="pf-badge pf-ok">Sent to {outcome.results.length} channel{outcome.results.length === 1 ? "" : "s"}</span>;
      if (outcome.status === "skipped") return <span className="pf-badge pf-warn">Already sent</span>;
      return <span className="pf-badge pf-bad">{outcome.reason}</span>;
    }
    const record = records[post.id];
    if (record?.uncertain) return <span className="pf-badge pf-bad">A previous attempt may have reached Postiz — check there first</span>;
    if (record?.status === "exported") return <span className="pf-badge pf-warn">Sent {new Date(record.exportedAt).toLocaleDateString()} to {record.results.map((result) => result.integrationName).join(", ")}</span>;
    if (record?.status === "failed" && record.lastError) return <span className="pf-badge pf-bad">Last export failed: {record.lastError}</span>;
    return null;
  }

  return <>
    <div className="queue-toolbar card">
      <div>
        <p className="eyebrow">EXPORT TO POSTIZ</p>
        <strong>{selectedCount ? `${selectedCount} selected` : "Select approved content"}</strong>
        <span className="field-hint">Postiz handles scheduling and posting. This sends the graphic, caption, and hashtags across.</span>
      </div>
      <div className="queue-toolbar-actions">
        <button className="outline" onClick={() => setSelectedPosts(allSelected ? [] : livePosts.map((post) => post.id))}>{allSelected ? "Clear all" : "Select all"}</button>
        <button onClick={loadChannels} disabled={!selectedCount || loadingChannels}>{loadingChannels ? <Spinner label="Loading channels…" /> : integrations.length ? "Reload channels" : "Choose channels"}</button>
      </div>
    </div>

    {selectedCount ? <section className="card bulk-schedule-panel">
      <div className="bulk-panel-heading">
        <div><p className="eyebrow">POSTIZ DELIVERY</p><h3>Send {selectedCount} approved post{selectedCount === 1 ? "" : "s"}</h3></div>
        <span className="status">{selectedChannels.length} channel{selectedChannels.length === 1 ? "" : "s"}</span>
      </div>

      <div className="bulk-schedule-grid">
        <div className="pf-stack">
          <label className="pf-field">Publish date and time
            <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="editor-segmented pf-mode">
            <button type="button" className={exportType === "schedule" ? "is-on" : ""} onClick={() => setExportType("schedule")}>Schedule</button>
            <button type="button" className={exportType === "draft" ? "is-on" : ""} onClick={() => setExportType("draft")}>Draft</button>
          </div>
          <p className="field-hint">{exportType === "draft" ? "Lands in Postiz unscheduled so you can place it on the calendar there." : "Postiz publishes at this time."}</p>
        </div>
        <div>
          <p className="field-hint">Connected Postiz channels</p>
          {loadingChannels ? <Spinner label="Loading channels…" /> : integrations.length ? <div className="postiz-channel-list">{integrations.map((integration) => {
            const blocked = preflight?.blockedChannels.find((entry) => entry.integrationId === integration.id);
            return <label className={`postiz-channel${blocked ? " pf-channel-blocked" : ""}`} key={integration.id} title={blocked?.reason}>
              <input type="checkbox" checked={selectedChannels.includes(integration.id)} onChange={() => toggleChannel(integration.id)} />
              <span>{integration.name}{blocked ? <em className="pf-channel-reason">{blocked.reason}</em> : null}</span>
              <small>{integration.profile || integration.identifier}</small>
            </label>;
          })}</div> : <p className="field-hint">Select “Choose channels” to load them.</p>}
        </div>
      </div>

      {checking ? <p className="pf-summary"><Spinner label="Checking the package…" /></p> : preflight ? <div className={`pf-summary${preflight.ok ? "" : " pf-summary-bad"}`}>
        <strong>{preflight.ok ? `${readyCount} of ${selectedCount} ready to send` : "Not ready to send"}</strong>
        <span>Postiz allows about {preflight.budget.remaining} more this hour; this uses {preflight.budget.required}.</span>
        {blockingIssues.length ? <ul>{blockingIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : null}
        {preflight.blockedChannels.length ? <ul>{preflight.blockedChannels.map((channel) => <li key={channel.integrationId}>{channel.name}: {channel.reason}</li>)}</ul> : null}
      </div> : null}

      <div className="actions">
        <button onClick={runExport} disabled={!canExport}>{saving ? <Spinner label="Sending…" /> : `Send ${readyCount || selectedCount} post${(readyCount || selectedCount) === 1 ? "" : "s"} to Postiz`}</button>
        {message ? <span className="copy-confirm">{message}</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
      </div>
    </section> : null}

    <div className="bulk-post-list">{livePosts.map((post) => {
      const check = preflightByPost.get(post.id);
      const blocks = check?.issues.filter((issue) => issue.level === "block") ?? [];
      return <article className={`card bulk-post-card ${selectedPosts.includes(post.id) ? "selected" : ""}`} key={post.id}>
        <label className="bulk-post-select">
          <input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePost(post.id)} aria-label={`Select ${post.articleTitle}`} />
          <span />
        </label>
        <div className="bulk-post-media"><img src={post.graphicPath} alt="" /></div>
        <div className="bulk-post-copy">
          <div className="bulk-post-meta"><span className="status">APPROVED</span><span>{post.category}</span>{check ? <span>{check.contentLength} chars</span> : null}</div>
          <h3>{post.topicHeading}</h3>
          <p className="bulk-article-title">{post.articleTitle}</p>
          <p>{post.caption}</p>
          <p className="hashtags">{post.hashtags.join(" ")}</p>
          {postBadge(post)}
          {blocks.map((issue, index) => <span className="pf-badge pf-bad" key={index}>{issue.message}</span>)}
          <div className="bulk-post-actions">
            <a className="button outline" href={`/review?id=${post.id}`}>Open in review ↗</a>
            <button type="button" className="outline" onClick={() => openSendBack(post.id)} disabled={sendingBack}>{sendBackId === post.id ? "Cancel" : "Send back for review or edit"}</button>
          </div>
          {sendBackId === post.id ? <div className="send-back-panel">
            <label htmlFor={`send-back-${post.id}`}>What needs changing? <small>Optional. This also becomes the graphic guidance for the next render.</small></label>
            <textarea id={`send-back-${post.id}`} value={sendBackNote} onChange={(event) => setSendBackNote(event.target.value)} maxLength={1000} placeholder="e.g. zoom out, the logo is cut off" />
            <button type="button" onClick={() => sendBackToReview(post.id)} disabled={sendingBack}>{sendingBack ? <Spinner label="Moving…" /> : "Move back to review"}</button>
          </div> : null}
        </div>
      </article>;
    })}</div>
  </>;
}
