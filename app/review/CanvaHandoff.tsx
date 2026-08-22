"use client";

import { useState } from "react";
import { designUrls } from "@/config/urls";
import { Spinner } from "@/app/components/Spinner";

function fileName(topicHeading: string, articleTitle: string) {
  const slug = `${topicHeading} ${articleTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `sck-${slug || "social-graphic"}.png`;
}

/**
 * One-click route out to Canva for the occasional graphic the composer cannot
 * get right: hand the finished PNG to the browser and open the brand template
 * beside it, so the reviewer only has to drop the file in.
 */
export function CanvaHandoff({ graphicSrc, topicHeading, articleTitle }: { graphicSrc: string; topicHeading: string; articleTitle: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handoff() {
    setBusy(true); setError(null); setDone(false);
    // Open Canva first, while the click is still the reason anything is
    // happening. Starting with the fetch would put an await between the gesture
    // and window.open, which is exactly what popup blockers stop.
    const canvaTab = window.open(designUrls.canvaTemplate, "_blank", "noopener,noreferrer");
    try {
      const response = await fetch(graphicSrc);
      if (!response.ok) throw new Error(`The graphic could not be rendered (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName(topicHeading, articleTitle);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      setDone(true);
      window.setTimeout(() => setDone(false), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the graphic");
      if (!canvaTab) setError("Allow pop-ups for this site to open Canva automatically.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="canva-handoff">
    <button type="button" className="secondary" onClick={handoff} disabled={busy}>
      {busy ? <Spinner label="Preparing…" /> : "Edit in Canva"} <span>↗</span>
    </button>
    <small className="field-hint">Downloads the finished graphic and opens the Savvy Cyber Kids template. Upload the file in Canva to keep editing by hand.</small>
    {done ? <span className="copy-confirm">Graphic downloaded — drop it into the Canva tab.</span> : null}
    {error ? <span className="error-text">{error}</span> : null}
  </div>;
}
