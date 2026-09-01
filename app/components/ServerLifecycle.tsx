"use client";

import { useEffect } from "react";

export function ServerLifecycle({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const sessionId = crypto.randomUUID();
    let closed = false;
    const send = (event: "heartbeat" | "close") => {
      if (closed && event === "heartbeat") return;
      const body = JSON.stringify({ sessionId, event });
      if (event === "close" && navigator.sendBeacon) navigator.sendBeacon("/api/runtime", new Blob([body], { type: "application/json" }));
      else void fetch("/api/runtime", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: event === "close" });
    };
    send("heartbeat");
    const heartbeat = window.setInterval(() => send("heartbeat"), 15_000);
    const close = () => { closed = true; send("close"); };
    window.addEventListener("pagehide", close, { once: true });
    return () => { window.clearInterval(heartbeat); window.removeEventListener("pagehide", close); };
  }, [enabled]);
  return null;
}
