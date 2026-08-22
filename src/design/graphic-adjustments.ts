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
};

export type SliderField = {
  key: "zoom" | "focusY" | "scrimTop" | "textTop" | "titleScale" | "lineSpacing";
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
  { key: "focusY", label: "Image position", hint: "Which part of the image stays in frame", min: 0, max: 100, step: 1, displayScale: 1, unit: "%" },
  { key: "scrimTop", label: "Fade starts at", hint: "Where the dark gradient begins", min: 200, max: 1100, step: 10, displayScale: 1, unit: "px" },
  { key: "textTop", label: "Text starts at", hint: "Where the heading and headline sit", min: 600, max: 1100, step: 10, displayScale: 1, unit: "px" },
  { key: "titleScale", label: "Headline size", hint: "Scales the headline up or down", min: 0.6, max: 1.2, step: 0.01, displayScale: 100, unit: "%" },
  { key: "lineSpacing", label: "Line spacing", hint: "Space between headline lines", min: 1, max: 1.4, step: 0.01, displayScale: 100, unit: "%" }
];

export const scrimOptions: ScrimStrength[] = ["light", "default", "heavy"];

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

  return Object.keys(adjustments).length ? adjustments : undefined;
}

/** Reads adjustments off a preview URL's query string. */
export function adjustmentsFromParams(params: URLSearchParams): GraphicAdjustments | undefined {
  const source: Record<string, string> = {};
  for (const field of sliderFields) {
    const value = params.get(field.key);
    if (value !== null) source[field.key] = value;
  }
  const scrim = params.get("scrim");
  if (scrim !== null) source.scrim = scrim;
  return clampAdjustments(source);
}

/** Serialises adjustments for a preview URL. */
export function adjustmentsToQuery(adjustments: GraphicAdjustments): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(adjustments)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}
