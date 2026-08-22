import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";
import { GraphicIntent, parseGraphicIntent, defaultTitleWidth } from "./graphic-intent";
import { GraphicAdjustments } from "./graphic-adjustments";

type GraphicInput = {
  topicHeading: string;
  articleTitle: string;
  imageUrl?: string;
  graphicGuidance?: string;
  sourceImageHasText?: boolean;
  adjustments?: GraphicAdjustments;
};

async function loadLogo() {
  const logo = await readFile(path.join(process.cwd(), "public/branding/sck-logo-150.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}

async function loadFont(name: string) {
  const font = await readFile(path.join(process.cwd(), "public/fonts", name));
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
}

async function resolveImageSource(imageUrl: string | undefined, zoom: number) {
  if (!imageUrl) return undefined;
  try {
    const parsed = new URL(imageUrl.replaceAll("&amp;", "&"));
    if (parsed.protocol === "data:" && parsed.pathname.startsWith("image/")) return imageUrl;
    if (!["http:", "https:"].includes(parsed.protocol) || /^(localhost|127\.|0\.0\.0\.0|::1|169\.254\.)/i.test(parsed.hostname)) return undefined;
    const response = await fetch(parsed, {
      headers: {
        // Satori decodes PNG, JPEG and GIF only. Advertising webp/avif here is
        // what made news CDNs hand back a webp that the renderer then choked
        // on ("u2 is not iterable"), taking the whole graphic route down.
        Accept: "image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.5",
        "User-Agent": "SavvyCyberKidsGraphicRenderer/1.0",
        Referer: `${parsed.origin}/`
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return undefined;
    const headerMime = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    // Trust the bytes over the header: a wrong content-type is exactly how an
    // undecodable image reaches Satori.
    const detectedMime = detectImageMime(bytes) || (headerMime.startsWith("image/") ? headerMime : undefined);
    if (!detectedMime) return undefined;
    const usable = renderableMimes.has(detectedMime) ? { bytes, mime: detectedMime } : await transcodeToPng(bytes);
    if (!usable) return undefined;
    // A full-frame crop is what objectFit:"cover" already does, so leave the
    // default path untouched and only reach for sharp when a partial crop is
    // actually requested.
    const framed = zoom >= 1 ? usable : await cropTowardFrame(usable, zoom);
    return `data:${framed.mime};base64,${framed.bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

// Formats Satori can rasterise directly.
const renderableMimes = new Set(["image/png", "image/jpeg", "image/gif"]);

function detectImageMime(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" && /^(avif|avis|mif1|heic|heix|hevc)$/.test(bytes.subarray(8, 12).toString("ascii"))) return "image/avif";
  return undefined;
}

type UsableImage = { bytes: Buffer; mime: string };

// Some hosts ignore the Accept header and return a format Satori cannot read.
async function transcodeToPng(bytes: Buffer): Promise<UsableImage | undefined> {
  try {
    const sharp = (await import("sharp")).default;
    return { bytes: await sharp(bytes).png().toBuffer(), mime: "image/png" };
  } catch {
    return undefined;
  }
}

const frameRatio = canvaTemplate.width / canvaTemplate.height;

/**
 * The largest centred crop whose aspect ratio sits `zoom` of the way from the
 * source's own ratio toward the 4:5 frame. Satori's objectFit is all-or-nothing,
 * so a partial crop has to be baked into the pixels before rendering.
 *
 * At zoom 1 the result is exactly the frame ratio (a full-bleed crop); at zoom 0
 * the source is returned untouched.
 */
export function cropRectForZoom(width: number, height: number, zoom: number) {
  const sourceRatio = width / height;
  const targetRatio = sourceRatio + zoom * (frameRatio - sourceRatio);
  const cropWidth = sourceRatio > targetRatio ? Math.round(height * targetRatio) : width;
  const cropHeight = sourceRatio > targetRatio ? height : Math.round(width / targetRatio);
  return {
    width: Math.max(1, Math.min(width, cropWidth)),
    height: Math.max(1, Math.min(height, cropHeight)),
    left: Math.max(0, Math.round((width - Math.min(width, cropWidth)) / 2)),
    top: Math.max(0, Math.round((height - Math.min(height, cropHeight)) / 2))
  };
}

async function cropTowardFrame(image: UsableImage, zoom: number): Promise<UsableImage> {
  try {
    const sharp = (await import("sharp")).default;
    const { width, height } = await sharp(image.bytes).metadata();
    if (!width || !height) return image;
    const rect = cropRectForZoom(width, height, zoom);
    if (rect.width === width && rect.height === height) return image;
    return { bytes: await sharp(image.bytes).extract(rect).png().toBuffer(), mime: "image/png" };
  } catch {
    // Without sharp the caller still renders, just with the untouched source.
    return image;
  }
}

function Logo({ src }: { src: string }) {
  return <img src={src} alt="Savvy Cyber Kids" width={canvaTemplate.layout.logoWidth} height={canvaTemplate.layout.logoHeight} style={{ position: "absolute", top: canvaTemplate.layout.logoTop, right: canvaTemplate.layout.logoRight, width: canvaTemplate.layout.logoWidth, height: canvaTemplate.layout.logoHeight, objectFit: "contain" }} />;
}

type TitleWord = { text: string; start: number; end: number };
type TitleLine = { text: string; start: number; end: number };

// One source of truth for the lower-third composition. Every constant below is
// derived from the canvas so the gradient, the text box, and the fitting loop
// can never drift apart: a mismatch here is what let the overlay start 170px
// above the text block and clip the last headline line.
const canvasHeight = canvaTemplate.height;
const sideInset = 56;
// The scrim begins here fully transparent and only reaches full strength at the
// very bottom. It must never start at a visible alpha or it reads as a box.
const defaultScrimTop = 560;
const defaultTextTop = 900;
const textBottomInset = 72;
const headingFontMax = 36;
const headingGap = 22;
const dividerHeight = 3;
const dividerGap = 26;
const headingBlockHeight = headingFontMax + headingGap + dividerHeight + dividerGap;
const titleMaxWidth = defaultTitleWidth;

/**
 * Spacing is adjustable per post, so it is derived here rather than frozen at
 * module scope. titleAreaHeight stays tied to textTop, which is what keeps the
 * fitting loop and the rendered box in agreement however far the text moves.
 */
function composition(adjustments?: GraphicAdjustments) {
  const scrimTop = adjustments?.scrimTop ?? defaultScrimTop;
  const textTop = adjustments?.textTop ?? defaultTextTop;
  return {
    scrimTop,
    textTop,
    // Never let the headline box collapse to nothing, however the sliders are set.
    titleAreaHeight: Math.max(80, canvasHeight - textBottomInset - textTop - headingBlockHeight)
  };
}

function estimatedWidth(text: string, fontSize: number) {
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

function wrapTitle(title: string, fontSize: number, maxWidth = titleMaxWidth): TitleLine[] {
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

function titleFit(title: string, highlight: string, intent: GraphicIntent, titleAreaHeight: number, maxWidth = titleMaxWidth) {
  // Collapse internal whitespace first: the highlight offsets and the line
  // slices are both taken from this string, so normalising once keeps the
  // coloured segment aligned and avoids double spaces at a segment boundary.
  const normalizedTitle = title.trim().replace(/\s+/g, " ").toUpperCase();
  const normalizedHighlight = highlight.trim().replace(/\s+/g, " ").toUpperCase();
  const highlightStart = normalizedHighlight ? normalizedTitle.indexOf(normalizedHighlight) : -1;
  const highlightEnd = highlightStart >= 0 ? highlightStart + normalizedHighlight.length : -1;

  const { titleScale: requestedScale, lineSpacing } = intent;
  for (let fontSize = Math.round(132 * requestedScale); fontSize >= 24; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * lineSpacing);
    const lines = wrapTitle(normalizedTitle, fontSize, maxWidth);
    // Height alone is not enough. wrapTitle cannot break a single word, so one
    // long word ("CYBERSECURITY") stays on its own oversized line and runs off
    // the canvas. Require every line to fit horizontally too.
    const widthFits = lines.every((line) => estimatedWidth(line.text, fontSize) <= maxWidth);
    if (lines.length * lineHeight <= titleAreaHeight && widthFits) return { fontSize, lineHeight, lines, highlightStart, highlightEnd };
  }

  const fontSize = 24;
  return { fontSize, lineHeight: Math.round(fontSize * lineSpacing), lines: wrapTitle(normalizedTitle, fontSize, maxWidth), highlightStart, highlightEnd };
}

function lineSegments(line: TitleLine, highlightStart: number, highlightEnd: number) {
  if (highlightStart < 0 || highlightEnd <= line.start || highlightStart >= line.end) return [{ text: line.text, highlighted: false }];
  const start = Math.max(highlightStart, line.start) - line.start;
  const end = Math.min(highlightEnd, line.end) - line.start;
  return [
    ...(start ? [{ text: line.text.slice(0, start), highlighted: false }] : []),
    { text: line.text.slice(start, end), highlighted: true },
    ...(end < line.text.length ? [{ text: line.text.slice(end), highlighted: false }] : [])
  ];
}

function headingScale(heading: string) {
  return Math.max(24, Math.min(headingFontMax, Math.round(980 / Math.max(heading.length, 12))));
}

// Sits behind a contained image, where the photo does not reach the edges.
const brandGround = "linear-gradient(160deg, #0a3151 0%, #072541 52%, #04182a 100%)";

// Every ramp starts fully transparent. The variants change how fast the scrim
// deepens, never whether it begins with a hard edge.
const scrimRamps = {
  light: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 34%, rgba(0,0,0,0.26) 54%, rgba(3,14,26,0.62) 76%, rgba(3,14,26,0.86) 100%)",
  default: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.38) 46%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.96) 100%)",
  heavy: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(5,19,34,0.24) 26%, rgba(5,19,34,0.58) 46%, rgba(5,19,34,0.9) 72%, rgba(3,14,26,0.98) 100%)"
} as const;

export async function renderTemplateGraphic(input: GraphicInput) {
  const intent = parseGraphicIntent(input.graphicGuidance, input.sourceImageHasText, input.adjustments);
  const layout = composition(input.adjustments);
  const [logoData, imageSource, regularFont, mediumFont, semiBoldFont, boldFont] = await Promise.all([
    loadLogo(),
    resolveImageSource(input.imageUrl, intent.zoom),
    loadFont("Asap-Regular.ttf"),
    loadFont("Asap-Medium.ttf"),
    loadFont("Asap-SemiBold.ttf"),
    loadFont("Asap-Bold.ttf")
  ]);
  const { highlight } = highlightedTitleParts(input.articleTitle);
  const heading = input.topicHeading.toUpperCase();
  const scaledTitle = titleFit(input.articleTitle, highlight, intent, layout.titleAreaHeight, intent.titleWidth);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: canvaTemplate.colors.black,
          fontFamily: canvaTemplate.layout.fontFace
        }}
      >
        {imageSource ? (
          // A contained image leaves space above and below it. Filling that with
          // a zoomed copy of the same photo reads as a rendering mistake — the
          // artwork appears twice, once ghosted. Use a plain brand ground so the
          // uncropped image sits in a deliberate frame instead.
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: brandGround }}>
            <img src={imageSource} alt="" width={canvaTemplate.width} height={canvasHeight} style={{ position: "relative", width: canvaTemplate.width, height: canvasHeight, objectFit: intent.fit, objectPosition: intent.focus }} />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: canvaTemplate.colors.darkBlue, color: "rgba(255,255,255,0.82)", fontFamily: canvaTemplate.layout.fontFace, fontSize: 28, letterSpacing: 3 }}>IMAGE UNAVAILABLE</div>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: layout.scrimTop,
            bottom: 0,
            backgroundImage: scrimRamps[intent.scrim]
          }}
        />
        <Logo src={logoData} />
        <div
          style={{
            position: "absolute",
            left: sideInset,
            right: sideInset,
            top: layout.textTop,
            bottom: textBottomInset,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start"
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.96)", fontFamily: canvaTemplate.layout.fontFace, fontSize: headingScale(heading), fontWeight: canvaTemplate.fontWeights.bold, letterSpacing: 2.5, textAlign: "center", marginBottom: headingGap, padding: "0 20px" }}>
            {heading}
          </div>
          <div style={{ width: 860, height: dividerHeight, background: canvaTemplate.layout.dividerColor, marginBottom: dividerGap }} />
          <div style={{ width: "100%", height: layout.titleAreaHeight, display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "center", fontFamily: canvaTemplate.layout.fontFace, fontSize: scaledTitle.fontSize, fontWeight: canvaTemplate.fontWeights.bold, lineHeight: `${scaledTitle.lineHeight}px`, textTransform: "uppercase", maxWidth: intent.titleWidth, padding: "0 12px" }}>
            {scaledTitle.lines.map((line) => <div key={`${line.start}-${line.end}`} style={{ display: "flex", justifyContent: "center", width: "100%" }}>{lineSegments(line, scaledTitle.highlightStart, scaledTitle.highlightEnd).map((segment, index) => <span key={`${line.start}-${index}`} style={{ color: segment.highlighted ? canvaTemplate.colors.lightBlue : canvaTemplate.colors.white, whiteSpace: "pre-wrap" }}>{segment.text}</span>)}</div>)}
          </div>
        </div>
      </div>
    ),
    {
      width: canvaTemplate.width,
      height: canvasHeight,
      fonts: [
        { name: canvaTemplate.fonts.primary, data: regularFont, weight: canvaTemplate.fontWeights.regular },
        { name: canvaTemplate.fonts.primary, data: mediumFont, weight: canvaTemplate.fontWeights.medium },
        { name: canvaTemplate.fonts.primary, data: semiBoldFont, weight: canvaTemplate.fontWeights.semiBold },
        { name: canvaTemplate.fonts.primary, data: boldFont, weight: canvaTemplate.fontWeights.bold }
      ]
    }
  );
}
