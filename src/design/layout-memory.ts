import { ContentCategory } from "@/config/feeds";
import { GraphicAdjustments, clampAdjustments } from "./graphic-adjustments";

// A layout you adjusted by hand and then approved is a decision worth keeping.
// The next article that lands with the same kind of image starts from it instead
// of making you do the work again.
//
// The key is what actually drives the composition. Measuring the approved posts
// showed crop percentage is useless on its own — every Savvy Cyber Kids blog
// image is 800x533 and loses the same 47% — but the *shape* of the source and
// whether it is a designed graphic separate the cases cleanly. A wide news
// banner and a 3:2 photograph need different treatment; two 3:2 photographs do
// not.

export type LayoutMemoryEntry = {
  key: string;
  adjustments: GraphicAdjustments;
  /** How many approvals have reinforced this layout. */
  samples: number;
  updatedAt: string;
};

export type ImageShape = "wide" | "landscape" | "square" | "portrait";

export function imageShape(ratio?: number): ImageShape | undefined {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return undefined;
  if (ratio >= 1.7) return "wide";
  if (ratio >= 1.2) return "landscape";
  if (ratio >= 0.85) return "square";
  return "portrait";
}

export function layoutKey(input: { category: ContentCategory | string; sourceImageRatio?: number; sourceImageHasText?: boolean }): string | undefined {
  const shape = imageShape(input.sourceImageRatio);
  if (!shape) return undefined;
  return `${input.category}:${shape}:${input.sourceImageHasText ? "designed" : "photo"}`;
}

/**
 * Latest approval wins rather than averaging. Averaging would drag every layout
 * toward a middle that nobody chose, and a reviewer who has just adjusted and
 * approved a graphic has given the most current answer.
 */
export function rememberLayout(entries: LayoutMemoryEntry[], key: string, adjustments: GraphicAdjustments): LayoutMemoryEntry[] {
  const cleaned = clampAdjustments(adjustments);
  if (!cleaned) return entries;
  // A remembered layout must not carry per-article content into the next post.
  const { topicHeading: _heading, ...reusable } = cleaned;
  void _heading;
  const existing = entries.find((entry) => entry.key === key);
  const next: LayoutMemoryEntry = {
    key,
    adjustments: reusable,
    samples: (existing?.samples ?? 0) + 1,
    updatedAt: new Date().toISOString()
  };
  return [next, ...entries.filter((entry) => entry.key !== key)].slice(0, 40);
}

export function recallLayout(entries: LayoutMemoryEntry[], key?: string): GraphicAdjustments | undefined {
  if (!key) return undefined;
  return entries.find((entry) => entry.key === key)?.adjustments;
}
