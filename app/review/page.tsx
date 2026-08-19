"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { designUrls, publishingUrls } from "@/config/urls";
import { WorkspacePost } from "@/src/workspace/types";
import { Spinner } from "@/app/components/Spinner";

function shareUrl(label: string, articleUrl: string) {
  if (label === "Facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
  if (label === "LinkedIn") return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
  if (label === "X") return `https://twitter.com/intent/tweet?text=${encodeURIComponent("Savvy Cyber Kids: ")}&url=${encodeURIComponent(articleUrl)}`;
  return publishingUrls.instagram;
}

function PlatformIcon({ label }: { label: string }) {
  return <span className={`platform-icon platform-${label.toLowerCase()}`} aria-hidden="true">{label === "Instagram" ? "◎" : label === "LinkedIn" ? "in" : label === "Facebook" ? "f" : "𝕏"}</span>;
}

export default function ReviewPage() {
  const [post, setPost] = useState<WorkspacePost | null>(null);
  const [reviewQueue, setReviewQueue] = useState<WorkspacePost[]>([]);
  const [copy, setCopy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const queryId = new URLSearchParams(window.location.search).get("id");
    (async () => {
      const response = await fetch(queryId ? `/api/posts/${queryId}` : "/api/posts");
      const payload = await response.json();
      if (!response.ok) setError(payload.error);
      else {
        const allPosts = queryId ? [payload] : (payload.posts || []);
        setReviewQueue(queryId ? [] : allPosts.filter((item: WorkspacePost) => ["PENDING_REVIEW", "REVISION", "APPROVED"].includes(item.status)));
        const next = queryId ? payload : allPosts.find((item: WorkspacePost) => ["PENDING_REVIEW", "REVISION"].includes(item.status));
        setPost(next ?? null);
        setCopy(next ? `${next.caption}\n\n${next.hashtags.join(" ")}` : "");
      }
      setLoading(false);
    })();
  }, []);

  async function transition(status: WorkspacePost["status"]) {
    if (!post) return;
    setTransitioning(true); setError(null);
    const lines = copy.trim().split(/\r?\n/);
    const hashtagLine = lines.at(-1) || "";
    const hashtags = hashtagLine.split(/\s+/).filter(Boolean);
    const caption = lines.slice(0, -1).join("\n").trim();
    const response = await fetch(`/api/posts/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, caption, hashtags }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error);
    else { setPost(payload); setCopy(`${payload.caption}\n\n${payload.hashtags.join(" ")}`); setReviewQueue(current => current.map(item => item.id === payload.id ? payload : item)); }
    setTransitioning(false);
  }

  async function sharePost() {
    if (!post) return;
    const finalCopy = copy;
    try {
      const response = await fetch(post.graphicPath);
      const blob = await response.blob();
      const file = new File([blob], `${post.articleTitle.slice(0, 40)}.png`, { type: blob.type || "image/png" });
      if (navigator.share) {
        const shareData: ShareData = { title: post.articleTitle, text: finalCopy, url: post.externalUrl || post.sourceUrl };
        if (!navigator.canShare || navigator.canShare({ files: [file] })) shareData.files = [file];
        await navigator.share(shareData);
        setShareMessage("Ready to post from your selected social account.");
        return;
      }
    } catch { /* fall back to copying the package below */ }
    await navigator.clipboard?.writeText(`${finalCopy}\n\nGraphic: ${window.location.origin}${post.graphicPath}`);
    setShareMessage("Caption, hashtags, and graphic link copied. Paste them into your social app.");
    window.setTimeout(() => setShareMessage(null), 5000);
  }

  async function quickPlatformPost(label: string) {
    if (!post) return;
    const finalCopy = copy;
    await navigator.clipboard?.writeText(`${finalCopy}\n\nGraphic: ${window.location.origin}${post.graphicPath}`);
    window.open(shareUrl(label, post.externalUrl || post.sourceUrl), "_blank", "noopener,noreferrer");
    setShareMessage(`${label} post copy and graphic link copied.`);
    window.setTimeout(() => setShareMessage(null), 5000);
  }

  if (loading) return <div className="card loading-state"><Spinner label="Loading your review workspace…" /><div className="skeleton skeleton-wide" /><div className="skeleton" /></div>;
  if (error) return <div className="card empty error-panel">{error}</div>;
  if (!post) return <div className="card empty">No posts are waiting for review. <a href="/library">Browse live sources →</a></div>;

  return <>
    <div className="page-intro"><div><p className="eyebrow">CONTENT PIPELINE / REVIEW</p><h2>Social post preview</h2><p>Source image, Canva-style 4:5 graphic, caption, and hashtags ready for review.</p></div><span className="count">{post.category}</span></div>
    {reviewQueue.length ? <div className="card review-queue"><div className="review-queue-heading"><div><p className="eyebrow">YOUR REVIEW QUEUE</p><h3>{reviewQueue.filter(item => item.status !== "APPROVED").length} waiting for approval</h3></div><span className="mini-label">Approved posts stay logged here</span></div><div className="review-queue-list">{reviewQueue.map(item=><a key={item.id} className={`review-queue-item ${item.id === post.id ? "selected" : ""}`} href={`/review?id=${item.id}`}><span className="queue-item-icon">{item.status === "APPROVED" ? "✓" : "•"}</span><span><strong>{item.topicHeading}</strong><small>{item.articleTitle}</small></span><span className={`status ${item.status === "APPROVED" ? "status-published" : ""}`}>{item.status.replace("_", " ")}</span></a>)}</div></div> : null}
    <div className="review-layout">
      <article className="card preview-card">
        <div className="post-main"><div className="graphic"><Image src={post.graphicPath} alt="Savvy Cyber Kids social post preview" width={1080} height={1350} sizes="(max-width: 900px) 100vw, 55vw" priority /></div><div className="post-copy"><span className="status">{post.status.replace("_", " ")}</span><h2>{post.topicHeading}</h2><p className="meta">{new Date(post.publishedAt).toLocaleDateString()} · <a href={post.externalUrl || post.sourceUrl} target="_blank" rel="noreferrer">Open source article ↗</a></p><h3>{post.articleTitle}</h3><label className="caption-label" htmlFor="copy">Caption + hashtags</label><textarea className="edit-area copy-editor" id="copy" value={copy} onChange={e=>setCopy(e.target.value)} /><small className="field-hint">Keep four hashtags on the final line. The two required Savvy Cyber Kids tags stay included.</small></div></div>
        <div className="actions">{["PENDING_REVIEW", "REVISION"].includes(post.status) ? <><button onClick={()=>transition("APPROVED")} disabled={transitioning}>{transitioning ? <Spinner label="Saving…" /> : "Approve"}</button><button className="secondary" onClick={()=>transition("REVISION")} disabled={transitioning}>Save edit</button><button className="outline" onClick={()=>transition("REJECTED")} disabled={transitioning}>Reject</button></> : <span className="review-complete">✓ Approved and kept in the review log</span>}</div>
      </article>
      <div className="side-stack">
        <div className="card side-card quick-post-card"><p className="eyebrow">QUICK POST</p><h3>Post from your account</h3><p>Use your own logged-in account. No API setup or account connection is required.</p><button className="share-button" onClick={sharePost}>Share graphic + caption <span>↗</span></button><div className="platform-post-grid">{["Instagram", "Facebook", "LinkedIn", "X"].map(label=><button key={label} className="platform-post-button" onClick={()=>quickPlatformPost(label)}><PlatformIcon label={label} />{label}<span>↗</span></button>)}</div>{shareMessage ? <p className="copy-confirm">{shareMessage}</p> : null}</div>
        <div className="card side-card"><p className="eyebrow">MEDIA PACKAGE</p><h3>Ready to download</h3><p>The source image is composed into the branded 4:5 template with the article title and topic heading.</p><div className="quick-links"><a href={post.graphicPath} download>Download finished graphic <span>↓</span></a><a href={post.externalUrl || post.sourceUrl} target="_blank" rel="noreferrer">Open source article <span>↗</span></a><a href={designUrls.canvaTemplate} target="_blank" rel="noreferrer">Open Canva template <span>↗</span></a></div></div>
      </div>
    </div>
  </>;
}
