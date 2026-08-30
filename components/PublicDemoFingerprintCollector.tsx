"use client";

import { useEffect } from "react";
import { rememberVisualFingerprint } from "@/lib/client/design-memory";
import { isRenderGateReport } from "@/lib/project/render-gate";

/** Seeds only numeric DOM fingerprints from the six frozen examples. */
export function PublicDemoFingerprintCollector() {
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object") return;
      const probeId = String((event.data as { probeId?: unknown }).probeId ?? "");
      if (!probeId.startsWith("gallery-")) return;
      if (isRenderGateReport(event.data, probeId) && Math.abs(event.data.viewport.width - 1440) <= 2) {
        rememberVisualFingerprint(event.data.fingerprint);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return null;
}
