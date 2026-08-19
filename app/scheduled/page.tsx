import { listPosts } from "@/src/workspace/store";

export default async function ScheduledPage() {
  const posts = await listPosts("SCHEDULED");
  return <><div className="page-intro"><div><p className="eyebrow">CONTENT PIPELINE / OUTBOUND</p><h2>Scheduled posts</h2><p>Posts scheduled for outbound publishing.</p></div><span className="count">{posts.length} scheduled</span></div><div className="queue-list">{posts.length ? posts.map(post => <div className="card queue-row" key={post.id}><div><span className="status">SCHEDULED</span><h3>{post.topicHeading}</h3><p>{post.articleTitle}</p></div><div className="history-meta"><strong>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Schedule not recorded"}</strong><small>{post.publishedVia || "Outbound handoff"}{post.publishExternalId ? ` · ${post.publishExternalId}` : ""}</small></div></div>) : <div className="card empty">No posts are currently scheduled.</div>}</div></>;
}
