import { describe, expect, it } from "vitest";
import { imageShape, layoutKey, recallLayout, rememberLayout } from "@/src/design/layout-memory";

describe("imageShape", () => {
  it("separates the shapes that actually need different treatment", () => {
    expect(imageShape(1200 / 624)).toBe("wide");     // The Verge news banner
    expect(imageShape(800 / 533)).toBe("landscape"); // every SCK blog image
    expect(imageShape(1080 / 1350)).toBe("portrait");
    expect(imageShape(1000 / 1000)).toBe("square");
  });

  it("has no opinion when the ratio is unknown or nonsense", () => {
    expect(imageShape(undefined)).toBeUndefined();
    expect(imageShape(0)).toBeUndefined();
    expect(imageShape(Number.NaN)).toBeUndefined();
  });
});

describe("layoutKey", () => {
  it("keeps designed graphics apart from photographs of the same shape", () => {
    const photo = layoutKey({ category: "news", sourceImageRatio: 1.92 });
    const designed = layoutKey({ category: "news", sourceImageRatio: 1.92, sourceImageHasText: true });
    expect(photo).toBe("news:wide:photo");
    expect(designed).toBe("news:wide:designed");
    expect(photo).not.toBe(designed);
  });

  it("keeps blog and news apart", () => {
    expect(layoutKey({ category: "blog", sourceImageRatio: 1.5 })).not.toBe(layoutKey({ category: "news", sourceImageRatio: 1.5 }));
  });

  it("declines to key anything without a measurable image", () => {
    expect(layoutKey({ category: "news" })).toBeUndefined();
  });
});

describe("rememberLayout", () => {
  it("stores an approved layout and recalls it for the same key", () => {
    const entries = rememberLayout([], "news:wide:designed", { zoom: 0.55, focusX: 40 });
    expect(recallLayout(entries, "news:wide:designed")).toEqual({ zoom: 0.55, focusX: 40 });
    expect(recallLayout(entries, "news:landscape:photo")).toBeUndefined();
  });

  it("lets the newest approval win and counts the reinforcement", () => {
    const first = rememberLayout([], "blog:landscape:photo", { zoom: 1, scrim: "light" });
    const second = rememberLayout(first, "blog:landscape:photo", { zoom: 0.8, scrim: "heavy" });
    expect(second).toHaveLength(1);
    expect(second[0].samples).toBe(2);
    expect(recallLayout(second, "blog:landscape:photo")).toEqual({ zoom: 0.8, scrim: "heavy" });
  });

  it("never carries one article's heading into the next post", () => {
    const entries = rememberLayout([], "news:wide:designed", { zoom: 0.5, topicHeading: "BREAKING NEWS" });
    expect(recallLayout(entries, "news:wide:designed")).toEqual({ zoom: 0.5 });
  });

  it("ignores adjustments that survive no validation", () => {
    expect(rememberLayout([], "news:wide:photo", {})).toEqual([]);
  });

  it("clamps what it stores, so a bad record cannot poison future posts", () => {
    const entries = rememberLayout([], "news:wide:photo", { zoom: 99, textTop: -10 } as never);
    expect(recallLayout(entries, "news:wide:photo")).toEqual({ zoom: 1, textTop: 600 });
  });

  it("keeps the store bounded", () => {
    let entries = rememberLayout([], "seed", { zoom: 1 });
    for (let index = 0; index < 60; index += 1) entries = rememberLayout(entries, `key-${index}`, { zoom: 0.5 });
    expect(entries.length).toBeLessThanOrEqual(40);
  });
});
