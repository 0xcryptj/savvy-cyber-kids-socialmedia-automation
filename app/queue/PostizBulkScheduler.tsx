"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { WorkspacePost } from "@/src/workspace/types";
import { composePostContent } from "@/src/content/post-text";
import { fitCaption } from "@/src/content/caption-limits";
import { providerLimit, tightestProviderLimit } from "@/src/integrations/postiz-providers";
import { BrandIcon } from "@/app/components/BrandIcon";

type Integration = { id: string; name: string; identifier: string; profile?: string };
type PreflightIssue = { level: "block" | "warn"; code: string; message: string; integrationId?: string; limit?: number };
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

function toLocalInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function defaultDate() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return toLocalInput(next);
}

/** Channels are re-read on focus, but not more often than this. */
const channelRefreshMs = 30_000;

/** Plain-language rollup of why posts are held back, grouped by cause. */
function notReadyReasons(entries: PostPreflight[]): string[] {
  const labels: Record<string, (count: number) => string> = {
    too_long: (count) => `${count} ${count === 1 ? "caption is" : "captions are"} over the character limit`,
    no_graphic: (count) => `${count} ${count === 1 ? "post has" : "posts have"} no graphic`,
    empty_caption: (count) => `${count} ${count === 1 ? "post has" : "posts have"} no caption`
  };
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const block = entry.issues.find((issue) => issue.level === "block");
    if (block) counts.set(block.code, (counts.get(block.code) ?? 0) + 1);
  }
  return [...counts].map(([code, count]) => (labels[code] ?? ((n: number) => `${n} blocked`))(count));
}

export function PostizBulkScheduler({ posts }: { posts: WorkspacePost[] }) {
  const [livePosts, setLivePosts] = useState(posts);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [sendBackId, setSendBackId] = useState<string | null>(null);
  const [sendBackNote, setSendBackNote] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  // Importing is the default: Postiz owns the calendar, and asking the reviewer
  // to pick a time here only to move it there is a step that buys nothing.
  const [exportType, setExportType] = useState<"draft" | "schedule">("draft");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  // Bumped whenever the content of a selected post changes, so a caption the
  // reviewer just shortened is re-checked instead of staying blocked on the
  // stale result that flagged it.
  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState(false);
  const [records, setRecords] = useState<Record<string, ExportRecord>>({});
  const [outcomes, setOutcomes] = useState<Record<string, ExportOutcome>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);

  const allSelected = livePosts.length > 0 && selectedPosts.length === livePosts.length;
  const selectedCount = selectedPosts.length;
  const preflightByPost = useMemo(() => new Map((preflight?.posts ?? []).map((entry) => [entry.postId, entry])), [preflight]);

  /**
   * The limit the copy actually has to clear.
   *
   * Selecting X alongside Facebook means 280, not 63,206, so the tightest of
   * the chosen channels binds. Before anything is chosen it falls back to the
   * tightest connected channel, so the counts on the cards are honest from the
   * moment the page loads rather than only once a channel is ticked.
   */
  const activeLimit = useMemo(() => {
    const chosen = integrations.filter((integration) => selectedChannels.includes(integration.id));
    return tightestProviderLimit((chosen.length ? chosen : integrations).map((integration) => integration.identifier));
  }, [integrations, selectedChannels]);

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

  // Refs, not loading state: a `loadingChannels` dependency would give this
  // callback a new identity on every load and re-fire the effects that call it.
  const channelRequest = useRef(false);
  const lastChannelLoad = useRef(0);
  const loadChannels = useCallback(async () => {
    if (channelRequest.current) return;
    channelRequest.current = true;
    setLoadingChannels(true); setChannelError(null);
    try {
      const response = await fetch("/api/postiz/integrations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Postiz channels");
      const list: Integration[] = data.integrations || [];
      setIntegrations(list);
      setAppUrl(typeof data.appUrl === "string" ? data.appUrl : null);
      setSelectedChannels((current) => (current.length ? current.filter((id) => list.some((item) => item.id === id)) : list.map((item) => item.id)));
    } catch (loadError) {
      setChannelError(loadError instanceof Error ? loadError.message : "Could not load Postiz channels");
    } finally {
      channelRequest.current = false;
      lastChannelLoad.current = Date.now();
      setLoadingChannels(false);
    }
  }, []);

  // The connected account is the source of truth for what can be posted to, so
  // the channels arrive with the page rather than behind a button the reviewer
  // has to know to press first.
  useEffect(() => { void loadChannels(); }, [loadChannels]);

  // Connecting a channel happens in Postiz, in another tab. Coming back here is
  // the moment that change should show up, so returning focus re-reads the list
  // instead of leaving a stale one behind the Reload button.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastChannelLoad.current < channelRefreshMs) return;
      void loadChannels();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadChannels]);

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
  }, [selectedPosts, selectedChannels, revision]);

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

  function openCaptionEditor(post: WorkspacePost) {
    setEditingId((current) => (current === post.id ? null : post.id));
    setDraftCaption(post.caption);
    setError(null);
  }

  /**
   * Editing happens here rather than sending the post back through review: the
   * copy is already approved, it is only too long for one platform.
   */
  async function saveCaption(id: string) {
    setSavingCaption(true); setError(null);
    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: draftCaption })
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || "Could not save the caption");
      setLivePosts((current) => current.map((post) => (post.id === id ? { ...post, caption: updated.caption } : post)));
      setEditingId(null);
      // The edit changes the content, so anything already exported re-opens.
      setOutcomes((current) => { const next = { ...current }; delete next[id]; return next; });
      // And the preflight that blocked this post is now about text that no
      // longer exists, so it has to run again before export can be judged.
      setRevision((current) => current + 1);
      setMessage("Caption saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the caption");
    } finally {
      setSavingCaption(false);
    }
  }

  async function runExport() {
    const blocker = exportBlocker;
    if (blocker) { setError(blocker); return; }
    setSaving(true); setMessage(null); setError(null);
    try {
      const response = await fetch("/api/posts/postiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postIds: selectedPosts,
          integrationIds: selectedChannels,
          type: exportType,
          // An import claims no slot, so it carries no time; Postiz stamps it.
          ...(exportType === "schedule" ? { date: new Date(date).toISOString() } : {})
        })
      });
      const data = await response.json();
      if (data.outcomes) setOutcomes(Object.fromEntries((data.outcomes as ExportOutcome[]).map((outcome) => [outcome.postId, outcome])));
      if (!response.ok) { setError(data.error || "Could not send to Postiz"); return; }

      const exported: string[] = data.exported ?? [];
      const skipped: string[] = data.skipped ?? [];
      const failed: string[] = data.failed ?? [];
      const parts = [
        exported.length ? `${exported.length} ${exportType === "draft" ? "imported to Postiz" : "scheduled in Postiz"}` : null,
        skipped.length ? `${skipped.length} already sent` : null,
        failed.length ? `${failed.length} failed` : null
      ].filter(Boolean);
      setMessage(parts.join(" · ") || "Nothing to send.");
      // Exported posts leave the approved queue; failures stay put for a retry.
      if (exported.length) {
        setLivePosts((current) => current.filter((post) => !exported.includes(post.id)));
        setSelectedPosts((current) => current.filter((id) => !exported.includes(id)));
      }
      // Budget, duplicate warnings and ledger state all moved; re-check so a
      // follow-up attempt is judged on what Postiz holds now.
      setRevision((current) => current + 1);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not send to Postiz");
    } finally {
      setSaving(false);
    }
  }

  const blockingIssues = preflight?.issues.filter((issue) => issue.level === "block") ?? [];
  const readyCount = preflight?.posts.filter((entry) => entry.ok).length ?? 0;
  const heldBack = useMemo(() => notReadyReasons((preflight?.posts ?? []).filter((entry) => !entry.ok)), [preflight]);

  /**
   * Why this export cannot go, in one sentence, or null when it can.
   *
   * A disabled button is the worst possible answer here: the reviewer presses
   * it, nothing happens, and the reason - usually one post over the X limit -
   * is never stated. So the button stays live and says what is wrong instead.
   */
  const exportBlocker = useMemo(() => {
    if (!selectedCount) return "Select at least one approved post.";
    if (loadingChannels) return "Still loading your Postiz channels.";
    if (!integrations.length) return channelError ?? "No Postiz channels are connected. Add your API key in Settings, then reload channels.";
    if (!selectedChannels.length) return "Choose at least one channel to send to.";
    if (exportType === "schedule") {
      if (!date) return "Pick a publish date and time.";
      if (new Date(date).getTime() <= Date.now()) return "That publish time has already passed. Pick a future time.";
    }
    if (checking) return "Still checking the package.";
    if (!preflight) return null;
    const blocking = preflight.issues.find((issue) => issue.level === "block");
    if (blocking) return blocking.message;
    if (!readyCount) {
      const first = preflight.posts.flatMap((entry) => entry.issues).find((issue) => issue.level === "block");
      return first ? `Nothing is ready to send. ${first.message}` : "Nothing is ready to send.";
    }
    return null;
  }, [selectedCount, loadingChannels, integrations.length, channelError, selectedChannels.length, date, exportType, checking, preflight, readyCount]);

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

  const postizLink = appUrl ? <a className="pf-postiz-link" href={appUrl} target="_blank" rel="noreferrer">Open Postiz ↗</a> : null;

  return <>
    <div className="queue-toolbar card">
      <div>
        <p className="eyebrow eyebrow-brand"><BrandIcon identifier="postiz" size={13} /> EXPORT TO POSTIZ</p>
        <strong>{selectedCount ? `${selectedCount} selected` : "Select approved content"}</strong>
        <span className="field-hint">Postiz handles scheduling and posting. This sends the graphic, caption, and hashtags across.</span>
      </div>
      <div className="queue-toolbar-actions">
        <button className="outline" onClick={() => setSelectedPosts(allSelected ? [] : livePosts.map((post) => post.id))}>{allSelected ? "Clear all" : "Select all"}</button>
        <button className="outline" onClick={loadChannels} disabled={loadingChannels}>{loadingChannels ? <Spinner label="Loading channels…" /> : integrations.length ? `Reload channels (${integrations.length})` : "Reload channels"}</button>
      </div>
    </div>

    {selectedCount ? <section className="card bulk-schedule-panel">
      <div className="bulk-panel-heading">
        <div><p className="eyebrow eyebrow-brand"><BrandIcon identifier="postiz" size={13} /> POSTIZ DELIVERY</p><h3>Send {selectedCount} approved post{selectedCount === 1 ? "" : "s"}</h3></div>
        <span className="status">{selectedChannels.length} channel{selectedChannels.length === 1 ? "" : "s"}</span>
      </div>

      <div className="bulk-schedule-grid">
        <div className="pf-stack">
          <div className="editor-segmented pf-mode">
            <button type="button" className={exportType === "draft" ? "is-on" : ""} onClick={() => setExportType("draft")}>Import to Postiz</button>
            <button type="button" className={exportType === "schedule" ? "is-on" : ""} onClick={() => setExportType("schedule")}>Schedule here</button>
          </div>
          {exportType === "schedule" ? <label className="pf-field">Publish date and time
            <input type="datetime-local" value={date} min={toLocalInput(new Date())} onChange={(event) => setDate(event.target.value)} />
          </label> : null}
          <p className="field-hint">{exportType === "draft"
            ? <>Lands in Postiz unscheduled, ready to place on the calendar there. {postizLink}</>
            : "A starting time — move it on the Postiz calendar any time before it goes out."}</p>
        </div>
        <div>
          <p className="field-hint">Connected Postiz channels</p>
          {loadingChannels && !integrations.length ? <Spinner label="Loading channels…" /> : integrations.length ? <div className="postiz-channel-list">{integrations.map((integration) => {
            const blocked = preflight?.blockedChannels.find((entry) => entry.integrationId === integration.id);
            const limit = providerLimit(integration.identifier);
            return <label className={`postiz-channel${blocked ? " pf-channel-blocked" : ""}`} key={integration.id} title={blocked?.reason}>
              <input type="checkbox" checked={selectedChannels.includes(integration.id)} onChange={() => toggleChannel(integration.id)} />
              <BrandIcon identifier={integration.identifier} size={16} className="postiz-channel-icon" />
              <span>{integration.name}{blocked ? <em className="pf-channel-reason">{blocked.reason}</em> : null}</span>
              {/* The cap is on the row that turns it on, so the reviewer sees
                  what ticking a channel costs before the copy is judged. */}
              <small>{limit ? `${limit.toLocaleString()} chars` : integration.profile || integration.identifier}</small>
            </label>;
          })}</div> : <p className="field-hint">{channelError ?? "No channels came back from Postiz. Connect an account there, then reload channels."}</p>}
          {activeLimit ? <p className="field-hint pf-limit-note">Captions must fit {activeLimit.limit.toLocaleString()} characters — {activeLimit.label} is the tightest channel selected. Hashtags count too.</p> : null}
        </div>
      </div>

      {checking ? <p className="pf-summary"><Spinner label="Checking the package…" /></p> : preflight ? <div className={`pf-summary${preflight.ok ? "" : " pf-summary-bad"}`}>
        <strong>{readyCount ? `${readyCount} of ${selectedCount} ready to send` : "Nothing is ready to send yet"}</strong>
        {heldBack.length ? <span>Held back: {heldBack.join(", ")}. Use Edit caption on the flagged posts.</span> : null}
        {/* Only worth saying when something is actually going out; "this uses 0"
            told the reviewer nothing about why nothing was moving. */}
        {preflight.budget.required ? <span>Postiz allows about {preflight.budget.remaining} more this hour; this uses {preflight.budget.required}.</span> : null}
        {blockingIssues.length ? <ul>{blockingIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : null}
        {preflight.blockedChannels.length ? <ul>{preflight.blockedChannels.map((channel) => <li key={channel.integrationId}>{channel.name}: {channel.reason}</li>)}</ul> : null}
      </div> : null}

      <div className="actions">
        <button onClick={runExport} disabled={saving}>{saving ? <Spinner label="Sending…" /> : `${exportType === "draft" ? "Import" : "Schedule"} ${readyCount || selectedCount} post${(readyCount || selectedCount) === 1 ? "" : "s"} ${exportType === "draft" ? "to" : "in"} Postiz`}</button>
        {message ? <span className="copy-confirm">{message} {postizLink}</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
        {!error && exportBlocker ? <span className="field-hint">{exportBlocker}</span> : null}
      </div>
    </section> : null}

    <div className="bulk-post-list">{livePosts.map((post) => {
      const check = preflightByPost.get(post.id);
      const blocks = check?.issues.filter((issue) => issue.level === "block") ?? [];
      // Tightest platform cap among the selected channels this post breaks,
      // falling back to the cap the panel is already counting against.
      const overLimit = blocks.filter((issue) => issue.code === "too_long" && issue.limit).sort((a, b) => a.limit! - b.limit!)[0];
      const limit = overLimit?.limit ?? activeLimit?.limit;
      const editing = editingId === post.id;
      const length = editing
        ? composePostContent({ caption: draftCaption, hashtags: post.hashtags }).length
        : check?.contentLength ?? composePostContent(post).length;
      return <article className={`card bulk-post-card ${selectedPosts.includes(post.id) ? "selected" : ""}`} key={post.id}>
        <label className="bulk-post-select">
          <input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePost(post.id)} aria-label={`Select ${post.articleTitle}`} />
          <span />
        </label>
        <div className="bulk-post-media"><img src={post.graphicPath} alt="" /></div>
        <div className="bulk-post-copy">
          <div className="bulk-post-meta">
            <span className="status">APPROVED</span>
            <span>{post.category}</span>
            {/* Always visible, not only once it breaks: the count is how the
                reviewer avoids the problem rather than discovers it. */}
            {limit ? <span className={length > limit ? "pf-over" : "pf-under"}>{length} / {limit.toLocaleString()}</span> : <span>{length} chars</span>}
          </div>
          <h3>{post.topicHeading}</h3>
          <p className="bulk-article-title">{post.articleTitle}</p>
          <p>{post.caption}</p>
          <p className="hashtags">{post.hashtags.join(" ")}</p>
          {postBadge(post)}
          {blocks.map((issue, index) => <span className="pf-badge pf-bad" key={index}>{issue.message}</span>)}
          {editing ? <div className="pf-trim">
            <textarea value={draftCaption} onChange={(event) => setDraftCaption(event.target.value)} rows={4} aria-label="Caption" />
            <div className="pf-trim-foot">
              {limit ? <span className={length > limit ? "pf-over" : "pf-under"}>
                {length} / {limit.toLocaleString()}{length > limit ? ` · ${length - limit} over` : " · fits"}
              </span> : null}
              <span className="field-hint">Hashtags count toward the limit.</span>
              {/* The same shortening generation applies, so the reviewer is not
                  counting characters by hand against a cap the code knows. */}
              {limit ? <button type="button" className="outline" onClick={() => setDraftCaption(fitCaption(draftCaption, post.hashtags, limit))} disabled={savingCaption || length <= limit}>Shorten caption</button> : null}
              <button type="button" onClick={() => saveCaption(post.id)} disabled={savingCaption || !draftCaption.trim()}>{savingCaption ? <Spinner label="Saving…" /> : "Save caption"}</button>
            </div>
          </div> : null}
          <div className="bulk-post-actions">
            <button type="button" className="outline" onClick={() => openCaptionEditor(post)} disabled={savingCaption}>{editing ? "Cancel edit" : "Edit caption"}</button>
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
