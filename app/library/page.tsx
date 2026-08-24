import { LibraryClient } from "./LibraryClient";
import { listSourceArticles } from "@/src/ingest/wordpress";
import { readSourceCache } from "@/src/ingest/source-cache";
import { listPipelineSourceUrls } from "@/src/workspace/store";
import { contentCategories } from "@/config/feeds";

// Rendered from the stored feeds, so opening the library costs the source sites
// nothing. New content arrives when someone presses Update sources.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [blogResult, newsResult, pipelineResult] = await Promise.allSettled([
    listSourceArticles("blog"),
    listSourceArticles("news"),
    listPipelineSourceUrls()
  ]);
  const cache = await readSourceCache();
  const blog = blogResult.status === "fulfilled" ? blogResult.value : [];
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const pipelineUrls = pipelineResult.status === "fulfilled" ? pipelineResult.value : [];
  const errors = {
    ...(blogResult.status === "rejected" ? { blog: blogResult.reason instanceof Error ? blogResult.reason.message : "Could not load blog sources" } : {}),
    ...(newsResult.status === "rejected" ? { news: newsResult.reason instanceof Error ? newsResult.reason.message : "Could not load news sources" } : {}),
    ...Object.fromEntries(contentCategories.filter((category) => cache[category]?.error).map((category) => [category, cache[category]!.error!]))
  };

  return <LibraryClient
    blog={blog}
    news={news}
    pipelineUrls={pipelineUrls}
    initialErrors={errors}
    updatedAt={contentCategories.map((category) => cache[category]?.fetchedAt).filter(Boolean).sort().pop()}
    newUrls={contentCategories.flatMap((category) => cache[category]?.lastAdded ?? [])}
  />;
}
