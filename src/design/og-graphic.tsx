import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";

type GraphicInput = {
  topicHeading: string;
  articleTitle: string;
  imageUrl?: string;
  graphicGuidance?: string;
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
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "SavvyCyberKidsGraphicRenderer/1.0",
        Referer: `${parsed.origin}/`
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return undefined;
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    const detectedMime = mimeType.startsWith("image/") ? mimeType : detectImageMime(bytes);
    if (!detectedMime) return undefined;
    return `data:${detectedMime};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function detectImageMime(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
}

function Logo({ src }: { src: string }) {
  return <img src={src} alt="Savvy Cyber Kids" width={canvaTemplate.layout.logoWidth} height={canvaTemplate.layout.logoHeight} style={{ position: "absolute", top: canvaTemplate.layout.logoTop, right: canvaTemplate.layout.logoRight, width: canvaTemplate.layout.logoWidth, height: canvaTemplate.layout.logoHeight, objectFit: "contain" }} />;
}

type TitleWord = { text: string; start: number; end: number };
type TitleLine = { text: string; start: number; end: number };

const titleMaxWidth = 820;
// Keep every element inside a safe inset from the black panel. The panel starts
// lower on the canvas so the source image remains the visual anchor.
const blackBoxTop = 700;
const blackBoxBottom = 1350;
const blackBoxPaddingTop = 48;
const blackBoxPaddingBottom = 64;
const titleMaxHeight = blackBoxBottom - blackBoxTop - blackBoxPaddingTop - blackBoxPaddingBottom - 100;
const titleAreaHeight = 430;

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

function titleFit(title: string, highlight: string, guidance?: string, maxWidth = titleMaxWidth) {
  const normalizedTitle = title.trim().toUpperCase();
  const highlightStart = normalizedTitle.indexOf(highlight.trim().toUpperCase());
  const highlightEnd = highlightStart >= 0 ? highlightStart + highlight.trim().length : -1;

  // Start large enough to use the available black-box area for short titles,
  // then step down only when wrapping would exceed the real dimensions.
  const guidanceText = guidance?.toLowerCase() || "";
  const requestedScale = /smaller|reduce|less text|fit|overlap/.test(guidanceText) ? 0.88 : 1;
  const lineSpacing = /spacing|space out|breathing room|separate/.test(guidanceText) ? 1.14 : 1.06;
  for (let fontSize = Math.round(132 * requestedScale); fontSize >= 22; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * lineSpacing);
    const lines = wrapTitle(normalizedTitle, fontSize, maxWidth);
    if (lines.length * lineHeight <= titleMaxHeight) return { fontSize, lineHeight, lines, highlightStart, highlightEnd };
  }

  const fontSize = 22;
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
  return Math.max(20, Math.min(36, Math.round(900 / Math.max(heading.length, 12))));
}

function graphicLayout(guidance?: string) {
  const text = guidance?.toLowerCase() || "";
  const saferLayout = /safer_layout|safe layout|avoid overlap|no overlap|fix cut|prevent cut|question[\s-]?mark|punctuation/.test(text);
  const softenBlack = /remove (the )?black|less black|no black|blend (the )?(black|dark)|soften (the )?(black|dark)|blend (the )?space/.test(text);
  const sourceArtwork = /contain_image|contain image|keep (all )?(source )?text visible|source (text|banner)|existing (text|banner|logo)|banner|logo/.test(text);
  return {
    imageFit: /crop|fill|zoom in|close[- ]?up/.test(text) && !/contain|keep visible|no crop|full image|text|banner/.test(text) ? "cover" as const : "contain" as const,
    imagePosition: /bottom/.test(text) ? "center bottom" : "center top",
    titleWidth: saferLayout ? 780 : titleMaxWidth,
    imageStageHeight: canvaTemplate.height,
    panelBackground: softenBlack
      ? "linear-gradient(to bottom, rgba(5,19,34,0.14) 0%, rgba(5,19,34,0.34) 24%, rgba(5,19,34,0.72) 58%, rgba(0,10,20,0.9) 100%)"
      : sourceArtwork
        ? "linear-gradient(to bottom, rgba(5,19,34,0.62) 0%, rgba(5,19,34,0.86) 18%, rgba(5,19,34,0.96) 52%, rgba(0,10,20,0.99) 100%)"
        : "linear-gradient(to bottom, rgba(5,19,34,0.78) 0%, rgba(5,19,34,0.9) 18%, rgba(5,19,34,0.96) 52%, rgba(0,10,20,0.99) 100%)"
  } as const;
}

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
  const layout = graphicLayout(input.graphicGuidance);
  const scaledTitle = titleFit(input.articleTitle, highlight, input.graphicGuidance, layout.titleWidth);

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
        {imageSource ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0b3558 0%, #123f63 52%, #061c31 100%)" }}><img src={imageSource} alt="" width={canvaTemplate.width} height={canvaTemplate.height} style={{ position: "relative", width: canvaTemplate.width, height: canvaTemplate.height, objectFit: layout.imageFit, objectPosition: layout.imagePosition }} /></div> : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: canvaTemplate.colors.darkBlue, color: "rgba(255,255,255,0.82)", fontFamily: canvaTemplate.layout.fontFace, fontSize: 28, letterSpacing: 3 }}>IMAGE UNAVAILABLE</div>}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 820,
            backgroundImage: layout.panelBackground
          }}
        />
        <Logo src={logoData} />
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            top: blackBoxTop + blackBoxPaddingTop,
            bottom: blackBoxPaddingBottom,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start"
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.96)", fontFamily: canvaTemplate.layout.fontFace, fontSize: headingScale(heading), fontWeight: canvaTemplate.fontWeights.bold, letterSpacing: 2.5, textAlign: "center", marginBottom: 22, padding: "0 20px", whiteSpace: "nowrap", overflow: "hidden", maxWidth: 980 }}>
            {heading}
          </div>
          <div style={{ width: 860, height: 3, background: canvaTemplate.layout.dividerColor, marginBottom: 28 }} />
          <div style={{ width: "100%", height: titleAreaHeight, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", fontFamily: canvaTemplate.layout.fontFace, fontSize: scaledTitle.fontSize, fontWeight: canvaTemplate.fontWeights.bold, lineHeight: `${scaledTitle.lineHeight}px`, textTransform: "uppercase", maxWidth: layout.titleWidth, padding: "0 12px", overflow: "hidden" }}>
            {scaledTitle.lines.map((line) => <div key={`${line.start}-${line.end}`} style={{ display: "flex", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", width: "100%" }}>{lineSegments(line, scaledTitle.highlightStart, scaledTitle.highlightEnd).map((segment, index) => <span key={`${line.start}-${index}`} style={{ color: segment.highlighted ? canvaTemplate.colors.lightBlue : canvaTemplate.colors.white, whiteSpace: "pre" }}>{segment.text}</span>)}</div>)}
          </div>
        </div>
      </div>
    ),
    {
      width: canvaTemplate.width,
      height: canvaTemplate.height,
      fonts: [
        { name: canvaTemplate.fonts.primary, data: regularFont, weight: canvaTemplate.fontWeights.regular },
        { name: canvaTemplate.fonts.primary, data: mediumFont, weight: canvaTemplate.fontWeights.medium },
        { name: canvaTemplate.fonts.primary, data: semiBoldFont, weight: canvaTemplate.fontWeights.semiBold },
        { name: canvaTemplate.fonts.primary, data: boldFont, weight: canvaTemplate.fontWeights.bold }
      ]
    }
  );
}
