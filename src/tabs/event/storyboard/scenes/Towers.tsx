// Towers: everyone starts on their own 1-block pillar. Beat 1: 2 item drops (`dropSeconds` apart) give you blocks,
// which you lay as a bridge to the nearest pillar. Beat 2: you cross, hit that player off, and get the kill and their
// items. Beat 3 runs the rest of the game: 2 more kills, then the 1 point for lasting, so tokens = kills + 1.
// Game time is compressed, which is why the scene says "sped up".
import { Dot, easeInOut, easeOut, Float, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'towers';

const CELL = 14, STEP = 16;
const YOU: Pt = [120, 96];
/** The other players' pillars (top-down, 1 block each). The first one is the bridge's end, the rest are far off. */
const FAR: Pt[] = [[338, 50], [58, 150]];
/** Beat 1 timing: when each drop lands, and how long a placed block takes to pop in. */
const DROPS = [0.05, 0.5], PERIOD = 0.45, POP = 0.05;

function Pillar({ at }: { at: Pt }) {
  return <rect class="sb-c wall" x={at[0] - CELL / 2} y={at[1] - CELL / 2} width={CELL} height={CELL} rx={2} />;
}

/** A rival who is hit at `p` = 0 and falls off by `p` = 1: pushed along `push`, shrinking and fading, then a ghost. */
function Faller({ at, push, p }: { at: Pt; push: Pt; p: number }) {
  if (p <= 0) return <Dot x={at[0]} y={at[1]} kind="rival" />;
  const e = easeOut(Math.min(1, p));
  const x = at[0] + push[0] * e, y = at[1] + push[1] * e;
  if (p >= 1) return <Dot x={x} y={y} kind="ghost" />;
  return <Dot x={x} y={y} kind="rival" r={7 * (1 - 0.6 * p)} opacity={1 - p} />;
}

export function Scene({ beat, t, values }: SceneProps) {
  const dropSec = values.dropSeconds, max = values.maxTokens, kills = values.kills, endPoint = values.endPoint;
  const drops = [values.firstDropBlocks, values.secondDropBlocks];
  const bridge = drops[0] + drops[1];
  const near: Pt = [YOU[0] + (bridge + 1) * STEP, YOU[1]];
  const edge: Pt = [YOU[0] + bridge * STEP, YOU[1]];

  // Beat 1: each drop's blocks go down one after another, out from your pillar.
  const placedAt = (i: number) => {
    const d = i < drops[0] ? 0 : 1;
    const k = d ? i - drops[0] : i;
    return DROPS[d] + 0.07 + k * 0.04;
  };
  const blocks = Array.from({ length: bridge }, (_, i) => {
    const s = beat === 0 ? easeOut(seg(t, placedAt(i), placedAt(i) + POP)) : 1;
    if (s <= 0) return null;
    const cx = YOU[0] + (i + 1) * STEP, size = CELL * s;
    return <rect key={i} class="sb-c" x={cx - size / 2} y={YOU[1] - size / 2} width={size} height={size} rx={2} />;
  });

  // The "Next drop in" bar keeps its 9 second cycle through the loop (beat 1 lines it up with the 2 drops).
  const g = beat + t;
  const cycle = g < DROPS[0] ? 0 : ((g - DROPS[0]) / PERIOD) % 1;
  const left = 1 - cycle;

  // Beat 2: walk the bridge, hit the player at its end, and their items fly to you.
  const cross = beat === 0 ? 0 : beat === 1 ? easeInOut(seg(t, 0, 0.4)) : 1;
  const you: Pt = [lerp(YOU[0], edge[0], cross), YOU[1]];
  const hit1 = beat === 0 ? 0 : beat === 1 ? seg(t, 0.45, 0.65) : 1;
  const loot = beat === 1 ? easeInOut(seg(t, 0.55, 0.72)) : 0;
  // Beat 3: the other 2 go down, then the game ends with you last and gives the end point.
  const FAR_AT = [0.1, 0.3], FALL = 0.12, END_AT = 0.5;
  const farHit = FAR_AT.map((a) => (beat < 2 ? 0 : seg(t, a, a + FALL)));
  const killed = (hit1 >= 1 ? 1 : 0) + farHit.filter((p) => p >= 1).length;
  const shownKills = Math.min(kills, killed);
  const ended = beat === 2 && t >= END_AT;
  const points = shownKills + (ended ? endPoint : 0);
  const toks = Math.min(max, points);

  const tokY = 166, tokEnd = 392;
  const tokX = (i: number) => tokEnd - max * 14 + 4 + i * 14 + 5;
  // Which token lights, and when: the first kill in beat 2, then the 2 far kills and the end point in beat 3.
  const gains: [number, number][] = beat === 1 ? [[0, 0.65]]
    : beat === 2 ? [...FAR_AT.map((a, i): [number, number] => [i + 1, a + FALL]), [FAR_AT.length + 1, END_AT]] : [];

  return (
    <Stage>
      <SpedUp />
      <g opacity={beat === 0 ? 1 : 0.4}>
        <Label x={16} y={18} text={`Next drop in ${Math.ceil(dropSec * left)}s`} />
        <rect class="sb-tok" x={16} y={25} width={130} height={6} rx={3} />
        <rect x={16} y={25} width={130 * left} height={6} rx={3} style={{ fill: 'var(--sb-hot)' }} />
      </g>

      <g opacity={beat === 2 ? 0.5 : 1}>
        {blocks}
        <Pillar at={YOU} />
        <Pillar at={near} />
        {FAR.map((p, i) => <Pillar key={i} at={p} />)}
      </g>

      {beat === 0 && DROPS.map((d, i) => (
        <Float key={i} x={YOU[0]} y={YOU[1] - 12} p={(t - d) / 0.3} text={`+${drops[i]} blocks`} />
      ))}

      {beat === 1 && t > 0.4 && t < 0.55 && <Line points={[you, near]} kind="you" />}
      <Faller at={near} push={[26, 0]} p={hit1} />
      {beat === 1 && loot > 0 && [0, 1, 2].map((i) => (
        <rect
          key={i} x={lerp(near[0], you[0] - 6 + i * 6, loot) - 2.5} y={lerp(near[1], you[1] + 12, loot) - 2.5}
          width={5} height={5} rx={1} style={{ fill: 'var(--sb-hot)' }}
        />
      ))}
      {beat === 1 && <Float x={near[0]} y={near[1] - 14} p={(t - 0.5) / 0.45} text="+1 kill" />}

      {FAR.map((p, i) => <g key={i}>
        {beat === 2 && farHit[i] > 0 && farHit[i] < 0.5 && <Line points={[you, p]} kind="you" dash />}
        <Faller at={p} push={[i ? -18 : 18, 0]} p={farHit[i]} />
      </g>)}

      <Dot x={you[0]} y={you[1]} />
      {ended && <Label x={you[0]} y={you[1] - 18} text={`+${endPoint} for lasting`} anchor="middle" />}

      <g opacity={beat === 0 ? 0.5 : 1}>
        <Readout x={16} y={190} text={`${shownKills} kill${shownKills === 1 ? '' : 's'}`} anchor="start" />
      </g>
      <g opacity={beat === 2 ? 1 : 0.6}>
        <Tokens x={tokEnd} y={tokY} n={toks} max={max} anchor="end" />
        <Label
          x={tokEnd} y={tokY + 26} anchor="end"
          text={ended ? `${shownKills} kills + ${endPoint} = ${toks} tokens` : `${toks} token${toks === 1 ? '' : 's'}`}
        />
      </g>
      {gains.map(([i, at]) => <Float key={i} x={tokX(i)} y={tokY - 4} p={(t - at) / 0.25} text="+1" />)}
    </Stage>
  );
}
