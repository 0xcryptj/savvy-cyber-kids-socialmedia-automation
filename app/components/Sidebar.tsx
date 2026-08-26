"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarNav } from "./SidebarNav";

const IDLE_COLLAPSE_MS = 60000;

export function Sidebar({ feedsHealthy, pipelineText }: { feedsHealthy: boolean; pipelineText: string }) {
  const [expanded, setExpanded] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  function keepAwake() {
    setExpanded(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setExpanded(false), IDLE_COLLAPSE_MS);
  }

  function collapse() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setExpanded(false);
  }

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  // Expanded, the rail overlays page content rather than pushing it, so a
  // click anywhere outside it should hand that content back immediately
  // instead of making the reviewer wait out the idle timer.
  useEffect(() => {
    if (!expanded) return;
    function handleOutside(event: PointerEvent) {
      if (asideRef.current && !asideRef.current.contains(event.target as Node)) collapse();
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [expanded]);

  return (
    <aside ref={asideRef} className={expanded ? "is-expanded" : undefined} aria-expanded={expanded} onClick={keepAwake}>
      <div className="brand">
        <img className="brand-logo" src="/branding/sck-logo-150.png" alt="Savvy Cyber Kids" />
        <span className="label-fade">savvy<br /><b>cyber kids</b></span>
      </div>
      <p className="eyebrow label-fade">SOCIAL CONTROL ROOM</p>
      <SidebarNav />
      <div className="sidebar-foot label-fade">
        <span className={`live-dot ${feedsHealthy ? "" : "live-dot-error"}`} /> {feedsHealthy ? "Live feeds connected" : "Feed issue — check Library"}
        <br /><small>{pipelineText}</small>
        <br /><small>Human review required</small>
      </div>
    </aside>
  );
}
