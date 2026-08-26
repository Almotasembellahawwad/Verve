import { ImageResponse } from "next/og";

export const alt = "Verve — AI websites that do not look AI-generated";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px 70px", color: "#f1eee7", background: "#0c0d0f", border: "16px solid #15171b" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, letterSpacing: "0.12em" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}><b style={{ color: "#ff5a36" }}>●</b> VERVE / PUBLIC BETA</span>
        <span style={{ color: "#777981" }}>OPEN SOURCE · LOCAL BYOK</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#ff5a36", fontSize: 28, marginBottom: 22 }}>GENERATE · RENDER · INSPECT · EXPORT</span>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 78, fontWeight: 800, lineHeight: 0.96, letterSpacing: "-0.055em" }}>
          <span>AI websites that do not</span><span>look AI-generated.</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", color: "#a6a8af", fontSize: 23 }}>
        <span>Runnable multi-file projects with evidence.</span><span style={{ color: "#ff7658" }}>verve-dev.vercel.app ↗</span>
      </div>
    </div>,
    size
  );
}
