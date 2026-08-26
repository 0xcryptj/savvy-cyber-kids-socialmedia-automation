"use client";

import { useEffect, useState } from "react";

/** Auto-dismissing confirmation toast with a drawn-checkmark animation. */
export function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 2600);
    const doneTimer = window.setTimeout(onDone, 3000);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div className={`success-toast${leaving ? " is-leaving" : ""}`} role="status">
      <svg className="success-toast-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="23" />
        <path d="M14 27l7 7 17-17" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
