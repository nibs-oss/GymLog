"use client";

import { useState } from "react";

/**
 * Shares the workout's summary image (/api/share/[id]) through the phone's
 * share sheet (Instagram/Facebook stories, Messenger…), or downloads it where
 * sharing files isn't supported (most desktops).
 */
export function ShareWorkoutButton({ sessionId, className }: { sessionId: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${sessionId}`);
      if (!res.ok) throw new Error("Couldn't create the image.");
      const file = new File([await res.blob()], "gymlog-workout.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My workout" });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Closing the share sheet isn't an error
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Couldn't share.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={share} disabled={busy} className={className}>
        {busy ? "Preparing…" : "Share"}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </>
  );
}
