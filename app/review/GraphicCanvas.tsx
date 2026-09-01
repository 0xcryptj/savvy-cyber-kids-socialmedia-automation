"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { canvaTemplate } from "@/config/template";
import { GraphicAdjustments, OverlayRegion, defaultAdjustments } from "@/src/design/graphic-adjustments";
import { canvasHeight, canvasWidth, composition, focusSensitivity, headingBlockHeight, textBottomInset } from "@/src/design/graphic-layout";
import { LivePreview } from "./LivePreview";

export type Selection = "image" | "badge" | "heading" | "headline" | { region: number } | null;

type DragKind = "move" | "scale";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sameSelection = (a: Selection, b: Selection) =>
  typeof a === "object" && a && typeof b === "object" && b ? a.region === b.region : a === b;

/** Below this the axis cannot move at all, so a drag on it is ignored. */
const immobile = 0.01;

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
  onCommit,
  onDeleteSelected,
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
  /** Called once when a gesture finishes, so undo steps are gestures not frames. */
  onCommit: () => void;
  onDeleteSelected: () => void;
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

  // Everything inside is laid out at true canvas size and scaled as a whole, so
  // no measurement is ever converted twice.
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

  /** Shift the image by a pixel amount, whichever regime each axis is in. */
  const nudgeImage = useCallback((from: GraphicAdjustments, dx: number, dy: number): GraphicAdjustments => {
    const base = { ...defaultAdjustments, ...from };
    if (!imageSize) return from;
    const sensitivity = focusSensitivity(imageSize.width, imageSize.height, base.zoom);
    return {
      ...from,
      focusX: Math.abs(sensitivity.x) < immobile ? base.focusX : clamp(base.focusX + dx / sensitivity.x, 0, 100),
      focusY: Math.abs(sensitivity.y) < immobile ? base.focusY : clamp(base.focusY + dy / sensitivity.y, 0, 100)
    };
  }, [imageSize]);

  const move = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const from = { ...defaultAdjustments, ...drag.from };
    let next: GraphicAdjustments = { ...drag.from };

    if (drag.target === "image") {
      next = drag.kind === "scale"
        ? { ...next, zoom: clamp(from.zoom + dy / 600, 0, 1) }
        : nudgeImage(drag.from, dx, dy);
    } else if (drag.target === "badge") {
      const source = drag.from.badge;
      if (!source) return;
      const px = (dx / canvasWidth) * 100;
      const py = (dy / canvasHeight) * 100;
      next.badge = drag.kind === "scale"
        ? { ...source, width: clamp(source.width + px, 4, 60), height: clamp(source.height + py, 4, 60) }
        : { ...source, x: clamp(source.x + px, 0, 100 - source.width), y: clamp(source.y + py, 0, 100 - source.height) };
    } else if (drag.target === "heading" || drag.target === "headline") {
      if (drag.kind === "scale") {
        if (drag.target === "heading") next.headingScale = clamp(from.headingScale + dy / 400, 0.6, 1.4);
        else next.titleScale = clamp(from.titleScale + dy / 400, 0.6, 1.2);
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
  }, [nudgeImage, onChange, scale]);

  const end = useCallback(() => {
    if (dragRef.current) onCommit();
    dragRef.current = null;
    setDragging(false);
  }, [onCommit]);

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

  // Arrow keys nudge the selection, the way any canvas tool behaves.
  useEffect(() => {
    if (!selection || showExact) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") { onSelect(null); return; }
      if (event.key === "Delete" || event.key === "Backspace") {
      if (selection === "badge" || (typeof selection === "object" && selection)) { event.preventDefault(); onDeleteSelected(); }
        return;
      }
      const step = event.shiftKey ? 20 : 4;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (!dx && !dy) return;
      event.preventDefault();
      const current = latest.current;
      const base = { ...defaultAdjustments, ...current };

      if (selection === "image") onChange(nudgeImage(current, dx, dy));
      else if (selection === "badge" && current.badge) onChange({ ...current, badge: { ...current.badge, x: clamp(current.badge.x + (dx / canvasWidth) * 100, 0, 100 - current.badge.width), y: clamp(current.badge.y + (dy / canvasHeight) * 100, 0, 100 - current.badge.height) } });
      else if (selection === "heading" || selection === "headline") onChange({ ...current, textTop: clamp(base.textTop + dy, 600, 1100) });
      else if (typeof selection === "object" && selection) {
        const list = current.regions ?? [];
        const source = list[selection.region];
        if (!source) return;
        const updated = { ...source, x: clamp(source.x + (dx / canvasWidth) * 100, 0, 100 - source.width), y: clamp(source.y + (dy / canvasHeight) * 100, 0, 100 - source.height) };
        onChange({ ...current, regions: list.map((region, index) => (index === selection.region ? updated : region)) });
      }
      onCommit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, showExact, nudgeImage, onChange, onCommit, onSelect, onDeleteSelected]);

  function start(kind: DragKind, target: Selection, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(target);
    dragRef.current = { kind, target, startX: event.clientX, startY: event.clientY, from: latest.current };
    setDragging(true);
  }

  function Box({ target, label, style, hint }: { target: Selection; label: string; style: React.CSSProperties; hint: string }) {
    const active = sameSelection(selection, target);
    return (
      <div className={`ec-box ${active ? "is-selected" : ""}`} style={style} onPointerDown={(event) => start("move", target, event)} title={hint}>
        <span className="ec-label">{label}</span>
        {active ? <span className="ec-scale" onPointerDown={(event) => start("scale", target, event)} title="Drag down to grow, up to shrink" /> : null}
      </div>
    );
  }

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
          <Box target="image" label="Photo" style={{ left: 0, top: 0, width: canvasWidth, height: layout.textTop }} hint="Drag to move the photo" />
          <Box target="heading" label="Heading" style={{ left: 0, top: layout.textTop, width: canvasWidth, height: headingBlockHeight }} hint="Drag to move, corner to resize" />
          <Box target="headline" label="Headline" style={{ left: 0, top: layout.textTop + headingBlockHeight, width: canvasWidth, height: Math.max(40, textHeight - headingBlockHeight) }} hint="Drag to move, corner to resize" />
          {values.badge !== null ? <Box target="badge" label="Badge" style={{ left: `${values.badge?.x ?? ((canvasWidth - canvaTemplate.layout.logoRight - canvaTemplate.layout.logoWidth) / canvasWidth) * 100}%`, top: `${values.badge?.y ?? (canvaTemplate.layout.logoTop / canvasHeight) * 100}%`, width: `${values.badge?.width ?? (canvaTemplate.layout.logoWidth / canvasWidth) * 100}%`, height: `${values.badge?.height ?? (canvaTemplate.layout.logoHeight / canvasHeight) * 100}%` }} hint="Drag to move, corner to resize. Delete removes it." /> : null}
          {regions.map((region, index) => (
            <Box
              key={`region-${index}`}
              target={{ region: index }}
              label="Shade"
              style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` }}
              hint="Drag to move, corner to resize. Delete removes it."
            />
          ))}
        </> : null}
      </div>
    </div>
  );
}
