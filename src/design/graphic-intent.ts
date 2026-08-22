import { GraphicAdjustments } from "./graphic-adjustments";

// Reviewer feedback and model guidance both arrive here as free text. The
// renderer used to test that text against a handful of regexes written one at a
// time, so most natural phrasings — including the review page's own preset
// buttons — matched nothing and were silently dropped. Parsing happens once,
// in one place, and is covered by tests so a new phrasing cannot rot away.

export type GraphicIntent = {
  /**
   * How much of the 4:5 canvas the photo is allowed to fill, from 0 to 1.
   * 1 crops the source to the full frame (the house style). 0 shows the whole
   * source untouched. Values between crop part of the way, which is what a
   * reviewer means by "zoom out a tad": a wide news banner contained outright
   * only fills about 42% of the canvas height and looks weak.
   */
  zoom: number;
  /** Fallback framing when the image cannot be pre-cropped. */
  fit: "cover" | "contain";
  /** Vertical anchor passed to object-position. */
  focus: string;
  /** How hard the bottom scrim darkens the photo. */
  scrim: "light" | "default" | "heavy";
  /** Multiplier applied to the starting headline size. */
  titleScale: number;
  /** Headline line-height multiplier. */
  lineSpacing: number;
  /** Narrower wrapping width for layouts that keep clipping. */
  titleWidth: number;
};

export const defaultTitleWidth = 900;
export const saferTitleWidth = 840;

// "Show me the whole picture." Includes the review page presets and the way
// reviewers actually describe a cropped banner ("breaking news is cut off").
// "zoom out", but also "zoom the image out" and "zoom it out a tad": the
// particle is regularly separated from the verb, and requiring them to be
// adjacent silently dropped the instruction.
const zoomOutPhrase = String.raw`\bzoom(?:ing|ed)?\b(?:\s+\w+){0,3}\s+out\b`;
const zoomInPhrase = String.raw`\bzoom(?:ing|ed)?\b(?:\s+\w+){0,3}\s+in\b`;
const showFullImage = new RegExp(`${zoomOutPhrase}|show (?:the )?(?:full|whole|entire)|full subject|(?:whole|entire) (?:image|graphic|picture|photo|frame)|cut[\\s-]?off|getting cropped|being cropped|do(?:n'?t| not) crop|no crop|avoid crop|without crop|contain[_ ]image|keep (?:all )?(?:source )?text visible|fit the (?:whole|entire|full)|(?:fully|entirely|all of it) visible|(?:image|logo|banner|text) is visible`, "i");
// An explicit request to crop in wins over the above.
const zoomIn = new RegExp(`${zoomInPhrase}|close[\\s-]?up|crop (?:in|tighter)|tighter crop|fill the frame`, "i");
// "A tad", "a little", "slightly" — a request for some of the adjustment, not
// all of it. Treating these as a full zoom-out is what produced a postage-stamp
// image floating in empty navy.
const byDegrees = /\b(?:a (?:little|bit|tad|touch|smidge)|a tiny bit|tiny bit|slightly|slight|somewhat|just a (?:tad|little|bit)|not too (?:much|far)|a bit)\b/i;

// The scrim is the single most complained-about element, so it accepts the
// widest vocabulary: any "less of it" verb near any name for the dark area, or
// any complaint that the dark area is obscuring the photo.
const lightScrim = /\b(?:remove|reduce|shrink|lighten|soften|blend|less|fewer|no|smaller|drop|lose|kill|minimi[sz]e)\b[^.]{0,28}\b(?:black|dark|panel|box|overlay|scrim|gradient|bar)\b|\b(?:black|dark)\s*(?:box|panel|bar|overlay|area)\b[^.]{0,40}\b(?:cover|hid|block|obscur|too much|everything)/i;
// Both word orders: "more contrast" and "the black gradient more visible".
const heavyScrim = /\b(?:more|increase|stronger|darker|deepen)\b[^.]{0,28}\b(?:contrast|overlay|scrim|dark|shade|gradient)\b|\b(?:black|dark|gradient|overlay|scrim|panel)\b[^.]{0,28}\b(?:more|stronger|darker|deeper|heavier|visible|visable)\b|hard to read|difficult to read|illegible|can(?:'?t| not) read|unreadable/i;

const smallerTitle = /\bsmaller\b|reduce (?:the )?(?:headline|title|text|copy)|shrink (?:the )?(?:headline|title|text)|less text|too (?:big|large|long)|\boverlap/i;
const looserSpacing = /\bspacing\b|space (?:it )?out|breathing room|\bseparate\b|cramped|too tight|crowded/i;
const saferLayout = /safer[_ ]layout|safe layout|avoid overlap|no overlap|fix cut|prevent cut|question[\s-]?mark|punctuation/i;

/** Crop part of the way: enough to stop the image looking lost, not so much that edge content goes. */
export const partialZoom = 0.55;

/**
 * @param sourceImageHasText the source is a designed graphic (banner, title
 * card, infographic) whose own words would be destroyed by a crop. Detected
 * by the vision model at generation time.
 * @param adjustments manual overrides from the editor. A reviewer who has moved
 * a slider has said exactly what they want, so these beat anything inferred
 * from the guidance text.
 */
export function parseGraphicIntent(guidance?: string, sourceImageHasText?: boolean, adjustments?: GraphicAdjustments): GraphicIntent {
  const text = guidance?.trim() || "";
  const wantsFullImage = showFullImage.test(text) || Boolean(sourceImageHasText);
  const wantsCrop = zoomIn.test(text);
  // "Zoom out a tad", and also "zoom in but keep it all visible" — both ask for
  // a middle setting rather than either extreme.
  const wantsPartial = (wantsFullImage && byDegrees.test(text)) || (wantsCrop && wantsFullImage);

  // Full-bleed is the house style, so a full crop stays the default. A reviewer
  // asking to see the whole frame overrides it, an explicit crop request
  // overrides that, and a hedged request lands between the two.
  const inferredZoom = wantsPartial ? partialZoom : wantsCrop ? 1 : wantsFullImage ? 0 : 1;
  const zoom = adjustments?.zoom ?? inferredZoom;

  return {
    zoom,
    fit: zoom >= 1 ? "cover" : "contain",
    // A partially cropped image does not reach the bottom of the canvas, so
    // bleed it off the top edge: that leaves a single transition, at the
    // bottom, where the scrim already fades the photo into the headline. Left
    // floating it gains a second hard seam along the top.
    // Both axes: a wide image cropped to the frame only moves horizontally, so a
    // vertical-only anchor left half the dragging inert.
    focus: adjustments?.focusX !== undefined || adjustments?.focusY !== undefined
      ? `${adjustments.focusX ?? 50}% ${adjustments.focusY ?? 50}%`
      : /\bbottom\b/i.test(text) ? "center bottom" : zoom < 1 ? "center top" : "center 24%",
    scrim: adjustments?.scrim ?? (lightScrim.test(text) ? "light" : heavyScrim.test(text) ? "heavy" : "default"),
    titleScale: adjustments?.titleScale ?? (smallerTitle.test(text) ? 0.88 : 1),
    lineSpacing: adjustments?.lineSpacing ?? (looserSpacing.test(text) ? 1.14 : 1.06),
    titleWidth: saferLayout.test(text) ? saferTitleWidth : defaultTitleWidth
  };
}
