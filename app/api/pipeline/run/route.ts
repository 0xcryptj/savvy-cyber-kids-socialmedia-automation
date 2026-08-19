import { NextResponse } from "next/server";
import { listSourceArticles } from "@/src/ingest/wordpress";
import { processArticle } from "@/src/workflow/processArticle";
import { findPostByCanonicalUrl } from "@/src/workspace/store";
import { getPipelineState, setPipelineState } from "@/src/workspace/pipeline";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
    } catch { return NextResponse.json({ error: "Invalid request origin" }, { status: 403 }); }
  }
  const startedAt = new Date().toISOString();
  const previous = await getPipelineState();
  await setPipelineState({ status: "RUNNING", lastRunAt: previous.lastRunAt });
  const created = [];
  const errors = [];

  for (const category of ["blog", "news"] as const) {
    try {
      const articles = await listSourceArticles(category);
      let article = undefined;
      for (const candidate of articles) {
        const existing = await findPostByCanonicalUrl(candidate.canonicalUrl);
        if (!existing || existing.status !== "REJECTED") {
          article = candidate;
          break;
        }
      }
      if (!article) throw new Error(`No ${category} source article was found`);
      created.push(await processArticle({ canonicalUrl: article.canonicalUrl, category }));
    } catch (error) {
      errors.push({ category, error: error instanceof Error ? error.message : "Pipeline step failed" });
    }
  }

  const finishedAt = new Date().toISOString();
  await setPipelineState({ status: errors.length && !created.length ? "FAILED" : "COMPLETE", lastRunAt: finishedAt, error: errors.length ? `${errors.length} pipeline step${errors.length === 1 ? "" : "s"} had issues.` : undefined });
  return NextResponse.json({ created, errors, startedAt, finishedAt }, { status: created.length || !errors.length ? 200 : 502 });
}
