"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { feedConfig, ContentCategory } from "@/config/feeds";
import { SourceArticle } from "@/src/ingest/types";
import { Spinner } from "@/app/components/Spinner";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** How stale the stored feeds are, in the plainest terms. */
function timeAgo(value?: string) {
  if (!value) return "never";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function SourceThumb({ article }: { article: SourceArticle }) {
  const [failed, setFailed] = useState(false);
  return <div className="source-thumb">
    {article.featuredImageUrl && !failed ? <img src={article.featuredImageUrl} alt="" onError={() => setFailed(true)} /> : <div className="source-thumb-fallback">{article.category === "news" ? "NEWS" : "SCK"}</div>}
    <span className="source-badge">{article.category === "blog" ? "Blog" : "News"}</span>
  </div>;
}

function ArticleCard({ article, onCreate, busy, isNew }: { article: SourceArticle; onCreate: (article: SourceArticle) => void; busy: string | null; isNew?: boolean }) {
  return (
    <article className={`card source-card${isNew ? " source-card-new" : ""}`}>
      <SourceThumb article={article} />
      <div className="source-copy">
        <p className="meta">{formatDate(article.publishedAt)}{isNew ? <span className="source-new">New</span> : null}</p>
        <h3>{article.title}</h3>
        <p>{article.excerpt}</p>
        <div className="actions">
          <button onClick={() => onCreate(article)} disabled={busy === article.canonicalUrl}>
            {busy === article.canonicalUrl ? <Spinner label="Writing post…" /> : "Create social post"}
          </button>
          <a className="button outline" href={article.externalUrl || article.sourceUrl} target="_blank" rel="noreferrer">Open article ↗</a>
        </div>
      </div>
    </article>
  );
}

function articleUrls(article: SourceArticle) {
  return [article.canonicalUrl, article.externalUrl, article.sourceUrl].filter(Boolean) as string[];
}

export function LibraryClient({ blog, news, pipelineUrls = [], initialErrors = {}, updatedAt, newUrls = [] }: { blog: SourceArticle[]; news: SourceArticle[]; pipelineUrls?: string[]; initialErrors?: Partial<Record<ContentCategory, string>>; updatedAt?: string; newUrls?: string[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<ContentCategory>("blog");
  const [liveBlog, setLiveBlog] = useState(blog);
  const [liveNews, setLiveNews] = useState(news);
  const [livePipelineUrls, setLivePipelineUrls] = useState(pipelineUrls);
  const [showPipelined, setShowPipelined] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(updatedAt);
  const [freshUrls, setFreshUrls] = useState<string[]>(newUrls);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(Object.entries(initialErrors).map(([category, message]) => `${category}: ${message}`).join(" | ") || null);
  const config = feedConfig[tab];
  // An approved post is already on its way to being published, so its source
  // article is hidden here rather than inviting a duplicate.
  const pipelineSet = useMemo(() => new Set(livePipelineUrls), [livePipelineUrls]);
  const isPipelined = useCallback((article: SourceArticle) => articleUrls(article).some((url) => pipelineSet.has(url)), [pipelineSet]);
  const available = useMemo(() => ({
    blog: liveBlog.filter((article) => !isPipelined(article)),
    news: liveNews.filter((article) => !isPipelined(article))
  }), [liveBlog, liveNews, isPipelined]);
  const allForTab = tab === "blog" ? liveBlog : liveNews;
  const articles = showPipelined ? allForTab : available[tab];
  const hiddenCount = allForTab.length - available[tab].length;
  const counts = useMemo(() => ({ blog: available.blog.length, news: available.news.length }), [available]);
  const freshSet = useMemo(() => new Set(freshUrls), [freshUrls]);

  /**
   * The one action that goes out to the source sites. Everything else on this
   * page reads the copy stored from the last update.
   */
  async function updateSources() {
    setSyncing(true); setError(null); setUpdateNote(null);
    try {
      const response = await fetch("/api/sources/refresh", { method: "POST" });
      const payload = await response.json();
      if (!response.ok && !payload.results) throw new Error(payload.error ?? "Could not update sources");
      setLiveBlog(payload.blog ?? []); setLiveNews(payload.news ?? []); setLivePipelineUrls(payload.pipelineUrls ?? []);
      setFreshUrls(payload.newUrls ?? []);
      setLastUpdated(payload.updatedAt);
      const added: number = payload.added ?? 0;
      setUpdateNote(added ? `${added} new article${added === 1 ? "" : "s"} found.` : "Already up to date.");
      const sourceErrors = payload.errors ? Object.entries(payload.errors).map(([category, message]) => `${category}: ${message}`).join(" | ") : "";
      setError(sourceErrors || null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update sources"); }
    finally { setSyncing(false); }
  }

  async function createPost(article: SourceArticle) {
    setBusy(article.canonicalUrl);
    setError(null);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonicalUrl: article.canonicalUrl, category: article.category, sourceArticle: article })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create post");
      router.push(`/review?id=${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create post");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CONTENT PIPELINE / LIBRARY</p>
          <h2>Pick a live article</h2>
          <p>Blog posts and news headlines stay in separate queues, then follow the same Canva template and review path. Sources are stored locally — press Update sources to pull the latest.</p>
        </div>
        <div className="actions source-update">
          <div className="source-update-main">
            <button onClick={updateSources} disabled={syncing}>{syncing ? <Spinner label="Checking the feeds…" /> : "Update sources"}</button>
            <span className="field-hint">Updated {timeAgo(lastUpdated)}{updateNote ? ` · ${updateNote}` : ""}</span>
          </div>
          <a className="button secondary" href={config.pageUrl} target="_blank" rel="noreferrer">View {config.label.toLowerCase()} ↗</a>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === "blog" ? "active" : ""} onClick={() => setTab("blog")}>Blog content · {counts.blog}</button>
        <button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>News feed · {counts.news}</button>
      </div>
      {error ? <div className="card empty error-panel">{error}</div> : null}
      {hiddenCount ? <p className="pipeline-note">{hiddenCount} approved {hiddenCount === 1 ? "article is" : "articles are"} already in the publishing queue. <button type="button" className="link-button" onClick={() => setShowPipelined((current) => !current)}>{showPipelined ? "Hide them" : "Show them"}</button></p> : null}
      <div className="source-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} onCreate={createPost} busy={busy} isNew={freshSet.has(article.canonicalUrl)} />
        ))}
        {!articles.length && !error ? <div className="card empty">No source articles loaded yet. Press “Update sources” to pull them in.</div> : null}
      </div>
    </>
  );
}
