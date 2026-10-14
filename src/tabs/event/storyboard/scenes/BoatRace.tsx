// Boat Race 2: `starters` rafts race `laps` laps of a loop with 2 checkpoints and a finish line. The loop plays one
// lap per beat, and you cross the line in each beat: 4th, then 6th, then 5th. Each crossing scores starters + 1 minus
// your place and pays `topTokens` if you are in the top `topPlaces`, otherwise `otherTokens`, shown as a results table
// in the infield and a running total along the bottom. Game time is compressed, so the scene says "sped up".
import type { Pt } from '../kit';
import { clamp, Dot, easeInOut, easeOut, Label, lerp, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'boat-race';

const CX = 200, CY = 90, HALF = 100, R = 58, TRACK = 26;
const PERIM = 4 * HALF + 2 * Math.PI * R;

/**
 * The point at lap progress `s` (any real; the whole part is the lap) on the stadium loop, starting at the finish
 * line in the middle of the top straight and running clockwise, pushed `off` px outward from the racing line.
 */
function trackAt(s: number, off = 0): Pt {
  let d = (((s % 1) + 1) % 1) * PERIM;
  const top = CY - R, bot = CY + R, arc = Math.PI * R;
  if (d < HALF) return [CX + d, top - off];
  d -= HALF;
  if (d < arc) { const a = -Math.PI / 2 + d / R; return [CX + HALF + (R + off) * Math.cos(a), CY + (R + off) * Math.sin(a)]; }
  d -= arc;
  if (d < 2 * HALF) return [CX + HALF - d, bot + off];
  d -= 2 * HALF;
  if (d < arc) { const a = Math.PI / 2 + d / R; return [CX - HALF + (R + off) * Math.cos(a), CY + (R + off) * Math.sin(a)]; }
  d -= arc;
  return [CX - HALF + d, top - off];
}

/** Where the 2 checkpoints sit, as lap progress. */
const CHECKPOINTS = [0.36, 0.7];
/** Your lap progress at loop time 0, so you cross the line at t = 0.55 of each beat. */
const START = 0.45;
/**
 * The 7 rivals' lead over you in laps, at loop times 0, 0.55, 1.55, 2.55 and 3 (your 3 crossings). At those crossings
 * 3, then 5, then 4 are ahead of you: you finish laps 4th, 6th and 5th.
 */
const LEADS = [
  [0.2, 0.18, 0.22, 0.25, 0.25],
  [0.1, 0.12, 0.15, 0.14, 0.14],
  [0.05, 0.07, 0.09, 0.08, 0.08],
  [-0.03, -0.05, 0.05, 0.04, 0.04],
  [-0.08, -0.07, 0.04, -0.05, -0.05],
  [-0.12, -0.1, -0.06, -0.07, -0.07],
  [-0.18, -0.2, -0.16, -0.15, -0.15],
];
const KEYS = [0, 0.55, 1.55, 2.55, 3];
const LANES = [-7, 5, -3, 8, -8, 2, -5];

const leadAt = (lead: number[], g: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && g > KEYS[i + 1]) i++;
  return lerp(lead[i], lead[i + 1], easeInOut(seg(g, KEYS[i], KEYS[i + 1])));
};
/** Lap progress shown on the track: racing until the last lap is done, then coasting `coast` laps past the line. */
const shown = (raw: number, laps: number, coast = 0.05) => (raw < laps ? raw : laps + coast * easeOut(clamp((raw - laps) / 0.3)));
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export function Scene({ beat, t, values }: SceneProps) {
  const laps = values.laps, starters = values.starters, top = values.topPlaces;
  const topTok = values.topTokens, otherTok = values.otherTokens;
  const g = beat + t;
  const raw = g + START;
  const rivals = LEADS.slice(0, starters - 1).map((lead) => raw + leadAt(lead, g));

  // Your place at each crossing so far, and what it scored and paid.
  const results: { lap: number; place: number; pts: number; tok: number; at: number }[] = [];
  for (let lap = 1; lap <= laps; lap++) {
    const at = lap - START;
    if (g < at) break;
    const place = 1 + LEADS.slice(0, starters - 1).filter((lead) => leadAt(lead, at) > 0).length;
    results.push({ lap, place, pts: starters + 1 - place, tok: place <= top ? topTok : otherTok, at });
  }
  const done = results.length >= laps;
  const livePlace = 1 + rivals.filter((r) => r > raw).length;
  const pts = results.reduce((a, r) => a + r.pts, 0);
  const toks = results.reduce((a, r) => a + r.tok, 0);
  const lapFrac = raw - Math.floor(raw);

  const [fx, fy] = trackAt(0);
  const gate = (s: number, passed: boolean, i: number) => {
    const [x, y] = trackAt(s, -TRACK / 2 - 2), [x2, y2] = trackAt(s, TRACK / 2 + 2);
    return <line key={i} x1={x} y1={y} x2={x2} y2={y2} style={{ stroke: passed ? 'var(--sb-safe)' : 'var(--sb-wall)', strokeWidth: 4, strokeLinecap: 'round' }} />;
  };
  const you = trackAt(shown(raw, laps));
  const rowY = (i: number) => 84 + i * 19;

  return (
    <Stage>
      <SpedUp />
      <path
        d={`M ${CX} ${CY - R} H ${CX + HALF} A ${R} ${R} 0 0 1 ${CX + HALF} ${CY + R} H ${CX - HALF} A ${R} ${R} 0 0 1 ${CX - HALF} ${CY - R} Z`}
        style={{ fill: 'none', stroke: 'var(--sb-cell)', strokeWidth: TRACK }}
      />
      <g opacity={beat === 0 ? 1 : 0.55}>{CHECKPOINTS.map((s, i) => gate(s, done || lapFrac >= s, i))}</g>
      <line x1={fx} y1={fy - TRACK / 2 - 2} x2={fx} y2={fy + TRACK / 2 + 2} style={{ stroke: 'var(--text)', strokeWidth: 4, strokeDasharray: '3 3' }} />
      <Label x={fx} y={fy - TRACK / 2 - 6} text="finish" anchor="middle" muted />
      {rivals.map((r, i) => {
        const [x, y] = trackAt(shown(r, laps, 0.03 + 0.012 * (6 - i)), LANES[i]);
        return <Dot key={i} x={x} y={y} r={5} kind="rival" opacity={beat === 0 ? 1 : 0.7} />;
      })}
      <Dot x={you[0]} y={you[1]} r={6} />

      {/* Infield: the lap and your place now, then 1 row per lap you have finished. */}
      <Label x={CX} y={62} text={done ? 'Finished' : `Lap ${Math.floor(raw) + 1} of ${laps}, ${ordinal(livePlace)}`} anchor="middle" />
      {results.map((r, i) => (
        <g key={r.lap} opacity={seg(g, r.at, r.at + 0.12)}>
          <Label x={112} y={rowY(i)} text={`Lap ${r.lap}`} muted />
          <Label x={160} y={rowY(i)} text={ordinal(r.place)} />
          <g opacity={beat === 2 ? 0.55 : 1}><Label x={232} y={rowY(i)} text={`+${r.pts} pt${r.pts === 1 ? '' : 's'}`} anchor="end" /></g>
          <g opacity={beat === 2 ? 1 : 0.55}><Tokens x={244} y={rowY(i) - 9} n={r.tok} max={topTok} size={9} /></g>
        </g>
      ))}

      <g opacity={beat === 1 ? 1 : 0.6}>
        <Readout x={8} y={194} text={`${pts} pts`} anchor="start" />
      </g>
      <g opacity={beat === 2 ? 1 : 0.6}>
        <Tokens x={392} y={180} n={toks} max={laps * topTok} anchor="end" />
        <Label x={392 - laps * topTok * 14} y={190} text={`${toks} tokens`} anchor="end" />
      </g>
    </Stage>
  );
}
