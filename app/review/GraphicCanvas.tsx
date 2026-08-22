"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canvaTemplate } from "@/config/template";
import { GraphicAdjustments, OverlayRegion, defaultAdjustments, maxRegions } from "@/src/design/graphic-adjustments";

type Handle = "image" | "text" | "scrim" | `region-${number}` | `resize-${number}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Direct manipulation over the rendered graphic.
 *
 * The server render stays the single source of truth for what the graphic looks
 * like — building a second, client-side renderer is what lets a preview and the
 * real output drift apart. So this draws only handles on top of the real PNG,
 * converts pointer movement into adjustment values, and asks for a fresh render
 * when the drag ends.
 */
export function GraphicCanvas({
  src,
  values,
  selectedRegion,
  onSelectRegion,
  onDraft,
  onCommit,
  onLoad,
  onError
}: {
  src: string;
  values: GraphicAdjustments;
  selectedRegion: number | null;
  onSelectRegion: (index: number | null) => void;
  /** Fires continuously during a drag; cheap, no re-render of the PNG. */
  onDraft: (next: GraphicAdjustments) => void;
  /** Fires once on release; triggers the server render. */
  onCommit: (next: GraphicAdjustments) => void;
  onLoad: () => void;
  onError: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; from: GraphicAdjustments } | null>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);

  const merged = { ...defaultAdjustments, ...values };
  const regions = values.regions ?? [];

  /** Pointer pixels to canvas units, so a drag maps 1:1 with what is on screen. */
  const toCanvas = useCallback((dx: number, dy: number) => {
    const width = frameRef.current?.clientWidth || canvaTemplate.width;
    const scale = canvaTemplate.width / width;
    return { dx: dx * scale, dy: dy * scale };
  }, []);

  const move = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { dx, dy } = toCanvas(event.clientX - drag.startX, event.clientY - drag.startY);
    const from = { ...defaultAdjustments, ...drag.from };
    const next: GraphicAdjustments = { ...drag.from };

    if (drag.handle === "image") {
      // Dragging the photo should move the photo, so the visible window moves
      // the opposite way: pull right, see more of the left.
      next.focusX = clamp(from.focusX - (dx / canvaTemplate.width) * 100 * 2, 0, 100);
      next.focusY = clamp(from.focusY - (dy / canvaTemplate.height) * 100 * 2, 0, 100);
    } else if (drag.handle === "text") {
      next.textTop = clamp(Math.round((from.textTop + dy) / 10) * 10, 600, 1100);
    } else if (drag.handle === "scrim") {
      next.scrimTop = clamp(Math.round((from.scrimTop + dy) / 10) * 10, 200, 1100);
    } else if (drag.handle.startsWith("region-") || drag.handle.startsWith("resize-")) {
      const index = Number(drag.handle.split("-")[1]);
      const source = (drag.from.regions ?? [])[index];
      if (!source) return;
      const px = (dx / canvaTemplate.width) * 100;
      const py = (dy / canvaTemplate.height) * 100;
      const updated: OverlayRegion = drag.handle.startsWith("resize-")
        ? { ...source, width: clamp(source.width + px, 2, 100 - source.x), height: clamp(source.height + py, 2, 100 - source.y) }
        : { ...source, x: clamp(source.x + px, 0, 100 - source.width), y: clamp(source.y + py, 0, 100 - source.height) };
      next.regions = (drag.from.regions ?? []).map((region, position) => (position === index ? updated : region));
    }
    onDraft(next);
  }, [onDraft, toCanvas]);

  const end = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(null);
    if (drag) onCommit(latestRef.current);
  }, [onCommit]);

  // move() closes over the drag start, so the newest draft has to be readable
  // at release time without re-binding the listeners mid-drag.
  const latestRef = useRef(values);
  useEffect(() => { latestRef.current = values; }, [values]);

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

  function start(handle: Handle, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, from: values };
    setDragging(handle);
  }

  const textTopPercent = (merged.textTop / canvaTemplate.height) * 100;
  const scrimTopPercent = (merged.scrimTop / canvaTemplate.height) * 100;

  return (
    <div className={`graphic-canvas ${dragging ? "dragging" : ""}`} ref={frameRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Savvy Cyber Kids social post preview" onLoad={onLoad} onError={onError} draggable={false} />

      <div
        className="canvas-handle canvas-image"
        onPointerDown={(event) => start("image", event)}
        onClick={() => onSelectRegion(null)}
        title="Drag to move the photo"
      >
        <span className="canvas-tag">Drag the photo</span>
      </div>

      <div
        className="canvas-handle canvas-scrim"
        style={{ top: `${scrimTopPercent}%` }}
        onPointerDown={(event) => start("scrim", event)}
        title="Drag to move where the fade begins"
      >
        <span className="canvas-tag">Fade starts</span>
      </div>

      <div
        className="canvas-handle canvas-text"
        style={{ top: `${textTopPercent}%` }}
        onPointerDown={(event) => start("text", event)}
        title="Drag to move the heading and headline"
      >
        <span className="canvas-tag">Drag the text</span>
      </div>

      {regions.map((region, index) => (
        <div
          key={`region-${index}`}
          className={`canvas-region ${selectedRegion === index ? "selected" : ""}`}
          style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` }}
          onPointerDown={(event) => { onSelectRegion(index); start(`region-${index}`, event); }}
          title="Drag to move this shaded area"
        >
          <span className="canvas-region-resize" onPointerDown={(event) => start(`resize-${index}`, event)} title="Drag to resize" />
        </div>
      ))}

      {regions.length >= maxRegions ? <span className="canvas-limit">Maximum of {maxRegions} shaded areas</span> : null}
    </div>
  );
}
