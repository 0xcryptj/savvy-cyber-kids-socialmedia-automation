import { transitionPost } from "./approval";
import { ExportOutcome, ExportSummary } from "@/src/integrations/postiz";

/**
 * Applies an export result to workflow state.
 *
 * A failed export deliberately leaves the post APPROVED rather than moving it to
 * FAILED: the reviewer's judgement still stands, the cause is usually transient
 * (a rate limit, a dropped connection), and keeping it in Ready to post means
 * re-exporting is one click instead of a trip through the failed queue. The
 * reason is carried on the export ledger, which the queue reads back.
 */
export async function applyExportOutcomes(summary: ExportSummary, options: { date: string; type: "schedule" | "now" | "draft" }): Promise<void> {
  for (const outcome of summary.outcomes) {
    if (outcome.status !== "exported") continue;
    await transitionPost(outcome.postId, "QUEUED", { publishedVia: "Postiz" });
    // A draft has reached Postiz but has not claimed a slot, so it stops at
    // QUEUED. Postiz owns everything from here.
    if (options.type === "draft") continue;
    await transitionPost(outcome.postId, "SCHEDULED", {
      publishedVia: "Postiz",
      publishExternalId: outcome.results.find((result) => result.postizPostId)?.postizPostId,
      scheduledAt: options.date
    });
  }
}

export function summarizeOutcome(outcome: ExportOutcome): string {
  if (outcome.status === "exported") return `Sent to ${outcome.results.length} channel${outcome.results.length === 1 ? "" : "s"}`;
  if (outcome.status === "skipped") return outcome.reason ?? "Already sent";
  return outcome.reason ?? "Export failed";
}
