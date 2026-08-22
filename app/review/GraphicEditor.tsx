"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { GraphicAdjustments, ScrimStrength, adjustmentsToQuery, scrimOptions, sliderFields } from "@/src/design/graphic-adjustments";

// The values the renderer uses when nothing has been set, so a freshly opened
// editor shows where the graphic actually is rather than a row of zeroes.
const startingPoint: Required<Omit<GraphicAdjustments, "scrim">> & { scrim: ScrimStrength } = {
  zoom: 1,
  focusY: 24,
  scrimTop: 560,
  textTop: 900,
  titleScale: 1,
  lineSpacing: 1.06,
  scrim: "default"
};

function formatValue(value: number, displayScale: number, unit: string) {
  return `${Math.round(value * displayScale)}${unit}`;
}

export function GraphicEditor({
  postId,
  saved,
  onPreviewChange,
  onSaved
}: {
  postId: string;
  saved?: GraphicAdjustments;
  /** Query string for the live preview, or "" to show the saved graphic. */
  onPreviewChange: (query: string) => void;
  onSaved: (adjustments: GraphicAdjustments | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GraphicAdjustments>(saved ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = useMemo(() => ({ ...startingPoint, ...draft }), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? {});

  function update(next: GraphicAdjustments) {
    setDraft(next);
    setError(null);
    // Every knob goes into the preview, not just the changed one: the renderer
    // needs the whole composition to draw an accurate frame.
    onPreviewChange(adjustmentsToQuery({ ...startingPoint, ...next }));
  }

  function reset() {
    setDraft({});
    setError(null);
    onPreviewChange("");
  }

  async function save(clear = false) {
    setSaving(true); setError(null);
    try {
      const payload = clear || !Object.keys(draft).length ? null : { ...startingPoint, ...draft };
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphicAdjustments: payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the adjustments");
      setDraft(data.graphicAdjustments ?? {});
      onSaved(data.graphicAdjustments);
      onPreviewChange("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the adjustments");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <div className="editor-toggle">
      <button type="button" className="outline" onClick={() => setOpen(true)}>Adjust graphic manually</button>
      {saved ? <span className="field-hint">Manual adjustments are active on this graphic.</span> : null}
    </div>;
  }

  return <div className="graphic-editor">
    <div className="graphic-editor-heading">
      <div><p className="eyebrow">MANUAL ADJUSTMENT</p><h3>Move it yourself</h3></div>
      <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close the editor">×</button>
    </div>
    <p className="field-hint">Drag a slider and the preview above updates. Nothing is kept until you save.</p>

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
          onChange={(event) => update({ ...draft, [field.key]: Number(event.target.value) })}
        />
        <small>{field.hint}</small>
      </label>
    ))}

    <div className="editor-slider">
      <span className="editor-slider-label">Overlay strength</span>
      <div className="editor-choices">
        {scrimOptions.map((option) => (
          <button
            type="button"
            key={option}
            className={values.scrim === option ? "active" : ""}
            onClick={() => update({ ...draft, scrim: option })}
          >
            {option}
          </button>
        ))}
      </div>
      <small>How hard the gradient darkens the photo behind the headline</small>
    </div>

    <div className="editor-actions">
      <button type="button" onClick={() => save()} disabled={saving || !dirty}>{saving ? <Spinner label="Saving…" /> : "Save adjustments"}</button>
      <button type="button" className="secondary" onClick={reset} disabled={saving || !Object.keys(draft).length}>Reset sliders</button>
      {saved ? <button type="button" className="outline" onClick={() => save(true)} disabled={saving}>Back to automatic</button> : null}
    </div>
    {error ? <span className="error-text">{error}</span> : null}
  </div>;
}
