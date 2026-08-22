import { describe, expect, it } from "vitest";
import { parseGraphicIntent, defaultTitleWidth, saferTitleWidth } from "@/src/design/graphic-intent";

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

  it("lets an explicit crop request win over a zoom-out phrase", () => {
    expect(parseGraphicIntent("zoom out is wrong, zoom in instead").fit).toBe("cover");
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
    "increase the contrast behind the title"
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

  it("does not mistake ordinary copy guidance for a layout change", () => {
    const intent = parseGraphicIntent("Make the caption warmer and mention parents.");
    expect(intent.fit).toBe("cover");
    expect(intent.scrim).toBe("default");
    expect(intent.titleScale).toBe(1);
    expect(intent.lineSpacing).toBe(1.06);
  });
});
