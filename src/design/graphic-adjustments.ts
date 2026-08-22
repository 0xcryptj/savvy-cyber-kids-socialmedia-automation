// Manual overrides for the graphic composition.
//
// Describing a layout change in words and hoping the parser understands is the
// slow way round. These are the same knobs the guidance parser sets, exposed
// directly so a reviewer can drag a slider and watch the graphic move. Anything
// set here wins over whatever the guidance said.
//
// One definition serves three consumers: the renderer, the API that validates
// query and body input, and the editor UI that draws the controls. They cannot
// drift apart.

export type ScrimStrength = "light" | "default" | "heavy";

export type GraphicAdjustments = {
  /** 0 shows the whole source image, 1 crops it to fill the frame. */
  zoom?: number;
  /** Horizontal anchor of the image, 0 = left edge, 100 = right. */
  focusX?: number;
  /** Vertical anchor of the image, 0 = top of frame, 100 = bottom. */
  focusY?: number;
  /** How hard the bottom gradient darkens the photo. */
  scrim?: ScrimStrength;
  /** Where the gradient starts fading in, in canvas pixels from the top. */
  scrimTop?: number;
  /** Where the topic heading block starts, in canvas pixels from the top. */
  textTop?: number;
  /** Multiplier on the starting headline size. */
  titleScale?: number;
  /** Headline line-height multiplier. */
  lineSpacing?: number;
  /** Reviewer-drawn shaded rectangles, drawn over the photo and under the text. */
  regions?: OverlayRegion[];
  /** Replaces the generated topic heading when set. */
  topicHeading?: string;
};

/** A shaded rectangle, positioned as percentages of the canvas. */
export type OverlayRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** #rrggbb. */
  color: string;
  /** 0 transparent to 1 solid. */
  opacity: number;
};

export const maxRegions = 6;

export type SliderField = {
  key: "zoom" | "focusX" | "focusY" | "scrimTop" | "textTop" | "titleScale" | "lineSpacing";
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Multiplies the stored value for display, e.g. 0.55 shown as 55. */
  displayScale: number;
  unit: string;
};

export const sliderFields: SliderField[] = [
  { key: "zoom", label: "Image zoom", hint: "0% shows the whole image, 100% fills the frame", min: 0, max: 1, step: 0.01, displayScale: 100, unit: "%" },
  { key: "focusX", label: "Image left / right", hint: "Which part of a wide image stays in frame", min: 0, max: 100, step: 1, displayScale: 1, unit: "%" },
  { key: "focusY", label: "Image up / down", hint: "Which part of a tall image stays in frame", min: 0, max: 100, step: 1, displayScale: 1, unit: "%" },
  { key: "scrimTop", label: "Fade starts at", hint: "Where the dark gradient begins", min: 200, max: 1100, step: 10, displayScale: 1, unit: "px" },
  { key: "textTop", label: "Text starts at", hint: "Where the heading and headline sit", min: 600, max: 1100, step: 10, displayScale: 1, unit: "px" },
  { key: "titleScale", label: "Headline size", hint: "Scales the headline up or down", min: 0.6, max: 1.2, step: 0.01, displayScale: 100, unit: "%" },
  { key: "lineSpacing", label: "Line spacing", hint: "Space between headline lines", min: 1, max: 1.4, step: 0.01, displayScale: 100, unit: "%" }
];

export const scrimOptions: ScrimStrength[] = ["light", "default", "heavy"];

/**
 * What the renderer does when nothing is set. The editor opens on these so a
 * freshly opened panel shows where the graphic actually is, and the renderer
 * reads them so there is one definition of "default" rather than two.
 */
export const defaultAdjustments = {
  zoom: 1,
  focusX: 50,
  focusY: 24,
  scrimTop: 560,
  textTop: 900,
  titleScale: 1,
  lineSpacing: 1.06,
  scrim: "default" as ScrimStrength
};

const bounds = new Map(sliderFields.map((field) => [field.key, field]));

function clampNumber(key: SliderField["key"], value: unknown): number | undefined {
  const field = bounds.get(key);
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!field || typeof parsed !== "number" || !Number.isFinite(parsed)) return undefined;
  return Math.min(field.max, Math.max(field.min, parsed));
}

/**
 * Accepts anything — query strings, request bodies, stored records — and returns
 * only values that are in range. Returns undefined when nothing survives, so an
 * empty adjustment set is never persisted as an object full of nothing.
 */
export function clampAdjustments(input: unknown): GraphicAdjustments | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const adjustments: GraphicAdjustments = {};

  for (const field of sliderFields) {
    const value = clampNumber(field.key, source[field.key]);
    if (value !== undefined) adjustments[field.key] = value;
  }
  if (typeof source.scrim === "string" && scrimOptions.includes(source.scrim as ScrimStrength)) {
    adjustments.scrim = source.scrim as ScrimStrength;
  }
  if (typeof source.topicHeading === "string" && source.topicHeading.trim()) {
    adjustments.topicHeading = source.topicHeading.trim().slice(0, 60);
  }
  const regions = clampRegions(source.regions);
  if (regions) adjustments.regions = regions;

  return Object.keys(adjustments).length ? adjustments : undefined;
}

const percent = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback;
};

export function clampRegions(input: unknown): OverlayRegion[] | undefined {
  const list = typeof input === "string" ? safeParse(input) : input;
  if (!Array.isArray(list) || !list.length) return undefined;
  const regions = list.slice(0, maxRegions).map((entry) => {
    const region = (entry ?? {}) as Record<string, unknown>;
    const opacity = typeof region.opacity === "string" ? Number(region.opacity) : region.opacity;
    return {
      x: percent(region.x, 0),
      y: percent(region.y, 0),
      width: percent(region.width, 20),
      height: percent(region.height, 20),
      color: typeof region.color === "string" && /^#[0-9a-f]{6}$/i.test(region.color) ? region.color : "#051322",
      opacity: typeof opacity === "number" && Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.5
    };
  }).filter((region) => region.width > 0 && region.height > 0);
  return regions.length ? regions : undefined;
}

function safeParse(value: string): unknown {
  try { return JSON.parse(value); } catch { return undefined; }
}

/** Reads adjustments off a preview URL's query string. */
export function adjustmentsFromParams(params: URLSearchParams): GraphicAdjustments | undefined {
  const source: Record<string, string> = {};
  for (const field of sliderFields) {
    const value = params.get(field.key);
    if (value !== null) source[field.key] = value;
  }
  for (const key of ["scrim", "topicHeading", "regions"]) {
    const value = params.get(key);
    if (value !== null) source[key] = value;
  }
  return clampAdjustments(source);
}

/** Serialises adjustments for a preview URL. */
export function adjustmentsToQuery(adjustments: GraphicAdjustments): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(adjustments)) {
    if (value === undefined) continue;
    params.set(key, key === "regions" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}
