"use client";

import { canvaTemplate } from "@/config/template";
import { highlightedTitleParts } from "@/src/content/local-copy";
import { GraphicAdjustments, defaultAdjustments } from "@/src/design/graphic-adjustments";
import { parseGraphicIntent } from "@/src/design/graphic-intent";
import {
  brandGround, canvasHeight, canvasWidth, composition, dividerGap, dividerHeight, dividerWidth,
  headingGap, headingScale, imagePlacement, lineSegments, scrimRamps, sideInset, textBottomInset,
  titleFit, withOpacity
} from "@/src/design/graphic-layout";

/**
 * The graphic, drawn in the browser at true canvas size.
 *
 * Every measurement comes from graphic-layout, the same module the Satori
 * renderer uses, so this cannot drift from the PNG on its own. What it buys is
 * latency: dragging updates local state and the browser repaints, instead of
 * round-tripping to a server render that refetches the photo and rasterises it.
 *
 * It is a preview, not the output. Small font-metric differences between the
 * browser and Satori are expected; the editor's "Exact render" toggle shows the
 * real PNG when that matters.
 */
export function LivePreview({
  imageUrl,
  imageSize,
  topicHeading,
  articleTitle,
  guidance,
  sourceImageHasText,
  adjustments
}: {
  imageUrl?: string;
  imageSize?: { width: number; height: number };
  topicHeading: string;
  articleTitle: string;
  guidance?: string;
  sourceImageHasText?: boolean;
  adjustments: GraphicAdjustments;
}) {
  const intent = parseGraphicIntent(guidance, sourceImageHasText, adjustments);
  const layout = composition(adjustments);
  const focusX = adjustments.focusX ?? defaultAdjustments.focusX;
  const focusY = adjustments.focusY ?? defaultAdjustments.focusY;
  const heading = (adjustments.topicHeading || topicHeading).toUpperCase();
  const { highlight } = highlightedTitleParts(articleTitle);
  const scaledTitle = titleFit(articleTitle, highlight, {
    titleScale: intent.titleScale,
    lineSpacing: intent.lineSpacing,
    titleAreaHeight: layout.titleAreaHeight,
    maxWidth: intent.titleWidth
  });
  const placement = imageSize ? imagePlacement(imageSize.width, imageSize.height, intent.zoom, focusX, focusY) : undefined;

  return (
    <div className="live-preview" style={{ width: canvasWidth, height: canvasHeight, background: canvaTemplate.colors.black }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", backgroundImage: brandGround }}>
        {imageUrl && placement ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            style={{ position: "absolute", left: placement.left, top: placement.top, width: placement.width, height: placement.height, maxWidth: "none" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: canvaTemplate.colors.darkBlue, color: "rgba(255,255,255,0.82)", fontSize: 28, letterSpacing: 3 }}>
            {imageUrl ? "LOADING IMAGE" : "IMAGE UNAVAILABLE"}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: layout.scrimTop, bottom: 0, backgroundImage: scrimRamps[intent.scrim] }} />

      {(adjustments.regions ?? []).map((region, index) => (
        <div
          key={`region-${index}`}
          style={{ position: "absolute", left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`, backgroundColor: withOpacity(region.color, region.opacity) }}
        />
      ))}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {adjustments.badge !== null ? <img src="/branding/sck-logo-150.png" alt="" draggable={false} style={{ position: "absolute", left: `${adjustments.badge?.x ?? ((canvaTemplate.width - canvaTemplate.layout.logoRight - canvaTemplate.layout.logoWidth) / canvasWidth) * 100}%`, top: `${adjustments.badge?.y ?? (canvaTemplate.layout.logoTop / canvasHeight) * 100}%`, width: `${adjustments.badge?.width ?? (canvaTemplate.layout.logoWidth / canvasWidth) * 100}%`, height: `${adjustments.badge?.height ?? (canvaTemplate.layout.logoHeight / canvasHeight) * 100}%`, objectFit: "contain" }} /> : null}

      <div style={{ position: "absolute", left: sideInset, right: sideInset, top: layout.textTop, bottom: textBottomInset, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
        <div data-element="heading" style={{ color: "rgba(255,255,255,0.96)", fontSize: headingScale(heading, adjustments.headingScale ?? 1), fontWeight: 700, letterSpacing: 2.5, textAlign: "center", marginBottom: headingGap, padding: "0 20px" }}>
          {heading}
        </div>
        <div style={{ width: dividerWidth, height: dividerHeight, background: canvaTemplate.layout.dividerColor, marginBottom: dividerGap, flexShrink: 0 }} />
        <div data-element="headline" style={{ width: "100%", height: layout.titleAreaHeight, display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "center", fontSize: scaledTitle.fontSize, fontWeight: 700, lineHeight: `${scaledTitle.lineHeight}px`, textTransform: "uppercase", maxWidth: intent.titleWidth, padding: "0 12px" }}>
          {scaledTitle.lines.map((line) => (
            <div key={`${line.start}-${line.end}`} style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              {lineSegments(line, scaledTitle.highlightStart, scaledTitle.highlightEnd).map((segment, index) => (
                <span key={`${line.start}-${index}`} style={{ color: segment.highlighted ? canvaTemplate.colors.lightBlue : canvaTemplate.colors.white, whiteSpace: "pre-wrap" }}>{segment.text}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
