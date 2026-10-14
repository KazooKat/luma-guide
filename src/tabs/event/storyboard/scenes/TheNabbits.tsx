// The Nabbits: you flee the Nabbit over carrots; only 1 carrot in `carrotOdds` gives a point, and the Nabbit lands 2 of
// its `hitsToCatch` hits. In beat 2 the last hit catches you and you turn into a Nabbit (it could as well have been a
// Rabbit, like the one hopping nearby), then a full minute passes and everyone gets `pointsPerMinute`. The pay beat
// is honest about the bug: the formula's 1 token per point (up to `tokenCap`) is struck out, because players still
// in at the end are paid nothing. Game time is compressed, so the scene says "sped up".
import type { Pt } from '../kit';
import { along, clamp, Dot, easeInOut, Float, Label, lerp, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'the-nabbits';

const AX = 10, AY = 22, AW = 380, AH = 128;
/** Your run in beat 1. You cover RUN_SPAN of it, so the beat ends with you short of the last point. */
const RUN: Pt[] = [[64, 118], [150, 70], [244, 112], [330, 62]];
const RUN_SPAN = 0.9;
/** Carrots along your run (as progress on it), and which one is the lucky 1 in 10 that scores. */
const CARROTS = [0.18, 0.4, 0.62];
const LUCKY = 1;
const LOOSE: Pt[] = [[40, 74], [300, 138], [372, 104]];
const HITS = [0.3, 0.58];
const RABBIT: Pt = [96, 58];
const FLEER: Pt = [230, 126];

/** A triangular bump, 1 at `at` and 0 more than `w` away. */
const bump = (t: number, at: number, w: number) => clamp(1 - Math.abs(t - at) / w);

function Carrot({ x, y }: { x: number; y: number }) {
  return <polygon points={`${x - 4},${y - 5} ${x + 4},${y - 5} ${x},${y + 6}`} style={{ fill: 'var(--sb-hot)' }} />;
}
/** A Rabbit: a small player with ears. */
function Rabbit({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x - 3} cy={y - 8} rx={2} ry={5} class="sb-a" />
      <ellipse cx={x + 3} cy={y - 8} rx={2} ry={5} class="sb-a" />
      <circle cx={x} cy={y} r={6} class="sb-a" />
    </g>
  );
}
/** `n` hit stars above a player, the first `lit` filled. */
function Stars({ x, y, n, lit }: { x: number; y: number; n: number; lit: number }) {
  const step = 9, x0 = x - ((n - 1) * step) / 2;
  return <g>{Array.from({ length: n }, (_, i) => <circle key={i} cx={x0 + i * step} cy={y} r={3} style={{ fill: i < lit ? 'var(--sb-hot)' : 'var(--sb-token-off)' }} />)}</g>;
}

export function Scene({ beat, t, values }: SceneProps) {
  const toCatch = values.hitsToCatch, odds = values.carrotOdds, perMin = values.pointsPerMinute, cap = values.tokenCap;
  const run = beat === 0 ? t * RUN_SPAN : RUN_SPAN;
  const runEnd = along(RUN, RUN_SPAN);

  // Beat 1: the Nabbit trails you and closes in for each hit.
  const lag = beat === 0 ? 0.14 - HITS.reduce((l, h) => l + 0.11 * bump(t, h, 0.08), 0) : 0;
  const carrotPts = beat === 0 && run < CARROTS[LUCKY] ? 0 : 1;
  const hits = beat === 0 ? HITS.filter((h) => t >= h).length : HITS.length;

  // Beat 2: the last hit lands at CATCH, you become a Nabbit and go after the other fleeing player; a minute ticks over.
  const CATCH = 0.18, MINUTE = 0.52;
  const caught = beat === 2 || (beat === 1 && t >= CATCH);
  const lastHit = beat === 1 && t >= CATCH;
  const minute = beat === 2 || (beat === 1 && t >= MINUTE);
  const pts = carrotPts + (minute ? perMin : 0);

  let you: Pt = beat === 0 ? along(RUN, run) : runEnd;
  let nabbit: Pt = beat === 0 ? along(RUN, Math.max(0, run - lag)) : along(RUN, RUN_SPAN - 0.14);
  let fleer: Pt = FLEER;
  if (beat >= 1) {
    const u = beat === 1 ? t : 1;
    const close = easeInOut(seg(u, 0, CATCH));
    const from = along(RUN, RUN_SPAN - 0.14);
    nabbit = u < CATCH ? [lerp(from[0], runEnd[0] - 16, close), lerp(from[1], runEnd[1] + 4, close)]
      : [lerp(runEnd[0] - 16, 340, easeInOut(seg(u, CATCH, 0.8))), lerp(runEnd[1] + 4, 128, easeInOut(seg(u, CATCH, 0.8)))];
    const chase = easeInOut(seg(u, CATCH + 0.08, 1));
    you = [lerp(runEnd[0], FLEER[0] + 40, chase), lerp(runEnd[1], FLEER[1] - 24, chase)];
    fleer = [lerp(FLEER[0], FLEER[0] - 60, chase), lerp(FLEER[1], FLEER[1] - 6, chase)];
  }
  const hop = Math.abs(Math.sin((beat + t) * Math.PI * 4)) * 4;
  const everyone: Pt[] = [you, nabbit, fleer, [RABBIT[0], RABBIT[1] - hop]];
  const minuteP = beat === 1 ? (t - MINUTE) / 0.4 : 0;
  const carrotP = beat === 0 ? (t - CARROTS[LUCKY] / RUN_SPAN) / 0.5 : 0;
  const lucky = along(RUN, CARROTS[LUCKY]);

  const would = Math.min(cap, pts);
  const strike = beat === 2 ? seg(t, 0.3, 0.5) : 0;
  const tokW = cap * 18 - 4, tokX = 200 - tokW / 2;

  return (
    <Stage>
      <SpedUp />
      {/* Hidden in beat 3 so the payout sits on a clean background. */}
      <g opacity={beat === 2 ? 0 : 1}>
        <rect x={AX} y={AY} width={AW} height={AH} rx={10} style={{ fill: 'var(--sb-cell)', fillOpacity: 0.35 }} />
        {LOOSE.map(([x, y], i) => <Carrot key={`l${i}`} x={x} y={y} />)}
        {CARROTS.map((c, i) => {
          if (beat > 0 || run >= c) return null;
          const [x, y] = along(RUN, c);
          return <Carrot key={i} x={x} y={y} />;
        })}
        <g opacity={beat === 0 ? 0.5 : 1}>
          <Rabbit x={RABBIT[0]} y={RABBIT[1] - hop} />
          {beat < 2 && <Label x={RABBIT[0] + 12} y={RABBIT[1] + 4} text="Rabbit" muted />}
        </g>
        <Dot x={fleer[0]} y={fleer[1]} kind="rival" opacity={beat === 0 ? 0.6 : 1} />
        <Dot x={nabbit[0]} y={nabbit[1]} kind="b" />
        {/* Your run only heads right, so the Nabbit is always behind you on the left: label it above and to its left,
            clear of you, your hit stars and the "1 in 10" carrot label. */}
        {beat === 0 && <Label x={nabbit[0] - 4} y={nabbit[1] - 12} text="Nabbit" anchor="end" muted />}
        <Dot x={you[0]} y={you[1]} />
        {caught && <circle cx={you[0]} cy={you[1]} r={6} class="sb-b" />}
        {!caught && <Stars x={you[0]} y={you[1] - 18} n={toCatch} lit={hits} />}
        {lastHit && t < CATCH + 0.25 && <Stars x={you[0]} y={you[1] - 18} n={toCatch} lit={toCatch} />}
        {beat === 1 && caught && <Label x={200} y={AY + 16} text="caught: Nabbit or Rabbit" anchor="middle" />}
        <Float x={lucky[0]} y={lucky[1] - 10} p={carrotP} text="+1" />
        {beat === 0 && <Label x={lucky[0]} y={lucky[1] + 22} text={`1 in ${odds}`} anchor="middle" muted />}
        {everyone.map(([x, y], i) => <Float key={i} x={x} y={y - 14} p={minuteP} text={`+${perMin}`} />)}
      </g>

      {beat === 2 && (
        <g>
          <Label x={200} y={52} text={`formula: 1 per point, up to ${cap}`} anchor="middle" muted />
          <Tokens x={tokX} y={64} n={strike > 0 ? 0 : would} max={cap} size={14} />
          <line x1={tokX - 6} y1={71} x2={lerp(tokX - 6, tokX + tokW + 6, strike)} y2={71} style={{ stroke: 'var(--sb-hot)', strokeWidth: 3, strokeLinecap: 'round' }} />
          {strike >= 1 && <Label x={200} y={104} text="paid at the end: nothing" anchor="middle" />}
        </g>
      )}

      <g opacity={beat === 2 ? 0.6 : 1}>
        <Readout x={AX} y={192} text={`${pts} pt${pts === 1 ? '' : 's'}`} anchor="start" />
      </g>
      {beat === 2 && <Readout x={390} y={192} text="0 tokens" />}
    </Stage>
  );
}
