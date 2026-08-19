"use client";

import { useEffect } from "react";

export function ServerLifecycle({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const tokenPromise = fetch("/api/runtime").then((response) => response.ok ? response.json() as Promise<{ lifecycleEnabled: boolean; token?: string }> : null).catch(() => null);
    const sessionId = crypto.randomUUID();
    let token: string | undefined;
    let closed = false;
    const send = (event: "heartbeat" | "close") => {
      if (!token || closed && event === "heartbeat") return;
      const body = JSON.stringify({ token, sessionId, event });
      if (event === "close" && navigator.sendBeacon) navigator.sendBeacon("/api/runtime", new Blob([body], { type: "application/json" }));
      else void fetch("/api/runtime", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: event === "close" });
    };
    void tokenPromise.then((data) => {
      if (data?.lifecycleEnabled) { token = data.token; send("heartbeat"); }
    });
    const heartbeat = window.setInterval(() => send("heartbeat"), 15_000);
    const close = () => { closed = true; send("close"); };
    window.addEventListener("pagehide", close, { once: true });
    return () => { window.clearInterval(heartbeat); window.removeEventListener("pagehide", close); };
  }, [enabled]);
  return null;
}
