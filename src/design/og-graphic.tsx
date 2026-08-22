import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";
import { GraphicIntent, parseGraphicIntent, defaultTitleWidth } from "./graphic-intent";
import { GraphicAdjustments, defaultAdjustments } from "./graphic-adjustments";
import {
  brandGround, canvasHeight, composition, cropRectForZoom, dividerGap, dividerHeight, dividerWidth,
  headingGap, headingScale, lineSegments, scrimRamps, sideInset, textBottomInset, titleFit, withOpacity
} from "./graphic-layout";

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

async function resolveImageSource(imageUrl: string | undefined, zoom: number, focusX: number, focusY: number) {
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
    const framed = zoom >= 1 ? usable : await cropTowardFrame(usable, zoom, focusX, focusY);
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

async function cropTowardFrame(image: UsableImage, zoom: number, focusX: number, focusY: number): Promise<UsableImage> {
  try {
    const sharp = (await import("sharp")).default;
    const { width, height } = await sharp(image.bytes).metadata();
    if (!width || !height) return image;
    const rect = cropRectForZoom(width, height, zoom, focusX, focusY);
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

export async function renderTemplateGraphic(input: GraphicInput) {
  const intent = parseGraphicIntent(input.graphicGuidance, input.sourceImageHasText, input.adjustments);
  const layout = composition(input.adjustments);
  const focusX = input.adjustments?.focusX ?? defaultAdjustments.focusX;
  const focusY = input.adjustments?.focusY ?? defaultAdjustments.focusY;
  const [logoData, imageSource, regularFont, mediumFont, semiBoldFont, boldFont] = await Promise.all([
    loadLogo(),
    resolveImageSource(input.imageUrl, intent.zoom, focusX, focusY),
    loadFont("Asap-Regular.ttf"),
    loadFont("Asap-Medium.ttf"),
    loadFont("Asap-SemiBold.ttf"),
    loadFont("Asap-Bold.ttf")
  ]);
  const { highlight } = highlightedTitleParts(input.articleTitle);
  const heading = (input.adjustments?.topicHeading || input.topicHeading).toUpperCase();
  const scaledTitle = titleFit(input.articleTitle, highlight, {
    titleScale: intent.titleScale,
    lineSpacing: intent.lineSpacing,
    titleAreaHeight: layout.titleAreaHeight,
    maxWidth: intent.titleWidth
  });

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
        {(input.adjustments?.regions ?? []).map((region, index) => (
          <div
            key={`region-${index}`}
            style={{
              position: "absolute",
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
              backgroundColor: withOpacity(region.color, region.opacity)
            }}
          />
        ))}
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
          <div style={{ color: "rgba(255,255,255,0.96)", fontFamily: canvaTemplate.layout.fontFace, fontSize: headingScale(heading, input.adjustments?.headingScale ?? 1), fontWeight: canvaTemplate.fontWeights.bold, letterSpacing: 2.5, textAlign: "center", marginBottom: headingGap, padding: "0 20px" }}>
            {heading}
          </div>
          <div style={{ width: dividerWidth, height: dividerHeight, background: canvaTemplate.layout.dividerColor, marginBottom: dividerGap }} />
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
