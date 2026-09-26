import type { DesignDirectionCandidate } from "@/lib/domain/design-direction";
import styles from "./DirectionSketch.module.css";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

/** A schematic, never a claim that this candidate has already been generated. */
export default function DirectionSketch({ candidate }: { candidate: DesignDirectionCandidate }) {
  const { experienceModel: model, openingMode, density, navigationModel } = candidate.descriptors;
  const palette = candidate.identity.palette.filter((color) => /^#[\da-f]{6}$/i.test(color.hex));
  const background = palette.find((color) => /background|base|surface|environment|field/i.test(color.role))?.hex ?? "#f3f2ec";
  const contrast = (hex: string) => (Math.max(luminance(hex), luminance(background)) + .05) / (Math.min(luminance(hex), luminance(background)) + .05);
  const readable = [...palette].sort((a, b) => contrast(b.hex) - contrast(a.hex));
  const ink = readable[0] && contrast(readable[0].hex) >= 3 ? readable[0].hex : luminance(background) > .3 ? "#171713" : "#f3f2ec";
  const accent = palette.find((color) => color.hex !== background && /accent|action|active|selection|status|mark|object|voice/i.test(color.role))?.hex
    ?? palette.find((color) => color.hex !== background && color.hex !== ink)?.hex ?? ink;
  const media = candidate.descriptors.mediaRole !== "none";
  const rows = density === "dense" ? 6 : density === "airy" ? 3 : 4;
  const line = (x: number, y: number, width: number, opacity = .3) => <rect x={x} y={y} width={width} height={3} rx={1} fill={ink} opacity={opacity} />;
  const block = (x: number, y: number, width: number, height: number) => <rect x={x} y={y} width={width} height={height} rx={2} fill={accent} opacity={.22} />;
  return (
    <figure className={styles.sketch}>
      <svg viewBox="0 0 320 200" role="img" aria-label={`${candidate.concept}: ${model}, ${openingMode}, ${navigationModel}; composition sketch`} data-experience={model}>
        <rect width={320} height={200} fill={background} />
        {line(16, 15, 31, .85)}
        {[208, 239, 270].map((x) => <rect key={x} x={x} y={15} width={22} height={3} fill={ink} opacity={.25} />)}
        <path d="M16 29H304" stroke={ink} opacity={.15} />
        {model === "narrative-scroll" && <>
          {openingMode === "media-first" ? <>{block(16, 40, 288, 83)}{line(27, 95, 120, .9)}</> : <>
            {line(16, 48, 144, .85)}{line(16, 61, 107, .7)}{line(16, 85, 120)}{line(16, 97, 90)}
            {media && block(184, 40, 120, 80)}
          </>}
          <rect x={16} y={135} width={53} height={16} fill={accent} />
          {block(16, 165, 87, 25)}{line(120, 168, 151, .6)}{line(120, 179, 110)}
        </>}
        {model === "spatial-map" && <>
          <path d="M90 80L165 122L254 69M165 122L255 165M90 80L59 167" fill="none" stroke={ink} opacity={.3} />
          {[[90, 80, 24], [165, 122, 33], [254, 69, 18], [255, 165, 13], [59, 167, 16]].map(([x, y, radius]) => <g key={x}>
            <circle cx={x} cy={y} r={radius} fill={accent} opacity={.25} />
            <circle cx={x} cy={y} r={4} fill={ink} />
          </g>)}
          {line(16, 45, 88, .75)}{line(214, 188, 80)}
        </>}
        {model === "task-workbench" && <>
          <rect x={0} y={30} width={67} height={170} fill={ink} opacity={.06} />
          {[50, 68, 86, 104, 122].map((y) => <g key={y}>{line(13, y, 39, y === 50 ? .8 : .25)}</g>)}
          {line(81, 43, 113, .8)}<rect x={247} y={39} width={55} height={16} fill={accent} />
          {Array.from({ length: rows }, (_, i) => <g key={i}>
            <path d={`M81 ${77 + i * 18}H304`} stroke={ink} opacity={.12} />
            {line(83, 68 + i * 18, 65, .5)}{line(173, 68 + i * 18, 36)}{line(251, 68 + i * 18, 32, .6)}
          </g>)}
        </>}
        {model === "guided-conversation" && <>
          {[50, 95, 140, 185, 230].map((x, i) => <rect key={x} x={x} y={42} width={37} height={3} fill={i < 2 ? accent : ink} opacity={i < 2 ? 1 : .15} />)}
          {line(50, 70, 208, .8)}{line(50, 84, 143)}
          {[103, 129].map((y) => <g key={y}>{block(50, y, 218, 20)}<circle cx={62} cy={y + 10} r={4} fill="none" stroke={ink} opacity={.6} />{line(75, y + 9, 130, .5)}</g>)}
          <rect x={199} y={166} width={69} height={17} fill={accent} />
        </>}
        {model === "collection-browser" && <>
          {line(16, 44, 81, .8)}{[163, 208, 253].map((x) => <g key={x}>{block(x, 39, 38, 14)}</g>)}
          {block(16, 65, 131, 117)}{block(158, 65, 62, 77)}{block(231, 65, 73, 117)}
          {media && <><ellipse cx={80} cy={114} rx={32} ry={39} fill={accent} opacity={.55} /><path d="M251 89L283 111L264 156Z" fill={accent} opacity={.7} /></>}
          {line(158, 155, 55, .6)}{line(158, 167, 37)}
        </>}
        {model === "live-canvas" && <>
          <path d="M35 143Q102 40 161 104T288 71M35 155H288" fill="none" stroke={accent} strokeWidth={2} />
          {[35, 105, 176, 247].map((x) => <g key={x}><path d={`M${x} 50V153`} stroke={ink} opacity={.09} /></g>)}
          <circle cx={161} cy={104} r={18} fill={accent} opacity={.25} /><circle cx={161} cy={104} r={5} fill={ink} />
          {line(16, 43, 89, .8)}<path d="M35 179H194" stroke={ink} opacity={.4} /><circle cx={109} cy={179} r={5} fill={accent} />
          <rect x={237} y={170} width={51} height={17} fill={accent} />
        </>}
      </svg>
      <figcaption>Composition sketch · {density} density</figcaption>
    </figure>
  );
}
