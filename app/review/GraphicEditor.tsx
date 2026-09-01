"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { GraphicAdjustments, OverlayRegion, adjustmentsToQuery, defaultAdjustments, maxRegions, scrimOptions, sliderFields } from "@/src/design/graphic-adjustments";
import { GraphicCanvas, Selection } from "./GraphicCanvas";

const newRegion: OverlayRegion = { x: 8, y: 55, width: 84, height: 22, color: "#051322", opacity: 0.55 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function formatValue(value: number, displayScale: number, unit: string) {
  return `${Math.round(value * displayScale)}${unit}`;
}

export function GraphicEditor({
  postId,
  graphicPath,
  imageUrl,
  topicHeading,
  articleTitle,
  guidance,
  sourceImageHasText,
  saved,
  onSaved
}: {
  postId: string;
  graphicPath: string;
  imageUrl?: string;
  topicHeading: string;
  articleTitle: string;
  guidance?: string;
  sourceImageHasText?: boolean;
  saved?: GraphicAdjustments;
  onSaved: (adjustments: GraphicAdjustments | undefined) => void;
}) {
  const [draft, setDraft] = useState<GraphicAdjustments>(saved ?? {});
  // History is per gesture, not per frame: a drag pushes one entry when it ends,
  // so undo steps back a whole move rather than one pointer sample.
  const [history, setHistory] = useState<GraphicAdjustments[]>([saved ?? {}]);
  const [historyAt, setHistoryAt] = useState(0);
  const pending = useRef(saved ?? {});
  const [selection, setSelection] = useState<Selection>(null);
  const [showExact, setShowExact] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = useMemo(() => ({ ...defaultAdjustments, ...draft }), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? {});
  const regions = draft.regions ?? [];
  const selectedRegion = typeof selection === "object" && selection ? selection.region : null;

  // Only fetched when the reviewer asks to see the exact output, or after a save.
  const exactSrc = useMemo(() => {
    const query = Object.keys(draft).length ? adjustmentsToQuery({ ...defaultAdjustments, ...draft }) : "";
    return `${graphicPath}?${query}${query ? "&" : ""}v=${version}`;
  }, [graphicPath, draft, version]);

  useEffect(() => { pending.current = draft; }, [draft]);

  /** Record the current draft as one undoable step. */
  const commit = useCallback(() => {
    setHistory((entries) => {
      const trimmed = entries.slice(0, historyAt + 1);
      if (JSON.stringify(trimmed[trimmed.length - 1]) === JSON.stringify(pending.current)) return entries;
      const next = [...trimmed, pending.current].slice(-60);
      setHistoryAt(next.length - 1);
      return next;
    });
  }, [historyAt]);

  /** Change and record in one go, for controls without a gesture to end. */
  const apply = useCallback((next: GraphicAdjustments) => {
    setDraft(next);
    pending.current = next;
    setHistory((entries) => {
      const trimmed = entries.slice(0, historyAt + 1);
      const updated = [...trimmed, next].slice(-60);
      setHistoryAt(updated.length - 1);
      return updated;
    });
  }, [historyAt]);

  const canUndo = historyAt > 0;
  const canRedo = historyAt < history.length - 1;

  const undo = useCallback(() => {
    if (historyAt <= 0) return;
    const index = historyAt - 1;
    setHistoryAt(index); setDraft(history[index]); pending.current = history[index];
  }, [history, historyAt]);

  const redo = useCallback(() => {
    if (historyAt >= history.length - 1) return;
    const index = historyAt + 1;
    setHistoryAt(index); setDraft(history[index]); pending.current = history[index];
  }, [history, historyAt]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function nudgeZoom(delta: number) {
    apply({ ...draft, zoom: clamp((draft.zoom ?? defaultAdjustments.zoom) + delta, 0, 1) });
  }

  function deleteSelected() {
    if (selection === "badge") { apply({ ...draft, badge: null }); setSelection(null); return; }
    if (typeof selection !== "object" || !selection) return;
    apply({ ...draft, regions: regions.filter((_, index) => index !== selection.region) });
    setSelection(null);
  }

  function updateRegion(index: number, patch: Partial<OverlayRegion>) {
    apply({ ...draft, regions: regions.map((region, position) => (position === index ? { ...region, ...patch } : region)) });
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
      setDraft(next); pending.current = next;
      setHistory([next]); setHistoryAt(0);
      setVersion((current) => current + 1);
      onSaved(data.graphicAdjustments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the layout");
    } finally {
      setSaving(false);
    }
  }

  return <section className="editor">
    <header className="editor-head">
      <div>
        <p className="eyebrow">LAYOUT</p>
        <h3>Click anything to select it</h3>
        <p className="editor-sub">Drag to move. Drag the corner handle to resize. {saved ? "A saved layout is active — approving keeps it for the next article with a similar image." : "Nothing is kept until you save."}</p>
      </div>
      <div className="editor-head-actions">
        <div className="editor-history" role="group" aria-label="History">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
        </div>
      <div className="editor-view-toggle" role="group" aria-label="Preview mode">
        <button type="button" className={showExact ? "" : "is-on"} onClick={() => setShowExact(false)}>Edit</button>
        <button type="button" className={showExact ? "is-on" : ""} onClick={() => setShowExact(true)}>Exact render</button>
      </div>
      </div>
    </header>

    <GraphicCanvas
      imageUrl={imageUrl}
      topicHeading={topicHeading}
      articleTitle={articleTitle}
      guidance={guidance}
      sourceImageHasText={sourceImageHasText}
      values={values}
      selection={selection}
      onSelect={setSelection}
      onChange={setDraft}
      onCommit={commit}
      onDeleteSelected={deleteSelected}
      exactSrc={exactSrc}
      showExact={showExact}
    />

    <div className="editor-toolbar">
      <div className="editor-tool">
        <span className="editor-tool-label">Photo zoom</span>
        <div className="editor-stepper">
          <button type="button" onClick={() => nudgeZoom(-0.05)} aria-label="Zoom out">−</button>
          <input type="range" min={0} max={1} step={0.01} value={values.zoom} onChange={(event) => setDraft({ ...draft, zoom: Number(event.target.value) })} onPointerUp={commit} onKeyUp={commit} aria-label="Photo zoom" />
          <button type="button" onClick={() => nudgeZoom(0.05)} aria-label="Zoom in">+</button>
          <strong>{Math.round(values.zoom * 100)}%</strong>
        </div>
      </div>

      <div className="editor-tool">
        <span className="editor-tool-label">Overlay</span>
        <div className="editor-segmented">
          {scrimOptions.map((option) => (
            <button type="button" key={option} className={values.scrim === option ? "is-on" : ""} onClick={() => apply({ ...draft, scrim: option })}>{option}</button>
          ))}
        </div>
      </div>
    </div>

    {selection === "heading" || !selection ? <div className="editor-panel">
      <label className="editor-field">
        <span>Heading text</span>
        <input
          type="text"
          maxLength={60}
          value={draft.topicHeading ?? topicHeading}
          onChange={(event) => setDraft({ ...draft, topicHeading: event.target.value })}
          onBlur={(event) => apply({ ...draft, topicHeading: event.target.value.trim() || undefined })}
        />
      </label>
      <p className="editor-note">The headline below the divider is the article title and is preserved exactly.</p>
    </div> : null}

    {selection === "badge" || values.badge === null ? <div className="editor-panel"><div className="editor-panel-head"><span>Brand badge</span><div className="editor-inline-actions">{values.badge === null ? <button type="button" onClick={() => apply({ ...draft, badge: undefined })}>Restore</button> : <button type="button" onClick={deleteSelected}>Remove</button>}</div></div><p className="editor-note">Select the badge on the canvas to move it. Drag its corner handle to resize it.</p></div> : null}

    <div className="editor-panel">
      <div className="editor-panel-head">
        <span>Shaded areas</span>
        <div className="editor-inline-actions">
          <button type="button" disabled={regions.length >= maxRegions} onClick={() => { apply({ ...draft, regions: [...regions, newRegion] }); setSelection({ region: regions.length }); }}>Add</button>
          {selectedRegion !== null && regions[selectedRegion] ? <button type="button" onClick={deleteSelected}>Remove</button> : null}
        </div>
      </div>
      {selectedRegion !== null && regions[selectedRegion] ? <div className="editor-region-controls">
        <label><span>Colour</span><input type="color" value={regions[selectedRegion].color} onChange={(event) => updateRegion(selectedRegion, { color: event.target.value })} /></label>
        <label><span>Opacity <strong>{Math.round(regions[selectedRegion].opacity * 100)}%</strong></span><input type="range" min={0} max={1} step={0.05} value={regions[selectedRegion].opacity} onChange={(event) => updateRegion(selectedRegion, { opacity: Number(event.target.value) })} /></label>
      </div> : <p className="editor-note">Add a shaded box, then drag it on the graphic. Select it to set colour and opacity.</p>}
    </div>

    <button type="button" className="editor-disclosure" onClick={() => setShowValues((current) => !current)}>
      {showValues ? "Hide exact values" : "Exact values"}
    </button>

    {showValues ? <div className="editor-values">
      {sliderFields.map((field) => (
        <label className="editor-value" key={field.key}>
          <span>{field.label}<strong>{formatValue(values[field.key], field.displayScale, field.unit)}</strong></span>
          <input type="range" min={field.min} max={field.max} step={field.step} value={values[field.key]} onChange={(event) => setDraft({ ...draft, [field.key]: Number(event.target.value) })} onPointerUp={commit} onKeyUp={commit} />
        </label>
      ))}
    </div> : null}

    <footer className="editor-actions">
      <button type="button" onClick={() => save()} disabled={saving || !dirty}>{saving ? <Spinner label="Saving…" /> : "Save layout"}</button>
      <button type="button" className="secondary" onClick={() => { apply({}); setSelection(null); }} disabled={saving || !Object.keys(draft).length}>Reset</button>
      {saved ? <button type="button" className="outline" onClick={() => save(true)} disabled={saving}>Back to automatic</button> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </footer>
  </section>;
}
