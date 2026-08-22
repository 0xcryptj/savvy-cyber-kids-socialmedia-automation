import { describe, expect, it } from "vitest";
import { parseGraphicIntent, defaultTitleWidth, saferTitleWidth, partialZoom } from "@/src/design/graphic-intent";
import { cropRectForZoom } from "@/src/design/graphic-layout";

describe("parseGraphicIntent", () => {
  it("defaults to the full-bleed house style when there is no guidance", () => {
    const intent = parseGraphicIntent(undefined);
    expect(intent.fit).toBe("cover");
    expect(intent.scrim).toBe("default");
    expect(intent.titleScale).toBe(1);
    expect(intent.lineSpacing).toBe(1.06);
    expect(intent.titleWidth).toBe(defaultTitleWidth);
  });

  // Each of these is a phrasing a reviewer actually used, or a preset button on
  // the review page. Every one of them was silently ignored before.
  it.each([
    "zoom out so breaking news isn't cutoff",
    "Zoom out and show the full subject",
    "please zoom out, the banner is cut off",
    "show the whole image",
    "the headline text is getting cropped",
    "don't crop the image",
    "contain_image; keep all source text visible"
  ])("treats %j as a request to show the whole frame", (guidance) => {
    expect(parseGraphicIntent(guidance).fit).toBe("contain");
  });

  it.each([
    "zoom in on the subject",
    "crop tighter around the faces",
    "fill the frame with the photo"
  ])("treats %j as a request to crop in", (guidance) => {
    expect(parseGraphicIntent(guidance).fit).toBe("cover");
  });

  it("lands in the middle when a request asks to crop and to keep everything", () => {
    // These two intents cannot both be satisfied, so meet them halfway rather
    // than picking one and ignoring the other.
    expect(parseGraphicIntent("zoom out is wrong, zoom in instead").zoom).toBe(partialZoom);
  });

  it.each([
    "remove the black box it covers the image",
    "reduce the black box it covers the entire image",
    "the dark panel is hiding the photo",
    "less black please",
    "soften the dark overlay",
    "lighten the gradient"
  ])("treats %j as a request to lighten the scrim", (guidance) => {
    expect(parseGraphicIntent(guidance).scrim).toBe("light");
  });

  it.each([
    "the headline is hard to read",
    "increase the contrast behind the title",
    // Reviewers write this the other way round too.
    "make the black gradients slightly more visable",
    "make the dark overlay stronger"
  ])("treats %j as a request for a heavier scrim", (guidance) => {
    expect(parseGraphicIntent(guidance).scrim).toBe("heavy");
  });

  it.each([
    "Reduce headline size to fit safely",
    "the title is too big",
    "make the headline smaller",
    "the text and image overlap"
  ])("treats %j as a request to scale the headline down", (guidance) => {
    expect(parseGraphicIntent(guidance).titleScale).toBe(0.88);
  });

  it.each([
    "Add spacing and prevent overlap",
    "give the lines some breathing room",
    "the headline looks cramped"
  ])("treats %j as a request for looser line spacing", (guidance) => {
    expect(parseGraphicIntent(guidance).lineSpacing).toBe(1.14);
  });

  it("narrows the headline for the safer-layout preset", () => {
    expect(parseGraphicIntent("Keep all punctuation visible").titleWidth).toBe(saferTitleWidth);
    expect(parseGraphicIntent("safer_layout").titleWidth).toBe(saferTitleWidth);
  });

  it("anchors to the bottom when asked", () => {
    expect(parseGraphicIntent("focus on the bottom of the photo").focus).toBe("center bottom");
    expect(parseGraphicIntent("").focus).toBe("center 24%");
  });

  it("shows the whole frame when the source is a designed graphic", () => {
    // The vision model flags banners, title cards and infographics, whose own
    // words are destroyed by the default crop.
    expect(parseGraphicIntent(undefined, true).fit).toBe("contain");
    expect(parseGraphicIntent("center the subject", true).fit).toBe("contain");
  });

  it("crops a flagged graphic only part of the way when asked to zoom in", () => {
    // A full crop would destroy the very text the flag exists to protect.
    expect(parseGraphicIntent("zoom in on the logo", true).zoom).toBe(partialZoom);
  });

  it("keeps cropping when the source is an ordinary photograph", () => {
    expect(parseGraphicIntent(undefined, false).fit).toBe("cover");
  });

  // A wide news banner contained outright fills only ~42% of the canvas height,
  // which reads as "zoomed out way too far". Hedged wording lands in between.
  it.each([
    "zoom out a little tiny bit",
    "zoom out just a tad so roblox is fully visible",
    "zoom out slightly to ensure the logo is fully visible",
    "zoom out a bit, the edges are cut off",
    // The particle gets separated from the verb constantly.
    "zoom the image out just a tad",
    "zoom it out a little",
    "zoom this graphic out slightly"
  ])("treats %j as a partial zoom, not a full one", (guidance) => {
    expect(parseGraphicIntent(guidance).zoom).toBe(partialZoom);
  });

  it("still zooms all the way out when the request is not hedged", () => {
    expect(parseGraphicIntent("zoom out the image its cutoff").zoom).toBe(0);
    expect(parseGraphicIntent("zoom out, breaking news is cut off").zoom).toBe(0);
    expect(parseGraphicIntent("zoom the image out, the logo is cut off").zoom).toBe(0);
  });

  it("lands in the middle when asked to zoom in but keep everything visible", () => {
    expect(parseGraphicIntent("zoom in on roblox but make sure the image is visible").zoom).toBe(partialZoom);
  });

  it("fills the frame by default and on an explicit crop", () => {
    expect(parseGraphicIntent(undefined).zoom).toBe(1);
    expect(parseGraphicIntent("zoom in on the subject").zoom).toBe(1);
  });

  it("bleeds a partially cropped image off the top edge", () => {
    expect(parseGraphicIntent("zoom out a tad").focus).toBe("center top");
    expect(parseGraphicIntent(undefined).focus).toBe("center 24%");
  });

  it("does not mistake ordinary copy guidance for a layout change", () => {
    const intent = parseGraphicIntent("Make the caption warmer and mention parents.");
    expect(intent.fit).toBe("cover");
    expect(intent.scrim).toBe("default");
    expect(intent.titleScale).toBe(1);
    expect(intent.lineSpacing).toBe(1.06);
  });
});

describe("cropRectForZoom", () => {
  // The Verge's Roblox image: 1.92:1 into a 0.8:1 frame.
  it("returns the source untouched at zoom 0", () => {
    expect(cropRectForZoom(1200, 624, 0)).toEqual({ width: 1200, height: 624, left: 0, top: 0 });
  });

  it("crops a wide source to the frame ratio at zoom 1", () => {
    const rect = cropRectForZoom(1200, 624, 1);
    expect(rect.height).toBe(624);
    expect(rect.width / rect.height).toBeCloseTo(1080 / 1350, 2);
  });

  it("crops part of the way in between, and stays centred", () => {
    const rect = cropRectForZoom(1200, 624, 0.55);
    expect(rect.width).toBeGreaterThan(cropRectForZoom(1200, 624, 1).width);
    expect(rect.width).toBeLessThan(1200);
    expect(rect.left).toBe(Math.round((1200 - rect.width) / 2));
    expect(rect.top).toBe(0);
  });

  it("crops height rather than width for a tall source", () => {
    const rect = cropRectForZoom(800, 1600, 1);
    expect(rect.width).toBe(800);
    expect(rect.height).toBeLessThan(1600);
    expect(rect.left).toBe(0);
  });

  it("never asks for a region outside the source", () => {
    for (const zoom of [0, 0.25, 0.55, 0.9, 1]) {
      for (const [w, h] of [[1200, 624], [800, 533], [680, 383], [1080, 1350], [400, 1200]]) {
        const rect = cropRectForZoom(w, h, zoom);
        expect(rect.left + rect.width).toBeLessThanOrEqual(w);
        expect(rect.top + rect.height).toBeLessThanOrEqual(h);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
      }
    }
  });
});
