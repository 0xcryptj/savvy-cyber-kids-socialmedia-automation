import { LibraryClient } from "./LibraryClient";
import { listSourceArticles } from "@/src/ingest/wordpress";

export const revalidate = 900;

export default async function LibraryPage() {
  const [blogResult, newsResult] = await Promise.allSettled([
    listSourceArticles("blog"),
    listSourceArticles("news")
  ]);
  const blog = blogResult.status === "fulfilled" ? blogResult.value : [];
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const error = blogResult.status === "rejected" && newsResult.status === "rejected"
    ? "The live source pages could not be reached. Check the connection and try again."
    : undefined;

  return <><LibraryClient blog={blog} news={news} />{error ? <div className="card empty">{error}</div> : null}</>;
}
