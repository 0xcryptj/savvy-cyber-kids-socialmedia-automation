"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GraphicAdjustments, OverlayRegion, defaultAdjustments } from "@/src/design/graphic-adjustments";
import { canvasHeight, canvasWidth, composition, headingBlockHeight, textBottomInset } from "@/src/design/graphic-layout";
import { LivePreview } from "./LivePreview";

export type Selection = "image" | "heading" | "headline" | { region: number } | null;

type DragKind = "move" | "scale";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sameSelection = (a: Selection, b: Selection) =>
  typeof a === "object" && a && typeof b === "object" && b ? a.region === b.region : a === b;

/**
 * Selection and dragging over the live preview.
 *
 * Everything here is local: a drag changes React state and the browser repaints
 * the preview immediately. The server render is only asked for when the reviewer
 * wants to confirm the exact output, or when the layout is saved.
 */
export function GraphicCanvas({
  imageUrl,
  topicHeading,
  articleTitle,
  guidance,
  sourceImageHasText,
  values,
  selection,
  onSelect,
  onChange,
  exactSrc,
  showExact
}: {
  imageUrl?: string;
  topicHeading: string;
  articleTitle: string;
  guidance?: string;
  sourceImageHasText?: boolean;
  values: GraphicAdjustments;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (next: GraphicAdjustments) => void;
  exactSrc: string;
  showExact: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>();
  const dragRef = useRef<{ kind: DragKind; target: Selection; startX: number; startY: number; from: GraphicAdjustments } | null>(null);
  const [dragging, setDragging] = useState(false);

  const merged = { ...defaultAdjustments, ...values };
  const layout = composition(values);
  const regions = values.regions ?? [];

  // Everything inside is laid out at true canvas size and scaled down as a
  // whole, so no measurement has to be converted twice.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setScale(frame.clientWidth / canvasWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageUrl) { setImageSize(undefined); return; }
    let cancelled = false;
    const image = new Image();
    // No crossOrigin: naturalWidth/Height need no CORS, and requesting it makes
    // the load fail outright on hosts that send no Access-Control-Allow-Origin
    // — savvycyberkids.org among them, which is most of the library.
    image.onload = () => { if (!cancelled) setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { if (!cancelled) setImageSize(undefined); };
    image.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl]);

  const latest = useRef(values);
  useEffect(() => { latest.current = values; }, [values]);

  const move = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const from = { ...defaultAdjustments, ...drag.from };
    const next: GraphicAdjustments = { ...drag.from };

    if (drag.target === "image") {
      if (drag.kind === "scale") {
        next.zoom = clamp(from.zoom + dy / 600, 0, 1);
      } else {
        // Drag the photo, not the window onto it: pull right, see more of the left.
        next.focusX = clamp(from.focusX - (dx / canvasWidth) * 200, 0, 100);
        next.focusY = clamp(from.focusY - (dy / canvasHeight) * 200, 0, 100);
      }
    } else if (drag.target === "heading" || drag.target === "headline") {
      if (drag.kind === "scale") {
        const key = drag.target === "heading" ? "headingScale" : "titleScale";
        const base = drag.target === "heading" ? from.headingScale : from.titleScale;
        next[key] = clamp(base + dy / 400, drag.target === "heading" ? 0.6 : 0.6, drag.target === "heading" ? 1.4 : 1.2);
      } else {
        next.textTop = clamp(Math.round((from.textTop + dy) / 5) * 5, 600, 1100);
      }
    } else if (typeof drag.target === "object" && drag.target) {
      const index = drag.target.region;
      const source = (drag.from.regions ?? [])[index];
      if (!source) return;
      const px = (dx / canvasWidth) * 100;
      const py = (dy / canvasHeight) * 100;
      const updated: OverlayRegion = drag.kind === "scale"
        ? { ...source, width: clamp(source.width + px, 2, 100 - source.x), height: clamp(source.height + py, 2, 100 - source.y) }
        : { ...source, x: clamp(source.x + px, 0, 100 - source.width), y: clamp(source.y + py, 0, 100 - source.height) };
      next.regions = (drag.from.regions ?? []).map((region, position) => (position === index ? updated : region));
    }
    onChange(next);
  }, [onChange, scale]);

  const end = useCallback(() => { dragRef.current = null; setDragging(false); }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, move, end]);

  function start(kind: DragKind, target: Selection, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(target);
    dragRef.current = { kind, target, startX: event.clientX, startY: event.clientY, from: latest.current };
    setDragging(true);
  }

  function box(target: Selection, label: string, style: React.CSSProperties, hint: string) {
    const active = sameSelection(selection, target);
    return (
      <div
        className={`ec-box ${active ? "is-selected" : ""}`}
        style={style}
        onPointerDown={(event) => start("move", target, event)}
        title={hint}
      >
        <span className="ec-label">{label}</span>
        {active ? <span className="ec-scale" onPointerDown={(event) => start("scale", target, event)} title="Drag down to grow, up to shrink" /> : null}
      </div>
    );
  }

  const headingHeight = headingBlockHeight;
  const textHeight = canvasHeight - textBottomInset - layout.textTop;

  return (
    <div className={`editor-canvas ${dragging ? "is-dragging" : ""}`} ref={frameRef} onPointerDown={() => onSelect(null)}>
      <div className="editor-stage" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${scale})` }}>
        {showExact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="editor-exact" src={exactSrc} alt="Exact rendered output" width={canvasWidth} height={canvasHeight} />
        ) : (
          <LivePreview
            imageUrl={imageUrl}
            imageSize={imageSize}
            topicHeading={topicHeading}
            articleTitle={articleTitle}
            guidance={guidance}
            sourceImageHasText={sourceImageHasText}
            adjustments={merged}
          />
        )}

        {!showExact ? <>
          {box("image", "Photo", { left: 0, top: 0, width: canvasWidth, height: layout.textTop }, "Drag to move the photo")}
          {box("heading", "Heading", { left: 0, top: layout.textTop, width: canvasWidth, height: headingHeight }, "Drag to move, corner to resize")}
          {box("headline", "Headline", { left: 0, top: layout.textTop + headingHeight, width: canvasWidth, height: Math.max(40, textHeight - headingHeight) }, "Drag to move, corner to resize")}
          {regions.map((region, index) => box(
            { region: index },
            "Shade",
            { left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` },
            "Drag to move, corner to resize"
          ))}
        </> : null}
      </div>
    </div>
  );
}
