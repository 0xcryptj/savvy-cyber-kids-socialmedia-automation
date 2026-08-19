"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { feedConfig, ContentCategory } from "@/config/feeds";
import { SourceArticle } from "@/src/ingest/types";
import { Spinner } from "@/app/components/Spinner";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ArticleCard({ article, onCreate, busy }: { article: SourceArticle; onCreate: (article: SourceArticle) => void; busy: string | null }) {
  return (
    <article className="card source-card">
      <div className="source-thumb" style={article.featuredImageUrl ? { backgroundImage: `url(${article.featuredImageUrl})` } : undefined}>
        <span className="source-badge">{article.category === "blog" ? "Blog" : "News"}</span>
      </div>
      <div className="source-copy">
        <p className="meta">{formatDate(article.publishedAt)}</p>
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

export function LibraryClient({ blog, news, initialErrors = {} }: { blog: SourceArticle[]; news: SourceArticle[]; initialErrors?: Partial<Record<ContentCategory, string>> }) {
  const router = useRouter();
  const [tab, setTab] = useState<ContentCategory>("blog");
  const [liveBlog, setLiveBlog] = useState(blog);
  const [liveNews, setLiveNews] = useState(news);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(Object.entries(initialErrors).map(([category, message]) => `${category}: ${message}`).join(" | ") || null);
  const articles = tab === "blog" ? liveBlog : liveNews;
  const config = feedConfig[tab];
  const counts = useMemo(() => ({ blog: liveBlog.length, news: liveNews.length }), [liveBlog, liveNews]);

  async function refreshSources() {
    setSyncing(true); setError(null);
    try {
      const response = await fetch("/api/sources", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not sync sources");
      setLiveBlog(payload.blog ?? []); setLiveNews(payload.news ?? []);
      const sourceErrors = payload.errors ? Object.entries(payload.errors).map(([category, message]) => `${category}: ${message}`).join(" | ") : "";
      setError(sourceErrors || null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not sync sources"); }
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
          <p>Blog posts and news headlines stay in separate queues, then follow the same Canva template and review path.</p>
        </div>
        <div className="actions"><button className="secondary" onClick={refreshSources} disabled={syncing}>{syncing ? <Spinner label="Refreshing…" /> : "Refresh sources"}</button><a className="button secondary" href={config.pageUrl} target="_blank" rel="noreferrer">View {config.label.toLowerCase()} ↗</a></div>
      </div>
      <div className="tabs">
        <button className={tab === "blog" ? "active" : ""} onClick={() => setTab("blog")}>Blog content · {counts.blog}</button>
        <button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>News feed · {counts.news}</button>
      </div>
      {error ? <div className="card empty error-panel">{error}</div> : null}
      <div className="source-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} onCreate={createPost} busy={busy} />
        ))}
        {!articles.length && !error ? <div className="card empty">No source articles loaded yet. Click “Refresh sources” to try again.</div> : null}
      </div>
    </>
  );
}
