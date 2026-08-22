import { describe, expect, it } from "vitest";
import { adjustmentsFromParams, adjustmentsToQuery, clampAdjustments, sliderFields } from "@/src/design/graphic-adjustments";
import { parseGraphicIntent } from "@/src/design/graphic-intent";

describe("clampAdjustments", () => {
  it("keeps values that are in range", () => {
    expect(clampAdjustments({ zoom: 0.4, focusY: 30, scrim: "light" })).toEqual({ zoom: 0.4, focusY: 30, scrim: "light" });
  });

  it("pulls out-of-range values back to the limits", () => {
    const clamped = clampAdjustments({ zoom: 5, focusY: -20, titleScale: 99, textTop: 10 });
    expect(clamped).toEqual({ zoom: 1, focusY: 0, titleScale: 1.2, textTop: 600 });
  });

  it("drops values that are not numbers and unknown scrim names", () => {
    expect(clampAdjustments({ zoom: "banana", scrim: "neon" })).toBeUndefined();
  });

  it("returns undefined rather than an empty object", () => {
    expect(clampAdjustments({})).toBeUndefined();
    expect(clampAdjustments(null)).toBeUndefined();
    expect(clampAdjustments("zoom=1")).toBeUndefined();
  });

  it("accepts numeric strings, since query parameters arrive as text", () => {
    expect(clampAdjustments({ zoom: "0.5", focusY: "80" })).toEqual({ zoom: 0.5, focusY: 80 });
  });

  it("covers every slider the editor renders", () => {
    const everything = Object.fromEntries(sliderFields.map((field) => [field.key, field.min]));
    expect(Object.keys(clampAdjustments(everything) ?? {})).toHaveLength(sliderFields.length);
  });
});

describe("preview query round trip", () => {
  it("survives a trip through the query string", () => {
    const adjustments = { zoom: 0.55, focusY: 12, scrimTop: 700, textTop: 980, titleScale: 0.9, lineSpacing: 1.2, scrim: "heavy" as const };
    expect(adjustmentsFromParams(new URLSearchParams(adjustmentsToQuery(adjustments)))).toEqual(adjustments);
  });

  it("ignores a query string with nothing relevant in it", () => {
    expect(adjustmentsFromParams(new URLSearchParams("v=3"))).toBeUndefined();
  });

  it("clamps hostile query values instead of trusting them", () => {
    expect(adjustmentsFromParams(new URLSearchParams("zoom=99&textTop=-5"))).toEqual({ zoom: 1, textTop: 600 });
  });
});

describe("adjustments override the guidance parser", () => {
  it("beats a zoom inferred from the text", () => {
    expect(parseGraphicIntent("zoom out, it is cut off").zoom).toBe(0);
    expect(parseGraphicIntent("zoom out, it is cut off", false, { zoom: 0.8 }).zoom).toBe(0.8);
  });

  it("beats a scrim inferred from the text", () => {
    expect(parseGraphicIntent("remove the black box").scrim).toBe("light");
    expect(parseGraphicIntent("remove the black box", false, { scrim: "heavy" }).scrim).toBe("heavy");
  });

  it("beats the framing chosen for a detected designed graphic", () => {
    expect(parseGraphicIntent(undefined, true).zoom).toBe(0);
    expect(parseGraphicIntent(undefined, true, { zoom: 1 }).zoom).toBe(1);
  });

  it("sets the image anchor directly", () => {
    expect(parseGraphicIntent(undefined, false, { focusY: 70 }).focus).toBe("center 70%");
  });

  it("leaves anything it does not set to the inferred value", () => {
    const intent = parseGraphicIntent("make the headline smaller", false, { zoom: 0.5 });
    expect(intent.zoom).toBe(0.5);
    expect(intent.titleScale).toBe(0.88);
  });
});
