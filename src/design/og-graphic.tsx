import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";
import { GraphicIntent, parseGraphicIntent, defaultTitleWidth } from "./graphic-intent";

type GraphicInput = {
  topicHeading: string;
  articleTitle: string;
  imageUrl?: string;
  graphicGuidance?: string;
  sourceImageHasText?: boolean;
};

async function loadLogo() {
  const logo = await readFile(path.join(process.cwd(), "public/branding/sck-logo-150.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}

async function loadFont(name: string) {
  const font = await readFile(path.join(process.cwd(), "public/fonts", name));
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
}

async function resolveImageSource(imageUrl?: string) {
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
    if (renderableMimes.has(detectedMime)) return `data:${detectedMime};base64,${bytes.toString("base64")}`;
    const transcoded = await transcodeToPng(bytes);
    return transcoded ? `data:image/png;base64,${transcoded.toString("base64")}` : undefined;
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

// Some hosts ignore the Accept header. sharp ships with Next's image
// optimiser, so use it opportunistically; if it is unavailable the caller
// falls back to rendering without a photo rather than throwing.
async function transcodeToPng(bytes: Buffer): Promise<Buffer | undefined> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes).png().toBuffer();
  } catch {
    return undefined;
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
const scrimTop = 560;
const textTop = 900;
const textBottomInset = 72;
const headingFontMax = 36;
const headingGap = 22;
const dividerHeight = 3;
const dividerGap = 26;
const headingBlockHeight = headingFontMax + headingGap + dividerHeight + dividerGap;
// The fitting loop and the rendered box share this number, so a headline that
// "fits" is always a headline that is fully visible.
const titleAreaHeight = canvasHeight - textBottomInset - textTop - headingBlockHeight;
const titleMaxWidth = defaultTitleWidth;

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

function titleFit(title: string, highlight: string, intent: GraphicIntent, maxWidth = titleMaxWidth) {
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
  const [logoData, imageSource, regularFont, mediumFont, semiBoldFont, boldFont] = await Promise.all([
    loadLogo(),
    resolveImageSource(input.imageUrl),
    loadFont("Asap-Regular.ttf"),
    loadFont("Asap-Medium.ttf"),
    loadFont("Asap-SemiBold.ttf"),
    loadFont("Asap-Bold.ttf")
  ]);
  const { highlight } = highlightedTitleParts(input.articleTitle);
  const heading = input.topicHeading.toUpperCase();
  const intent = parseGraphicIntent(input.graphicGuidance, input.sourceImageHasText);
  const scaledTitle = titleFit(input.articleTitle, highlight, intent, intent.titleWidth);

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
            top: scrimTop,
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
            top: textTop,
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
          <div style={{ width: "100%", height: titleAreaHeight, display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "center", fontFamily: canvaTemplate.layout.fontFace, fontSize: scaledTitle.fontSize, fontWeight: canvaTemplate.fontWeights.bold, lineHeight: `${scaledTitle.lineHeight}px`, textTransform: "uppercase", maxWidth: intent.titleWidth, padding: "0 12px" }}>
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
