"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { GraphicAdjustments, OverlayRegion, adjustmentsToQuery, defaultAdjustments, maxRegions, scrimOptions, sliderFields } from "@/src/design/graphic-adjustments";
import { GraphicCanvas } from "./GraphicCanvas";

function formatValue(value: number, displayScale: number, unit: string) {
  return `${Math.round(value * displayScale)}${unit}`;
}

const newRegion: OverlayRegion = { x: 8, y: 55, width: 84, height: 22, color: "#051322", opacity: 0.55 };

export function GraphicEditor({
  postId,
  graphicPath,
  topicHeading,
  saved,
  onSaved
}: {
  postId: string;
  graphicPath: string;
  topicHeading: string;
  saved?: GraphicAdjustments;
  onSaved: (adjustments: GraphicAdjustments | undefined) => void;
}) {
  const [draft, setDraft] = useState<GraphicAdjustments>(saved ?? {});
  // Committed separately from the draft: the PNG only re-renders when a drag
  // ends, so dragging stays smooth instead of firing a render per pointer move.
  const [committed, setCommitted] = useState<GraphicAdjustments>(saved ?? {});
  const [version, setVersion] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [showSliders, setShowSliders] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = useMemo(() => ({ ...defaultAdjustments, ...draft }), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? {});
  const regions = draft.regions ?? [];

  const src = useMemo(() => {
    const query = Object.keys(committed).length ? adjustmentsToQuery({ ...defaultAdjustments, ...committed }) : "";
    return `${graphicPath}?${query}${query ? "&" : ""}v=${version}`;
  }, [graphicPath, committed, version]);

  const previousSrc = useRef(src);
  useEffect(() => {
    if (previousSrc.current !== src) { previousSrc.current = src; setRendering(true); }
  }, [src]);

  function commit(next: GraphicAdjustments) {
    setDraft(next);
    setCommitted(next);
    setError(null);
  }

  function reset() {
    setDraft({}); setCommitted({}); setSelectedRegion(null); setError(null);
  }

  function updateRegion(index: number, patch: Partial<OverlayRegion>) {
    commit({ ...draft, regions: regions.map((region, position) => (position === index ? { ...region, ...patch } : region)) });
  }

  async function save(clear = false) {
    setSaving(true); setError(null);
    try {
      const payload = clear || !Object.keys(draft).length ? null : { ...defaultAdjustments, ...draft };
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphicAdjustments: payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the layout");
      const next = data.graphicAdjustments ?? {};
      setDraft(next); setCommitted(next); setVersion((current) => current + 1);
      onSaved(data.graphicAdjustments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the layout");
    } finally {
      setSaving(false);
    }
  }

  return <div className="graphic-editor">
    <div className="graphic-editor-heading">
      <div>
        <p className="eyebrow">LAYOUT</p>
        <h3>Drag anything on the graphic</h3>
        <p className="field-hint">Move the photo, the text block, and where the fade begins. Nothing is kept until you save.</p>
        {saved ? <p className="field-hint">A saved layout is active. Approving a graphic keeps its layout for the next article with a similar image.</p> : null}
      </div>
      {rendering ? <Spinner label="Rendering…" /> : null}
    </div>

    <GraphicCanvas
      src={src}
      values={values}
      selectedRegion={selectedRegion}
      onSelectRegion={setSelectedRegion}
      onDraft={setDraft}
      onCommit={commit}
      onLoad={() => setRendering(false)}
      onError={() => { setRendering(false); setError("The graphic could not be rendered with these settings."); }}
    />

    <div className="editor-row">
      <label className="editor-text-field">
        Topic heading
        <input
          type="text"
          maxLength={60}
          value={draft.topicHeading ?? topicHeading}
          onChange={(event) => setDraft({ ...draft, topicHeading: event.target.value })}
          onBlur={(event) => commit({ ...draft, topicHeading: event.target.value.trim() || undefined })}
        />
        <small>The article title below it is preserved exactly and cannot be edited here.</small>
      </label>
    </div>

    <div className="editor-row">
      <span className="editor-slider-label">Shaded areas</span>
      <div className="editor-choices">
        <button type="button" disabled={regions.length >= maxRegions} onClick={() => { commit({ ...draft, regions: [...regions, newRegion] }); setSelectedRegion(regions.length); }}>Add shaded area</button>
        {selectedRegion !== null && regions[selectedRegion] ? <button type="button" onClick={() => { commit({ ...draft, regions: regions.filter((_, index) => index !== selectedRegion) }); setSelectedRegion(null); }}>Remove selected</button> : null}
      </div>
      {selectedRegion !== null && regions[selectedRegion] ? <div className="region-controls">
        <label>Colour<input type="color" value={regions[selectedRegion].color} onChange={(event) => updateRegion(selectedRegion, { color: event.target.value })} /></label>
        <label>Opacity <strong>{Math.round(regions[selectedRegion].opacity * 100)}%</strong>
          <input type="range" min={0} max={1} step={0.05} value={regions[selectedRegion].opacity} onChange={(event) => updateRegion(selectedRegion, { opacity: Number(event.target.value) })} />
        </label>
      </div> : <small>Add a shaded box, then drag it on the graphic. Use the corner to resize.</small>}
    </div>

    <button type="button" className="editor-disclosure" onClick={() => setShowSliders((current) => !current)}>
      {showSliders ? "Hide precise values" : "Set precise values"}
    </button>

    {showSliders ? <div className="editor-sliders">
      {sliderFields.map((field) => (
        <label className="editor-slider" key={field.key}>
          <span className="editor-slider-label">
            {field.label}
            <strong>{formatValue(values[field.key], field.displayScale, field.unit)}</strong>
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={values[field.key]}
            onChange={(event) => setDraft({ ...draft, [field.key]: Number(event.target.value) })}
            onPointerUp={() => commit(draft)}
            onKeyUp={() => commit(draft)}
          />
          <small>{field.hint}</small>
        </label>
      ))}
      <div className="editor-slider">
        <span className="editor-slider-label">Overlay strength</span>
        <div className="editor-choices">
          {scrimOptions.map((option) => (
            <button type="button" key={option} className={values.scrim === option ? "active" : ""} onClick={() => commit({ ...draft, scrim: option })}>{option}</button>
          ))}
        </div>
      </div>
    </div> : null}

    <div className="editor-actions">
      <button type="button" onClick={() => save()} disabled={saving || !dirty}>{saving ? <Spinner label="Saving…" /> : "Save layout"}</button>
      <button type="button" className="secondary" onClick={reset} disabled={saving || !Object.keys(draft).length}>Reset</button>
      {saved ? <button type="button" className="outline" onClick={() => save(true)} disabled={saving}>Back to automatic</button> : null}
    </div>
    {error ? <span className="error-text">{error}</span> : null}
  </div>;
}
