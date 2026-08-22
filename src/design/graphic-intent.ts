// Reviewer feedback and model guidance both arrive here as free text. The
// renderer used to test that text against a handful of regexes written one at a
// time, so most natural phrasings — including the review page's own preset
// buttons — matched nothing and were silently dropped. Parsing happens once,
// in one place, and is covered by tests so a new phrasing cannot rot away.

export type GraphicIntent = {
  /** "contain" shows the whole source frame; "cover" fills the 4:5 canvas. */
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
const showFullImage = /zoom(?:ing|ed)?\s*out|show (?:the )?(?:full|whole|entire)|full subject|(?:whole|entire) (?:image|graphic|picture|photo|frame)|cut[\s-]?off|getting cropped|being cropped|do(?:n'?t| not) crop|no crop|avoid crop|without crop|contain[_ ]image|keep (?:all )?(?:source )?text visible|fit the (?:whole|entire|full)/i;
// An explicit request to crop in wins over the above.
const zoomIn = /zoom(?:ing|ed)?\s*in|close[\s-]?up|crop (?:in|tighter)|tighter crop|fill the frame/i;

// The scrim is the single most complained-about element, so it accepts the
// widest vocabulary: any "less of it" verb near any name for the dark area, or
// any complaint that the dark area is obscuring the photo.
const lightScrim = /\b(?:remove|reduce|shrink|lighten|soften|blend|less|fewer|no|smaller|drop|lose|kill|minimi[sz]e)\b[^.]{0,28}\b(?:black|dark|panel|box|overlay|scrim|gradient|bar)\b|\b(?:black|dark)\s*(?:box|panel|bar|overlay|area)\b[^.]{0,40}\b(?:cover|hid|block|obscur|too much|everything)/i;
const heavyScrim = /\b(?:more|increase|stronger|darker|deepen)\b[^.]{0,28}\b(?:contrast|overlay|scrim|dark|shade)\b|hard to read|difficult to read|illegible|can(?:'?t| not) read|unreadable/i;

const smallerTitle = /\bsmaller\b|reduce (?:the )?(?:headline|title|text|copy)|shrink (?:the )?(?:headline|title|text)|less text|too (?:big|large|long)|\boverlap/i;
const looserSpacing = /\bspacing\b|space (?:it )?out|breathing room|\bseparate\b|cramped|too tight|crowded/i;
const saferLayout = /safer[_ ]layout|safe layout|avoid overlap|no overlap|fix cut|prevent cut|question[\s-]?mark|punctuation/i;

export function parseGraphicIntent(guidance?: string): GraphicIntent {
  const text = guidance?.trim() || "";
  const wantsFullImage = showFullImage.test(text);
  const wantsCrop = zoomIn.test(text);

  return {
    // Full-bleed is the house style, so "cover" stays the default. A reviewer
    // asking to see the whole frame is the one thing that overrides it, and an
    // explicit crop request overrides that in turn.
    fit: wantsCrop ? "cover" : wantsFullImage ? "contain" : "cover",
    focus: /\bbottom\b/i.test(text) ? "center bottom" : "center 24%",
    scrim: lightScrim.test(text) ? "light" : heavyScrim.test(text) ? "heavy" : "default",
    titleScale: smallerTitle.test(text) ? 0.88 : 1,
    lineSpacing: looserSpacing.test(text) ? 1.14 : 1.06,
    titleWidth: saferLayout.test(text) ? saferTitleWidth : defaultTitleWidth
  };
}
