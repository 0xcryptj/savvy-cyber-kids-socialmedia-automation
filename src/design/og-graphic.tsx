import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";

type GraphicInput = {
  topicHeading: string;
  articleTitle: string;
  imageUrl?: string;
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
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return undefined;
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() || "image/jpeg";
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    const extensionLooksLikeImage = /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(parsed.pathname);
    if (!mimeType.startsWith("image/") && !extensionLooksLikeImage) return undefined;
    return `data:${mimeType.startsWith("image/") ? mimeType : "image/jpeg"};base64,${data}`;
  } catch {
    return undefined;
  }
}

function Logo({ src }: { src: string }) {
  return <img src={src} alt="Savvy Cyber Kids" width={172} height={150} style={{ position: "absolute", top: 42, right: 76, width: 172, height: 150, objectFit: "contain" }} />;
}

type TitleWord = { text: string; start: number; end: number };
type TitleLine = { text: string; start: number; end: number };

const titleMaxWidth = 930;
const titleMaxHeight = 385;

function estimatedWidth(text: string, fontSize: number) {
  let units = 0;
  for (const character of text) units += character === " " ? 0.28 : /[A-Z0-9]/.test(character) ? 0.61 : 0.5;
  return units * fontSize;
}

function titleWords(title: string): TitleWord[] {
  return [...title.matchAll(/\S+/g)].map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}

function wrapTitle(title: string, fontSize: number): TitleLine[] {
  const words = titleWords(title);
  const lines: TitleLine[] = [];
  let current: TitleWord[] = [];

  for (const word of words) {
    const candidate = [...current, word].map((item) => item.text).join(" ");
    if (current.length && estimatedWidth(candidate, fontSize) > titleMaxWidth) {
      lines.push({ text: title.slice(current[0].start, current[current.length - 1].end), start: current[0].start, end: current[current.length - 1].end });
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) lines.push({ text: title.slice(current[0].start, current[current.length - 1].end), start: current[0].start, end: current[current.length - 1].end });
  return lines;
}

function titleFit(title: string, highlight: string) {
  const normalizedTitle = title.trim().toUpperCase();
  const highlightStart = normalizedTitle.indexOf(highlight.trim().toUpperCase());
  const highlightEnd = highlightStart >= 0 ? highlightStart + highlight.trim().length : -1;

  for (let fontSize = 64; fontSize >= 28; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * 1.06);
    const lines = wrapTitle(normalizedTitle, fontSize);
    if (lines.length * lineHeight <= titleMaxHeight) return { fontSize, lineHeight, lines, highlightStart, highlightEnd };
  }

  const fontSize = 28;
  return { fontSize, lineHeight: Math.round(fontSize * 1.06), lines: wrapTitle(normalizedTitle, fontSize), highlightStart, highlightEnd };
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
  return Math.max(24, Math.min(36, Math.round(980 / Math.max(heading.length, 12))));
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
  const scaledTitle = titleFit(input.articleTitle, highlight);

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
        {imageSource ? <img src={imageSource} alt="" width={canvaTemplate.width} height={canvaTemplate.height} style={{ position: "absolute", inset: 0, width: canvaTemplate.width, height: canvaTemplate.height, objectFit: "cover" }} /> : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 700,
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 18%, rgba(0,0,0,0.68) 62%, rgba(0,0,0,0.98) 100%)"
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 250, background: "rgba(0,0,0,0.92)" }} />
        <Logo src={logoData} />
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            top: 790,
            bottom: 82,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start"
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.96)", fontFamily: canvaTemplate.layout.fontFace, fontSize: headingScale(heading), fontWeight: canvaTemplate.fontWeights.bold, letterSpacing: 2.5, textAlign: "center", marginBottom: 18, padding: "0 20px" }}>
            {heading}
          </div>
          <div style={{ width: 860, height: 3, background: canvaTemplate.layout.dividerColor, marginBottom: 24 }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "center", fontFamily: canvaTemplate.layout.fontFace, fontSize: scaledTitle.fontSize, fontWeight: canvaTemplate.fontWeights.bold, lineHeight: `${scaledTitle.lineHeight}px`, textTransform: "uppercase", maxWidth: titleMaxWidth, padding: "0 12px" }}>
            {scaledTitle.lines.map((line) => <div key={`${line.start}-${line.end}`} style={{ display: "flex", justifyContent: "center" }}>{lineSegments(line, scaledTitle.highlightStart, scaledTitle.highlightEnd).map((segment, index) => <span key={`${line.start}-${index}`} style={{ color: segment.highlighted ? canvaTemplate.colors.lightBlue : canvaTemplate.colors.white }}>{segment.text}</span>)}</div>)}
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
