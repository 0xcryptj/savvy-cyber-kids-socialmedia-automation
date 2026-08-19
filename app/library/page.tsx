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
  const errors = {
    ...(blogResult.status === "rejected" ? { blog: blogResult.reason instanceof Error ? blogResult.reason.message : "Could not load blog sources" } : {}),
    ...(newsResult.status === "rejected" ? { news: newsResult.reason instanceof Error ? newsResult.reason.message : "Could not load news sources" } : {})
  };

  return <LibraryClient blog={blog} news={news} initialErrors={errors} />;
}
