// Shared drawing pieces for the minigame storyboard scenes, so the 14 games read as one feature.
// Scenes draw in a 400 x 200 SVG and are pure functions of { beat, t, values }: no hooks, no timers, no Math.random.
// Colours come from the .sb-* classes in src/styles.css, so both themes work.
import type { ComponentChildren } from 'preact';

export const W = 400;
export const H = 200;

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progress through the part of a beat between `a` and `b`: 0 before it, 1 after it. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Seeded PRNG (mulberry32), for scatter that is the same on every frame. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pt = [number, number];
/** The point at progress `p` (0 to 1) along a polyline, by distance. */
export function along(points: Pt[], p: number): Pt {
  if (points.length === 1) return points[0];
  const lens = points.slice(1).map((q, i) => Math.hypot(q[0] - points[i][0], q[1] - points[i][1]));
  let d = clamp(p) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? clamp(d / lens[i]) : 0;
      return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)];
    }
    d -= lens[i];
  }
  return points[points.length - 1];
}

/** The scene's root element. */
export function Stage({ children }: { children?: ComponentChildren }) {
  return (
    <svg class="sb-svg" viewBox={`0 0 ${W} ${H}`} role="presentation" focusable="false">
      {children}
    </svg>
  );
}

export type CellKind = 'hot' | 'safe' | 'wall' | 'dim';
/** How one grid cell looks: `kind` picks the colour, `fall` (0 to 1) shrinks and fades it out, `hide` skips it. */
export interface CellLook { kind?: CellKind; fall?: number; hide?: boolean }

/** A cols x rows floor of square cells. `look(c, r)` styles each one. */
export function Grid({ x, y, cols, rows, size, gap = 3, look }: {
  x: number; y: number; cols: number; rows: number; size: number; gap?: number; look?: (c: number, r: number) => CellLook | undefined;
}) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const l = look?.(c, r) ?? {};
      if (l.hide) continue;
      const f = clamp(l.fall ?? 0);
      if (f >= 1) continue;
      const s = size * (1 - 0.6 * f);
      const cx = x + c * (size + gap) + size / 2;
      const cy = y + r * (size + gap) + size / 2;
      cells.push(
        <rect key={`${c},${r}`} class={`sb-c${l.kind ? ` ${l.kind}` : ''}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={3} opacity={1 - f} />,
      );
    }
  }
  return <g>{cells}</g>;
}
/** Centre of grid cell (c, r), for placing players on a Grid drawn with the same numbers. */
export const cellCenter = (x: number, y: number, size: number, gap: number, c: number, r: number): Pt =>
  [x + c * (size + gap) + size / 2, y + r * (size + gap) + size / 2];

export type DotKind = 'you' | 'rival' | 'a' | 'b' | 'ghost';
/** A player seen from above. `you` gets a halo so the eye follows it. */
export function Dot({ x, y, r = 7, kind = 'you', opacity = 1 }: { x: number; y: number; r?: number; kind?: DotKind; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {kind === 'you' && <circle class="sb-ring" cx={x} cy={y} r={r + 4} />}
      <circle class={`sb-${kind}`} cx={x} cy={y} r={r} />
    </g>
  );
}

/** A row of `max` token chips with the first `n` lit, laid out from (x, y) to the right (or ending at x with anchor end). */
export function Tokens({ x, y, n, max, size = 10, anchor = 'start' }: { x: number; y: number; n: number; max: number; size?: number; anchor?: 'start' | 'end' }) {
  const step = size + 4;
  const x0 = anchor === 'end' ? x - max * step + 4 : x;
  return (
    <g>
      {Array.from({ length: max }, (_, i) => (
        <rect key={i} class={`sb-tok${i < n ? ' on' : ''}`} x={x0 + i * step} y={y} width={size} height={size} rx={3} />
      ))}
    </g>
  );
}

/** The big number in a corner ("120 pts", "3 tokens"). */
export function Readout({ x = W - 8, y = H - 10, text, anchor = 'end' }: { x?: number; y?: number; text: string; anchor?: 'start' | 'middle' | 'end' }) {
  return <text class="sb-read" x={x} y={y} text-anchor={anchor}>{text}</text>;
}

/** A small text label. `muted` is for asides like "sped up". */
export function Label({ x, y, text, anchor = 'start', muted = false }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; muted?: boolean }) {
  return <text class={`sb-lbl${muted ? ' muted' : ''}`} x={x} y={y} text-anchor={anchor}>{text}</text>;
}

/** A "+1" style pop that rises and fades as `p` goes 0 to 1 (draw nothing outside that). */
export function Float({ x, y, p, text }: { x: number; y: number; p: number; text: string }) {
  if (p <= 0 || p >= 1) return null;
  return <text class="sb-lbl" x={x} y={y - 18 * easeOut(p)} text-anchor="middle" opacity={1 - p} style={{ fill: 'var(--sb-token)', fontWeight: 800 }}>{text}</text>;
}

/** A line through points; `kind` colours it (you, hot) and `dash` dashes it. */
export function Line({ points, kind, dash = false }: { points: Pt[]; kind?: 'you' | 'hot'; dash?: boolean }) {
  return <polyline class={`sb-line${kind ? ` ${kind}` : ''}${dash ? ' dash' : ''}`} points={points.map((p) => p.join(',')).join(' ')} />;
}

/** "sped up", in the top right of the scene, for scenes that compress game time. */
export const SpedUp = () => <Label x={W - 4} y={12} text="sped up" anchor="end" muted />;
