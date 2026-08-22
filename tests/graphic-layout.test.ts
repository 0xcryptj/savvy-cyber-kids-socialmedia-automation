import { describe, expect, it } from "vitest";
import { canvasHeight, canvasWidth, composition, cropRectForZoom, imagePlacement, titleFit } from "@/src/design/graphic-layout";

/**
 * What the server gets from objectFit, expressed directly. The browser preview
 * positions the image itself, so imagePlacement has to land in the same place or
 * the preview lies about the output.
 */
function objectFitPlacement(sourceWidth: number, sourceHeight: number, fit: "cover" | "contain", focusX: number, focusY: number) {
  const pick = fit === "cover" ? Math.max : Math.min;
  const scale = pick(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { width, height, left: (canvasWidth - width) * (focusX / 100), top: (canvasHeight - height) * (focusY / 100) };
}

const near = (a: number, b: number, tolerance = 2) => Math.abs(a - b) <= tolerance;

describe("imagePlacement", () => {
  const sources: Array<[string, number, number]> = [
    ["Verge news banner", 1200, 624],
    ["SCK blog photo", 800, 533],
    ["DOJ press card", 680, 383],
    ["already 4:5", 1080, 1350],
    ["tall portrait", 400, 1200]
  ];

  it.each(sources)("matches a full-bleed cover crop at zoom 1 for %s", (_label, width, height) => {
    for (const focus of [0, 50, 100]) {
      const mine = imagePlacement(width, height, 1, focus, focus);
      const theirs = objectFitPlacement(width, height, "cover", focus, focus);
      expect(near(mine.width, theirs.width)).toBe(true);
      expect(near(mine.height, theirs.height)).toBe(true);
      expect(near(mine.left, theirs.left)).toBe(true);
      expect(near(mine.top, theirs.top)).toBe(true);
    }
  });

  it.each(sources)("matches an uncropped contain at zoom 0 for %s", (_label, width, height) => {
    for (const focus of [0, 24, 100]) {
      const mine = imagePlacement(width, height, 0, focus, focus);
      const theirs = objectFitPlacement(width, height, "contain", focus, focus);
      expect(near(mine.width, theirs.width)).toBe(true);
      expect(near(mine.height, theirs.height)).toBe(true);
      expect(near(mine.left, theirs.left)).toBe(true);
      expect(near(mine.top, theirs.top)).toBe(true);
    }
  });

  it("always covers the frame at zoom 1, and never overflows it at zoom 0", () => {
    for (const [, width, height] of sources) {
      const covered = imagePlacement(width, height, 1, 50, 50);
      expect(covered.width).toBeGreaterThanOrEqual(canvasWidth - 2);
      expect(covered.height).toBeGreaterThanOrEqual(canvasHeight - 2);

      const contained = imagePlacement(width, height, 0, 50, 50);
      expect(contained.width).toBeLessThanOrEqual(canvasWidth + 2);
      expect(contained.height).toBeLessThanOrEqual(canvasHeight + 2);
    }
  });

  it("grows the visible image as zoom rises, which is the point of the middle setting", () => {
    // The Verge banner: contained it fills 42% of the canvas height and looks weak.
    const sizes = [0, 0.25, 0.55, 0.8, 1].map((zoom) => imagePlacement(1200, 624, zoom, 50, 50).height);
    for (let index = 1; index < sizes.length; index += 1) expect(sizes[index]).toBeGreaterThan(sizes[index - 1]);
    expect(sizes[0] / canvasHeight).toBeCloseTo(0.42, 1);
  });

  it("moves the visible window when the focus moves", () => {
    const left = imagePlacement(1200, 624, 1, 0, 50).left;
    const right = imagePlacement(1200, 624, 1, 100, 50).left;
    expect(left).toBeGreaterThan(right);
  });
});

describe("composition", () => {
  it("keeps the headline box tied to where the text starts", () => {
    expect(composition({ textTop: 900 }).titleAreaHeight).toBeGreaterThan(composition({ textTop: 1000 }).titleAreaHeight);
  });

  it("never lets the headline box collapse, however far the text is dragged", () => {
    expect(composition({ textTop: 1100 }).titleAreaHeight).toBeGreaterThanOrEqual(80);
  });
});

describe("titleFit", () => {
  const fit = (title: string, over: Partial<Parameters<typeof titleFit>[2]> = {}) =>
    titleFit(title, "", { titleScale: 1, lineSpacing: 1.06, titleAreaHeight: 293, maxWidth: 900, ...over });

  it("never returns a layout that overflows the box it is given", () => {
    for (const title of [
      "Toy Meets Tech",
      "Australia says Roblox hasn’t fixed its child predator problem",
      "764 Extremist Group Member Sentenced to 77 Years in Prison for Production of Child Sexual Abuse Material",
      "Understanding Counterintelligence Responsibilities"
    ]) {
      const result = fit(title);
      expect(result.lines.length * result.lineHeight).toBeLessThanOrEqual(293);
    }
  });

  it("collapses runs of whitespace so a highlight boundary cannot double-space", () => {
    expect(fit("Think   Before    You Share").lines.map((line) => line.text).join(" ")).not.toMatch(/ {2}/);
  });

  it("shrinks the headline when asked to scale down", () => {
    expect(fit("Australia says Roblox hasn’t fixed its problem", { titleScale: 0.8 }).fontSize)
      .toBeLessThanOrEqual(fit("Australia says Roblox hasn’t fixed its problem").fontSize);
  });
});
