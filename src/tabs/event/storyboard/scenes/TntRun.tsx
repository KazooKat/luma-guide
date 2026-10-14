// TNT Run: you run a route over the floor; each block turns hot when you step on it and drops `blockDelaySeconds`
// later. The score ticks at `pointsPerSecond` and every `pointsPerToken` lights a token. Game time is compressed so
// the loop reaches 2 tokens, which is why the scene says "sped up".
import { cellCenter, clamp, Dot, Float, Grid, Label, lerp, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'tnt-run';

const COLS = 16, ROWS = 6, SIZE = 18, GAP = 3;
const GX = (400 - (COLS * (SIZE + GAP) - GAP)) / 2, GY = 22;
/**
 * The runner's route: along rows 0, 2 and 4, turning down at the ends, so it never steps on a gap and rows 1, 3 and 5
 * stay mostly whole (a TNT Run floor ends up full of holes rather than gone).
 */
const ROUTE: [number, number][] = [];
for (let lane = 0; lane < ROWS / 2; lane++) {
  const r = lane * 2;
  for (let i = 0; i < COLS; i++) ROUTE.push([lane % 2 ? COLS - 1 - i : i, r]);
  if (r + 2 < ROWS) ROUTE.push([lane % 2 ? 0 : COLS - 1, r + 1]);
}
const N = ROUTE.length;
const STEP = new Map(ROUTE.map(([c, r], i) => [`${c},${r}`, i]));

export function Scene({ beat, t, values }: SceneProps) {
  const pps = values.pointsPerSecond, ppt = values.pointsPerToken, max = values.maxTokens, delay = values.blockDelaySeconds;
  const perToken = ppt / pps;
  // The loop covers 2.4 tokens' worth of game time, so the first token lands in beat 2 and the second in beat 3.
  const span = perToken * 2.4;
  const g = ((beat + t) / 3) * span;
  const secPerCell = span / N;
  const at = clamp(g / secPerCell, 0, N - 1);
  const i0 = Math.floor(at);
  const [ax, ay] = cellCenter(GX, GY, SIZE, GAP, ...ROUTE[i0]);
  const [bx, by] = cellCenter(GX, GY, SIZE, GAP, ...ROUTE[Math.min(N - 1, i0 + 1)]);
  const px = lerp(ax, bx, at - i0), py = lerp(ay, by, at - i0);

  const look = (c: number, r: number) => {
    const step = STEP.get(`${c},${r}`);
    if (step === undefined) return undefined;
    const since = g - step * secPerCell;
    if (since < 0) return undefined;
    if (since < delay) return { kind: 'hot' as const };
    return { kind: 'hot' as const, fall: seg(since, delay, delay + 0.8) };
  };

  const pts = Math.floor(g * pps);
  const toks = Math.min(max, Math.floor(pts / ppt));
  const sinceToken = toks ? g - (toks * ppt) / pps : -1;
  const tokY = 168, tokEnd = 400 - GX;
  const tokX = tokEnd - max * 14 + 4 + (toks - 1) * 14 + 5;

  return (
    <Stage>
      <SpedUp />
      <Grid x={GX} y={GY} cols={COLS} rows={ROWS} size={SIZE} gap={GAP} look={look} />
      <Dot x={px} y={py} />
      <g opacity={beat === 0 ? 1 : 0.6}>
        <Readout x={GX} y={190} text={`${pts} pts`} anchor="start" />
      </g>
      <g opacity={beat === 2 ? 1 : 0.6}>
        <Tokens x={tokEnd} y={tokY} n={toks} max={max} anchor="end" />
        <Label x={tokEnd} y={tokY + 26} text={`${toks} token${toks === 1 ? '' : 's'}`} anchor="end" />
      </g>
      <Float x={tokX} y={tokY - 4} p={sinceToken < 0 ? 0 : sinceToken / 2.5} text="+1" />
    </Stage>
  );
}
