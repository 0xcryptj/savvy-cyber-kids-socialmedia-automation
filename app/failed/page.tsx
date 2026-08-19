import Link from "next/link";
import { listPosts } from "@/src/workspace/store";
import { FailedRetryButton } from "./FailedRetryButton";

export default async function FailedPage() {
  const posts = await listPosts("FAILED");
  return <><div className="page-intro"><div><p className="eyebrow">CONTENT PIPELINE / RECOVERY</p><h2>Failed posts</h2><p>Generation or handoff failures that need attention.</p></div><span className="count">{posts.length} failed</span></div><div className="queue-list">{posts.length ? posts.map(post => <div className="card queue-row" key={post.id}><div><span className="status status-rejected">FAILED</span><h3>{post.topicHeading}</h3><p>{post.articleTitle}</p><small>{post.failureReason || "No failure reason was recorded."}</small></div><div><FailedRetryButton id={post.id} /> <Link className="button outline" href={`/review?id=${post.id}`}>View post</Link></div></div>) : <div className="card empty">No failed posts are waiting for recovery.</div>}</div></>;
}
