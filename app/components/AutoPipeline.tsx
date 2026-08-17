"use client";

import { useEffect } from "react";

export function AutoPipeline() {
  useEffect(() => {
    const key = `sck-auto-pipeline-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "started");
    void fetch("/api/pipeline/run", { method: "POST" }).catch(() => sessionStorage.removeItem(key));
  }, []);

  return null;
}
