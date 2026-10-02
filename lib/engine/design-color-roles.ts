import type { DesignContract } from "../domain/design-contract";

type Color = { hex: string; role: string };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}

export function colorContrast(left: string, right: string): number {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Preview and delivery assign the same roles; never invent a second palette. */
export function resolveDesignColorRoles(palette: Color[]): DesignContract["colorRoles"] {
  if (!palette.length || palette.some((color) => !/^#[0-9a-f]{6}$/i.test(color.hex))) throw new Error("Invalid design palette.");
  const surface = palette.find((color) => /background|base|canvas|environment|field/i.test(color.role)) ?? palette[0];
  const contrast = (hex: string) => colorContrast(hex, surface.hex);
  const readable = [...palette].sort((left, right) => contrast(right.hex) - contrast(left.hex));
  const text = palette.find((color) => /text|foreground|ink|copy/i.test(color.role) && contrast(color.hex) >= 4.5) ?? readable[0];
  const raised = palette.find((color) => color !== surface && /surface|panel|raised/i.test(color.role)) ?? surface;
  const muted = palette.find((color) => /muted|secondary.*text/i.test(color.role) && contrast(color.hex) >= 4.5) ?? text;
  const accent = palette.find((color) => /accent|action|active|selection|highlight/i.test(color.role))
    ?? palette.find((color) => color !== surface && color !== text) ?? text;
  return { surface: surface.hex, surfaceRaised: raised.hex, textPrimary: text.hex, textMuted: muted.hex, accent: accent.hex };
}
