// MineBattle: a top-down slice of the deepslate arena. You start sealed in a 3x3 pocket and dig a tunnel towards a
// rival's pocket, getting gear from the ores on the way, while every full minute alive adds `pointsPerMinute`. When
// the last block opens you are within `sightBlocks` with nothing solid between you, so the rival shows up, you fight,
// and the kill adds `pointsPerKill`. With 1 rival left that kill ends the game, so beat 3 pays the guide's example:
// `minutesAlive` minutes and 1 kill, 1 token per point up to `maxTokens`. Game time is compressed ("sped up").
import { clamp, Dot, easeInOut, Float, Grid, Label, lerp, Line, Readout, rng, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'minebattle';

const COLS = 22, ROWS = 7, SIZE = 13, GAP = 2;
const GX = (400 - (COLS * (SIZE + GAP) - GAP)) / 2, GY = 24;
const ROW = 3;
const cx = (c: number) => GX + c * (SIZE + GAP) + SIZE / 2;
const cy = (r: number) => GY + r * (SIZE + GAP) + SIZE / 2;

const inBox = (c: number, r: number, c0: number, c1: number, r0: number, r1: number) => c >= c0 && c <= c1 && r >= r0 && r <= r1;
/** Air from the start: your pocket, the rival's pocket, and the tunnel the rival already dug towards you. */
const isAir = (c: number, r: number) =>
  inBox(c, r, 1, 3, 2, 4) || inBox(c, r, 18, 20, 2, 4) || inBox(c, r, 12, 17, ROW, ROW);
/** The blocks you dig, in order: row 3 from just outside your pocket to where the rival's tunnel starts. */
const DIG0 = 4, DIG_N = 8;
const RIVAL_COL = 19;
/** Ores on your tunnel and what they give (from the guide: iron armor, a diamond sword, an emerald effect). */
const PATH_ORES = new Map<number, { fill: string; gives: string }>([
  [5, { fill: 'var(--sb-hot)', gives: 'armor' }],
  [7, { fill: 'var(--sb-team-a)', gives: 'sword' }],
  [9, { fill: 'var(--sb-safe)', gives: 'effect' }],
]);
/** A few ores scattered through the rest of the block, fixed by a seed so every frame matches. */
const SCATTER = (() => {
  const r = rng(11), fills = ['var(--sb-hot)', 'var(--sb-team-a)', 'var(--sb-safe)', 'var(--sb-token)'];
  const out = new Map<string, string>();
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < COLS; c++) {
      const v = r(), f = r();
      if (row !== ROW && !isAir(c, row) && v < 0.09) out.set(`${c},${row}`, fills[Math.floor(f * fills.length)]);
    }
  }
  return out;
})();

/** A label on a small stage-coloured backing, so it reads on top of the blocks. */
function Tag({ x, y, text, muted = false }: { x: number; y: number; text: string; muted?: boolean }) {
  // About 7.5px a character for .sb-lbl (14px) and 6.5px for the muted size (12px).
  const w = text.length * (muted ? 6.5 : 7.5) + 12;
  return (
    <g>
      <rect x={x - w / 2} y={y - 14} width={w} height={19} rx={4} style={{ fill: 'var(--sb-stage)' }} opacity={0.85} />
      <Label x={x} y={y} text={text} anchor="middle" muted={muted} />
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const ppm = values.pointsPerMinute, ppk = values.pointsPerKill, max = values.maxTokens;
  const sight = values.sightBlocks, mins = values.minutesAlive;

  // Digging: beat 1 breaks all but the last block, beat 2 opens it into the rival's tunnel.
  const dug = beat === 0 ? lerp(0, DIG_N - 1, seg(t, 0.05, 1)) : beat === 1 ? lerp(DIG_N - 1, DIG_N, seg(t, 0, 0.15)) : DIG_N;
  const seen = beat === 0 ? 0 : beat === 1 ? seg(t, 0.12, 0.2) : 1;
  const charge = beat === 1 ? easeInOut(seg(t, 0.22, 0.5)) : beat === 2 ? 1 : 0;
  const killT = beat === 1 ? seg(t, 0.5, 0.62) : beat === 2 ? 1 : 0;
  const killed = beat === 2 || (beat === 1 && t >= 0.52);

  // The game clock in minutes. With 1 rival the kill ends the game, so the clock stops there.
  const clock = beat === 0 ? (mins / 2) * t : beat === 1 ? lerp(mins / 2, mins + 0.25, seg(t, 0, 0.52)) : mins + 0.25;
  const full = Math.floor(clock);
  const pts = full * ppm + (killed ? ppk : 0);

  const walk = Math.max(2, dug + 1.4);
  const youCol = lerp(walk, RIVAL_COL - 1.8, charge);
  const rivalCol = lerp(RIVAL_COL, RIVAL_COL - 0.8, charge);
  const y = cy(ROW);

  const look = (c: number, r: number) => {
    if (isAir(c, r)) return { hide: true };
    if (r === ROW && c >= DIG0 && c < DIG0 + DIG_N) return { kind: 'wall' as const, fall: clamp(dug - (c - DIG0)) };
    return { kind: 'wall' as const };
  };
  const ores = [];
  for (const [k, fill] of SCATTER) {
    const [c, r] = k.split(',').map(Number);
    ores.push(<rect key={k} x={cx(c) - 3.5} y={cy(r) - 3.5} width={7} height={7} rx={1.5} style={{ fill }} />);
  }
  const gear: string[] = [];
  const pops = [];
  for (const [c, o] of PATH_ORES) {
    const f = clamp(dug - (c - DIG0));
    if (f < 1) {
      const s = 7 * (1 - 0.6 * f);
      ores.push(<rect key={c} x={cx(c) - s / 2} y={y - s / 2} width={s} height={s} rx={1.5} opacity={1 - f} style={{ fill: o.fill }} />);
    } else {
      gear.push(o.gives);
      pops.push(<Float key={c} x={cx(c)} y={y - 10} p={(dug - (c - DIG0) - 1) / 1.3} text={`+${o.gives}`} />);
    }
  }

  // "+1" at the points for each new minute while the clock runs, and "+2" for the kill.
  const tick = clock - full;
  const minutePop = full >= 1 && !killed ? tick / 0.4 : 0;
  const killPop = beat === 1 ? seg(t, 0.52, 0.85) : 0;

  const tok = Math.min(max, pts);
  const lit = beat === 2 ? Math.min(tok, Math.floor(seg(t, 0.1, 0.6) * tok + 1e-6)) : 0;
  // The newest chip lit at t = 0.1 + 0.5 * lit / tok; its "+1" rises for 0.15 of the beat after that.
  const sinceLit = beat === 2 && lit ? (t - (0.1 + (0.5 * lit) / tok)) / 0.15 : 0;
  const tokEnd = 400 - GX, tokY = 144;

  return (
    <Stage>
      <SpedUp />
      <g opacity={beat === 2 ? 0.35 : 1}>
        <Grid x={GX} y={GY} cols={COLS} rows={ROWS} size={SIZE} gap={GAP} look={look} />
        {ores}
        {beat === 1 && seen > 0 && !killed && (
          <g opacity={seen * (1 - seg(t, 0.4, 0.5))}>
            <Line points={[[cx(youCol) + 10, y], [cx(rivalCol) - 10, y]]} kind="you" dash />
            <Tag x={(cx(youCol) + cx(rivalCol)) / 2} y={y - 12} text={`within ${sight} blocks`} />
          </g>
        )}
        {seen < 1 && (
          <g opacity={1 - seen}>
            <Dot x={cx(rivalCol)} y={y} kind="ghost" />
            <Tag x={cx(rivalCol)} y={y - 14} text="hidden" muted />
          </g>
        )}
        {seen > 0 && killT < 1 && <Dot x={cx(rivalCol)} y={y} kind="rival" opacity={seen * (1 - killT)} r={7 * (1 - 0.4 * killT)} />}
        {killed && (
          <g opacity={beat === 1 ? seg(t, 0.52, 0.6) : 1}>
            <Tag x={cx(rivalCol)} y={y - 14} text={`kill +${ppk}`} />
          </g>
        )}
        <Dot x={cx(youCol)} y={y} />
        {pops}
      </g>
      {gear.length > 0 && <g opacity={beat === 0 ? 1 : 0.6}><Label x={GX} y={14} text={`gear: ${gear.join(', ')}`} /></g>}

      <Readout x={GX} y={166} text={`${pts} pt${pts === 1 ? '' : 's'}`} anchor="start" />
      <Label x={GX} y={188} text={`${full} min alive${killed ? ' + 1 kill' : ''}`} />
      <Float x={GX + 86} y={158} p={minutePop} text={`+${ppm}`} />
      <Float x={GX + 86} y={158} p={killPop} text={`+${ppk}`} />

      <g opacity={beat === 2 ? 1 : 0.35}>
        <Tokens x={tokEnd} y={tokY} n={lit} max={max} size={12} anchor="end" />
        <Label x={tokEnd} y={188} text={beat === 2 ? `${lit} tokens, max ${max}` : `max ${max} tokens`} anchor="end" />
      </g>
      <Float x={tokEnd - max * 16 + 4 + (lit - 1) * 16 + 6} y={tokY - 4} p={sinceLit} text="+1" />
    </Stage>
  );
}
