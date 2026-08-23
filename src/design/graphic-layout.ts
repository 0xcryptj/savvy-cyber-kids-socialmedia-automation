// Every measurement the graphic is built from, in one isomorphic module.
//
// Two things draw this layout: the Satori renderer that produces the real PNG,
// and the browser preview in the editor. A preview that recomputes the geometry
// itself is how a preview and its output drift apart — this codebase already
// lost a week to a version of that, where the panel was described by one
// constant and drawn from another. So neither side owns any of it. Both import
// from here, and the golden-file check in scripts/graphics-baseline.mjs guards
// the server side.
//
// Nothing here may touch fs, sharp, or the DOM: it runs on both sides.

import { canvaTemplate } from "@/config/template";
import { GraphicAdjustments, ScrimStrength } from "./graphic-adjustments";

export const canvasWidth = canvaTemplate.width;
export const canvasHeight = canvaTemplate.height;
export const frameRatio = canvasWidth / canvasHeight;

export const sideInset = 56;
export const defaultScrimTop = 560;
export const defaultTextTop = 900;
export const textBottomInset = 72;
export const headingFontMax = 36;
export const headingGap = 22;
export const dividerHeight = 3;
export const dividerGap = 26;
export const dividerWidth = 860;
export const headingBlockHeight = headingFontMax + headingGap + dividerHeight + dividerGap;
export const minTitleAreaHeight = 80;
export const maxTitleFontSize = 132;
export const minTitleFontSize = 24;

/** Sits behind an image that does not reach the frame edges. */
export const brandGround = "linear-gradient(160deg, #0a3151 0%, #072541 52%, #04182a 100%)";

// Every ramp starts fully transparent. The variants change how fast the scrim
// deepens, never whether it begins with a hard edge.
export const scrimRamps: Record<ScrimStrength, string> = {
  light: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 34%, rgba(0,0,0,0.26) 54%, rgba(3,14,26,0.62) 76%, rgba(3,14,26,0.86) 100%)",
  default: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.38) 46%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.96) 100%)",
  heavy: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(5,19,34,0.24) 26%, rgba(5,19,34,0.58) 46%, rgba(5,19,34,0.9) 72%, rgba(3,14,26,0.98) 100%)"
};

/** Satori has no colour-mix, so build the rgba string directly. */
export function withOpacity(hex: string, opacity: number) {
  const value = hex.replace("#", "");
  const channel = (start: number) => parseInt(value.slice(start, start + 2), 16) || 0;
  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${Math.min(1, Math.max(0, opacity))})`;
}

/**
 * Spacing is adjustable per post, so it is derived rather than frozen.
 * titleAreaHeight stays tied to textTop, which is what keeps the fitting loop
 * and the rendered box in agreement however far the text moves.
 */
export function composition(adjustments?: GraphicAdjustments) {
  const scrimTop = adjustments?.scrimTop ?? defaultScrimTop;
  const textTop = adjustments?.textTop ?? defaultTextTop;
  return {
    scrimTop,
    textTop,
    titleAreaHeight: Math.max(minTitleAreaHeight, canvasHeight - textBottomInset - textTop - headingBlockHeight)
  };
}

/**
 * The largest centred crop whose aspect ratio sits `zoom` of the way from the
 * source's own ratio toward the 4:5 frame. At zoom 1 the result is exactly the
 * frame ratio (a full-bleed crop); at zoom 0 the source is untouched.
 */
export function cropRectForZoom(width: number, height: number, zoom: number, focusX = 50, focusY = 50) {
  const sourceRatio = width / height;
  const targetRatio = sourceRatio + zoom * (frameRatio - sourceRatio);
  const cropWidth = Math.max(1, Math.min(width, sourceRatio > targetRatio ? Math.round(height * targetRatio) : width));
  const cropHeight = Math.max(1, Math.min(height, sourceRatio > targetRatio ? height : Math.round(width / targetRatio)));
  // The focus decides which slice survives, so dragging a wide banner sideways
  // moves the crop rather than doing nothing.
  return {
    width: cropWidth,
    height: cropHeight,
    left: Math.max(0, Math.min(width - cropWidth, Math.round((width - cropWidth) * (focusX / 100)))),
    top: Math.max(0, Math.min(height - cropHeight, Math.round((height - cropHeight) * (focusY / 100))))
  };
}

/**
 * Where to put the whole source image, in canvas units, so that the crop chosen
 * above lands exactly where the server places it.
 *
 * The server crops the pixels and lets objectFit finish the job. The browser
 * cannot crop pixels, so it positions the untouched image inside an
 * overflow-hidden frame instead. Both describe the same rectangle, which is why
 * this function is the one that has to agree.
 */
export function imagePlacement(sourceWidth: number, sourceHeight: number, zoom: number, focusX = 50, focusY = 50) {
  const crop = cropRectForZoom(sourceWidth, sourceHeight, zoom, focusX, focusY);
  const scale = Math.min(canvasWidth / crop.width, canvasHeight / crop.height);
  const freeX = canvasWidth - crop.width * scale;
  const freeY = canvasHeight - crop.height * scale;
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    left: freeX * (focusX / 100) - crop.left * scale,
    top: freeY * (focusY / 100) - crop.top * scale
  };
}

/**
 * How far the image moves, in canvas pixels, per one point of focus change.
 *
 * The sign is not fixed, which is the whole reason this exists. On an axis that
 * is being cropped, raising the focus reveals more of the far side and the image
 * slides the *opposite* way to the number. On an axis that is letterboxed, the
 * image is simply positioned in the free space and slides the *same* way. A
 * dragger that assumes one sign feels correct in one regime and inverted in the
 * other, which is exactly how it felt.
 *
 * Dividing the pointer delta by this makes the image track the pointer in both.
 * A value at or near zero means the axis has no freedom — a wide image cropped
 * to the frame cannot move vertically — and the drag on that axis is ignored.
 */
export function focusSensitivity(sourceWidth: number, sourceHeight: number, zoom: number) {
  const crop = cropRectForZoom(sourceWidth, sourceHeight, zoom, 0, 0);
  const scale = Math.min(canvasWidth / crop.width, canvasHeight / crop.height);
  return {
    x: (canvasWidth - crop.width * scale - (sourceWidth - crop.width) * scale) / 100,
    y: (canvasHeight - crop.height * scale - (sourceHeight - crop.height) * scale) / 100
  };
}

export type TitleWord = { text: string; start: number; end: number };
export type TitleLine = { text: string; start: number; end: number };

export function estimatedWidth(text: string, fontSize: number) {
  let units = 0;
  for (const character of text) units += character === " " ? 0.34 : /[A-Z0-9]/.test(character) ? 0.66 : 0.62;
  return units * fontSize;
}

function titleWords(title: string): TitleWord[] {
  return [...title.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}

export function wrapTitle(title: string, fontSize: number, maxWidth: number): TitleLine[] {
  const words = titleWords(title);
  const lines: TitleLine[] = [];
  let current: TitleWord[] = [];

  for (const word of words) {
    const candidate = [...current, word].map((item) => item.text).join(" ");
    if (current.length && estimatedWidth(candidate, fontSize) > maxWidth) {
      lines.push({ text: title.slice(current[0].start, current[current.length - 1].end), start: current[0].start, end: current[current.length - 1].end });
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) lines.push({ text: title.slice(current[0].start, current[current.length - 1].end), start: current[0].start, end: current[current.length - 1].end });
  return lines;
}

export function titleFit(title: string, highlight: string, options: { titleScale: number; lineSpacing: number; titleAreaHeight: number; maxWidth: number }) {
  // Collapse internal whitespace first: the highlight offsets and the line
  // slices are both taken from this string, so normalising once keeps the
  // coloured segment aligned and avoids double spaces at a segment boundary.
  const normalizedTitle = title.trim().replace(/\s+/g, " ").toUpperCase();
  const normalizedHighlight = highlight.trim().replace(/\s+/g, " ").toUpperCase();
  const highlightStart = normalizedHighlight ? normalizedTitle.indexOf(normalizedHighlight) : -1;
  const highlightEnd = highlightStart >= 0 ? highlightStart + normalizedHighlight.length : -1;

  for (let fontSize = Math.round(maxTitleFontSize * options.titleScale); fontSize >= minTitleFontSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * options.lineSpacing);
    const lines = wrapTitle(normalizedTitle, fontSize, options.maxWidth);
    // Height alone is not enough. wrapTitle cannot break a single word, so one
    // long word ("CYBERSECURITY") stays on its own oversized line and runs off
    // the canvas. Require every line to fit horizontally too.
    const widthFits = lines.every((line) => estimatedWidth(line.text, fontSize) <= options.maxWidth);
    if (lines.length * lineHeight <= options.titleAreaHeight && widthFits) return { fontSize, lineHeight, lines, highlightStart, highlightEnd };
  }

  return {
    fontSize: minTitleFontSize,
    lineHeight: Math.round(minTitleFontSize * options.lineSpacing),
    lines: wrapTitle(normalizedTitle, minTitleFontSize, options.maxWidth),
    highlightStart,
    highlightEnd
  };
}

export function lineSegments(line: TitleLine, highlightStart: number, highlightEnd: number) {
  if (highlightStart < 0 || highlightEnd <= line.start || highlightStart >= line.end) return [{ text: line.text, highlighted: false }];
  const start = Math.max(highlightStart, line.start) - line.start;
  const end = Math.min(highlightEnd, line.end) - line.start;
  return [
    ...(start ? [{ text: line.text.slice(0, start), highlighted: false }] : []),
    { text: line.text.slice(start, end), highlighted: true },
    ...(end < line.text.length ? [{ text: line.text.slice(end), highlighted: false }] : [])
  ];
}

export function headingScale(heading: string, scale = 1) {
  const automatic = Math.max(24, Math.min(headingFontMax, Math.round(980 / Math.max(heading.length, 12))));
  return Math.max(14, Math.round(automatic * scale));
}
