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

export async function renderTemplateGraphic(input: GraphicInput) {
  const [logoData, imageSource] = await Promise.all([loadLogo(), resolveImageSource(input.imageUrl)]);
  const { plain, highlight } = highlightedTitleParts(input.articleTitle);
  const heading = input.topicHeading.toUpperCase();
  const photoHeight = 790;

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
        {imageSource ? <img src={imageSource} alt="" width={canvaTemplate.width} height={photoHeight} style={{ position: "absolute", top: 0, left: 0, right: 0, width: canvaTemplate.width, height: photoHeight, objectFit: "cover" }} /> : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: photoHeight,
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 42%, rgba(0,0,0,0.18) 66%, rgba(0,0,0,0.86) 100%)"
          }}
        />
        <div style={{ position: "absolute", top: photoHeight, left: 0, right: 0, bottom: 0, background: canvaTemplate.colors.black }} />
        <Logo src={logoData} />
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            top: 835,
            height: 455,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start"
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.96)", fontSize: 34, fontWeight: 400, letterSpacing: 3.5, textAlign: "center", marginBottom: 20, padding: "0 20px" }}>
            {heading}
          </div>
          <div style={{ width: 860, height: 3, background: canvaTemplate.layout.dividerColor, marginBottom: 28 }} />
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", textAlign: "center", fontSize: 46, fontWeight: 400, lineHeight: 1.14, textTransform: "uppercase", maxWidth: 900, padding: "0 18px" }}>
            {plain ? <span style={{ color: canvaTemplate.colors.white, marginRight: 12 }}>{plain}</span> : null}
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
