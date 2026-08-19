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

async function resolveImageSource(imageUrl?: string) {
  if (!imageUrl) return undefined;
  try {
    const parsed = new URL(imageUrl.replaceAll("&amp;", "&"));
    if (parsed.protocol !== "https:" || /^(localhost|127\.|0\.0\.0\.0|::1|169\.254\.)/i.test(parsed.hostname)) return undefined;
    const response = await fetch(parsed, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return undefined;
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0] || "image/jpeg";
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${mimeType};base64,${data}`;
  } catch {
    return undefined;
  }
}

function Logo({ src }: { src: string }) {
  return (
    <img src={src} alt="Savvy Cyber Kids" width={172} height={150} style={{ position: "absolute", top: 46, right: 40, width: 172, height: 150, objectFit: "contain" }} />
  );
}

function titleScale(title: string) {
  const length = title.trim().length;
  if (length > 125) return { fontSize: 34, lineHeight: 1.08 };
  if (length > 95) return { fontSize: 40, lineHeight: 1.1 };
  if (length > 68) return { fontSize: 47, lineHeight: 1.1 };
  if (length > 45) return { fontSize: 55, lineHeight: 1.08 };
  return { fontSize: 64, lineHeight: 1.06 };
}

function headingScale(heading: string) {
  return Math.max(24, Math.min(36, Math.round(980 / Math.max(heading.length, 12))));
}

export async function renderTemplateGraphic(input: GraphicInput) {
  const [logoData, imageSource] = await Promise.all([loadLogo(), resolveImageSource(input.imageUrl)]);
  const { plain, highlight } = highlightedTitleParts(input.articleTitle);
  const heading = input.topicHeading.toUpperCase();
  const scaledTitle = titleScale(input.articleTitle);

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
            inset: 0,
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.12) 51%, rgba(0,0,0,0.5) 73%, rgba(0,0,0,0.94) 100%)"
          }}
        />
        <Logo src={logoData} />
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            top: 855,
            bottom: 52,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end"
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.96)", fontFamily: canvaTemplate.layout.fontFace, fontSize: headingScale(heading), fontWeight: canvaTemplate.fontWeights.bold, letterSpacing: 2.5, textAlign: "center", marginBottom: 18, padding: "0 20px" }}>
            {heading}
          </div>
          <div style={{ width: 860, height: 3, background: canvaTemplate.layout.dividerColor, marginBottom: 24 }} />
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", textAlign: "center", fontFamily: canvaTemplate.layout.fontFace, fontSize: scaledTitle.fontSize, fontWeight: canvaTemplate.fontWeights.bold, lineHeight: scaledTitle.lineHeight, textTransform: "uppercase", maxWidth: 930, padding: "0 12px" }}>
            {plain ? <span style={{ color: canvaTemplate.colors.white, marginRight: 10 }}>{plain}</span> : null}
            <span style={{ color: canvaTemplate.colors.lightBlue }}>{highlight}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: canvaTemplate.width,
      height: canvaTemplate.height
    }
  );
}
