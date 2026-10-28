// Manor 2, played as a Hunter. Beat 1: you walk the dark manor holding your flashlight up (a `beamDegrees` wide cone,
// `beamBlocks` long), and each hidden artifact lights up once the beam reaches it; walking onto it collects it for
// `artifactPoints` (`artifactsFound` of them). Beat 2 plays in real time: a Ghost grabs another Hunter (the grab would
// kill in `grabSeconds`), you turn your beam on it, which breaks the grab, and `ghostKillSeconds` of light kills it
// for `ghostKillPoints`. A second Ghost stays hidden the whole time, so the game runs the full `gameMinutes` and ends
// in a tie. Beat 3 pays `minTokens` at `minScore` points or less up to `maxTokens` at `maxScore`, with the `winBonus`
// chip drawn but not earned, because it's a tie.
import { along, clamp, Dot, easeInOut, easeOut, Float, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens, type Pt } from '../kit';
import { BEAT_MS, type SceneProps } from '../Storyboard';

export const key = 'manor-2';

const PX = 7; // px per block
const MAP = { x: 10, y: 20, w: 276, h: 156 };
const RX = 300; // the right-hand panel
/** Inner walls of the manor, as [x, y, w, h]. Every path and beam below stays clear of them. */
const WALLS = [[96, 20, 10, 54], [96, 128, 10, 48], [196, 104, 10, 72]];
/** Your walk in beat 1. The artifacts lie on corners FINDS of it, each at the end of a straight stretch longer than the beam. */
const WALK: Pt[] = [[34, 150], [60, 104], [140, 104], [160, 70], [234, 62]];
const FINDS = [2, 4];
/** An artifact nobody finds, off to the side of your walk. */
const LEFT_OVER: Pt = [150, 150];
const OTHER_GHOST: Pt = [130, 36];
const GHOST_0: Pt = [256, 96];
const GRAB_AT: Pt = [250, 110];
const HUNTER: Pt = [264, 124];
/** After the grab breaks, the Ghost is knocked back and tries to get away. */
const FLEE: Pt[] = [GRAB_AT, [236, 98], [205, 90]];
/** Beat 2 times: the grab starts at GS, your light lands at LS, and the grab breaks at BREAK (well under 1 second later). */
const GS = 0.08, LS = 0.15, BREAK = 0.3;

const toRad = (deg: number) => (deg * Math.PI) / 180;
/** Cumulative lengths along a polyline, from 0 at its start. */
function cumulative(points: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return out;
}
const CUM = cumulative(WALK);
const TOTAL = CUM[CUM.length - 1];
/** The direction you face at progress `p` along WALK: the stretch you're on. */
function headingAt(p: number): number {
  const d = clamp(p) * TOTAL;
  let i = 0;
  while (i < WALK.length - 2 && d > CUM[i + 1]) i++;
  return Math.atan2(WALK[i + 1][1] - WALK[i][1], WALK[i + 1][0] - WALK[i][0]);
}
const walkP = (t: number) => easeInOut(seg(t, 0.04, 0.8));
/** The first t in the beat at which the walk has reached progress p. */
function tWhen(p: number): number {
  for (let i = 0; i <= 200; i++) if (walkP(i / 200) >= p - 1e-9) return i / 200;
  return 1;
}
const fmt = (n: number) => n.toFixed(1);

/** The flashlight's cone seen from above. */
function Beam({ at, angle, len, deg }: { at: Pt; angle: number; len: number; deg: number }) {
  const h = toRad(deg / 2);
  const a = [at[0] + Math.cos(angle - h) * len, at[1] + Math.sin(angle - h) * len];
  const b = [at[0] + Math.cos(angle + h) * len, at[1] + Math.sin(angle + h) * len];
  return (
    <path d={`M${fmt(at[0])},${fmt(at[1])} L${fmt(a[0])},${fmt(a[1])} A${fmt(len)},${fmt(len)} 0 0 1 ${fmt(b[0])},${fmt(b[1])} Z`}
      style={{ fill: 'var(--sb-token)', fillOpacity: 0.26 }} />
  );
}

/** An artifact: a dashed outline while hidden, a gold gem once a beam has found it. */
function Gem({ at, lit }: { at: Pt; lit: boolean }) {
  const [x, y] = at, s = 6;
  const points = `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`;
  return lit
    ? <polygon points={points} style={{ fill: 'var(--sb-token)' }} />
    : <polygon class="sb-line dash" points={points} opacity={0.55} />;
}

/** A ring that fills (or drains) clockwise from the top as `f` goes 0 to 1. */
function Ring({ at, r, f, color }: { at: Pt; r: number; f: number; color: string }) {
  const c = 2 * Math.PI * r;
  return (
    <circle cx={at[0]} cy={at[1]} r={r} transform={`rotate(-90 ${at[0]} ${at[1]})`} stroke-width={2.5}
      stroke-dasharray={`${fmt(c * clamp(f))} ${fmt(c)}`} style={{ fill: 'none', stroke: color }} />
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const beam = values.beamBlocks, deg = values.beamDegrees, len = beam * PX;
  const artPts = values.artifactPoints, killPts = values.ghostKillPoints;
  const grabSec = values.grabSeconds, killSec = values.ghostKillSeconds;
  const finds = FINDS.slice(0, values.artifactsFound);
  const sec = (s: number) => (s * 1000) / BEAT_MS; // seconds as a share of a beat, for the real-time beat 2
  const LD = LS + sec(killSec); // the Ghost dies here
  const total = finds.length * artPts + killPts;

  // You. Beat 1: walk with the beam ahead of you. Beat 2: stand at the end of the walk and turn the beam on the Ghost.
  const p = beat === 0 ? walkP(t) : 1;
  const you: Pt = beat === 0 ? along(WALK, p) : WALK[WALK.length - 1];
  const gems = finds.map((i) => {
    const at = WALK[i];
    const pv = CUM[i] / TOTAL;
    return { at, pv, lit: p >= pv - len / TOTAL, taken: beat > 0 || p >= pv, tTaken: tWhen(pv) };
  });
  const taken = gems.filter((g) => g.taken).length;

  // The Ghost: hidden, then grabbing (and so fully visible), then lit until it dies.
  const ghost: Pt = beat === 0 ? GHOST_0
    : t < GS ? [lerp(GHOST_0[0], GRAB_AT[0], easeInOut(seg(t, 0, GS))), lerp(GHOST_0[1], GRAB_AT[1], easeInOut(seg(t, 0, GS)))]
      : t < BREAK ? GRAB_AT : along(FLEE, easeOut(seg(t, BREAK, LD)));
  const revealed = beat === 1 && t >= GS && t < LD;
  const dead = beat === 1 && t >= LD;
  const grabbing = beat === 1 && t >= GS && t < BREAK;
  const lightOn = beat === 1 && t >= LS;
  const toGhost = Math.atan2(ghost[1] - you[1], ghost[0] - you[0]);
  const angle = beat === 0 ? headingAt(p) : lightOn ? toGhost : lerp(headingAt(1), toGhost, easeInOut(seg(t, GS, LS)));
  const litFor = beat === 1 ? killSec * seg(t, LS, LD) : 0;
  const pts = beat === 0 ? taken * artPts : beat === 1 ? taken * artPts + (dead ? killPts : 0) : total;
  const hunterLabel = beat === 1 && t >= BREAK ? 'freed' : grabbing ? 'grabbed' : 'Hunter';

  return (
    <Stage>
      {beat === 0 && <SpedUp />}
      {beat < 2 && (
        <g>
          <rect class="sb-c" x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx={10} />
          {WALLS.map(([x, y, w, h], i) => <rect key={i} class="sb-c wall" x={x} y={y} width={w} height={h} rx={3} />)}

          <Beam at={you} angle={angle} len={len} deg={deg} />

          <Gem at={LEFT_OVER} lit={false} />
          {gems.map((g, i) => !g.taken && <Gem key={i} at={g.at} lit={g.lit} />)}
          {beat === 0 && gems.map((g, i) => <Float key={i} x={g.at[0]} y={g.at[1] - 8} p={seg(t, g.tTaken, g.tTaken + 0.2)} text={`+${artPts}`} />)}

          <Dot x={OTHER_GHOST[0]} y={OTHER_GHOST[1]} kind="ghost" opacity={0.7} />
          <Label x={OTHER_GHOST[0] + 12} y={OTHER_GHOST[1] + 4} text="Ghost, hidden" muted />

          {grabbing && <Line points={[ghost, HUNTER]} kind="hot" dash />}
          {grabbing && <Ring at={HUNTER} r={12} f={1 - (t - GS) / sec(grabSec)} color="var(--sb-hot)" />}
          <Dot x={HUNTER[0]} y={HUNTER[1]} kind="a" />
          <Label x={HUNTER[0]} y={HUNTER[1] + 22} text={hunterLabel} anchor="middle" muted={hunterLabel === 'Hunter'} />

          {!dead && (revealed
            ? <Dot x={ghost[0]} y={ghost[1]} kind="b" />
            : <Dot x={ghost[0]} y={ghost[1]} kind="ghost" opacity={0.7} />)}
          {dead && <Dot x={ghost[0]} y={ghost[1]} kind="ghost" opacity={0.7 * (1 - seg(t, LD, LD + 0.2))} />}
          {lightOn && !dead && <Ring at={ghost} r={12} f={seg(t, LS, LD)} color="var(--sb-token)" />}
          {!dead && (revealed
            ? <Label x={ghost[0]} y={ghost[1] - 16} text="Ghost" anchor="middle" />
            : <Label x={ghost[0] - 12} y={ghost[1] + 4} text="Ghost, hidden" anchor="end" muted />)}
          {beat === 1 && <Float x={ghost[0]} y={ghost[1] - 14} p={seg(t, LD, LD + 0.25)} text={`+${killPts}`} />}

          <Dot x={you[0]} y={you[1]} />
        </g>
      )}

      {beat < 2 && (
        <g>
          <Label x={RX} y={70} text="you, Hunter" />
          <Readout x={RX} y={100} text={`${pts} pts`} anchor="start" />
          {beat === 0 && <Label x={RX} y={122} text={`beam ${beam} blocks`} muted />}
          {beat === 1 && <Label x={RX} y={122} text={`light ${fmt(litFor)} / ${killSec} s`} />}
          {beat === 1 && <Label x={RX} y={140} text={`a grab kills in ${grabSec} s`} muted />}
        </g>
      )}

      {beat === 2 && (
        <Payout t={t} score={total} minS={values.minScore} maxS={values.maxScore}
          minT={values.minTokens} maxT={values.maxTokens} win={values.winBonus} minutes={values.gameMinutes} />
      )}
    </Stage>
  );
}

/**
 * Beat 3: `maxT` token chips plus `win` dashed bonus chips. Under them a points bar from 0 to `maxS` fills with your
 * score, and the chips light as it goes: `minT` at `minS` or less, 1 more per equal step, `maxT` at `maxS`.
 */
function Payout({ t, score, minS, maxS, minT, maxT, win, minutes }: {
  t: number; score: number; minS: number; maxS: number; minT: number; maxT: number; win: number; minutes: number;
}) {
  const SIZE = 20, STEP = SIZE + 4, n = maxT + win;
  const X0 = (400 - (n * STEP - 4)) / 2, TOK_Y = 34, BAR_Y = 84;
  const BX0 = X0, BX1 = X0 + maxT * STEP - 4;
  const bx = (s: number) => lerp(BX0, BX1, clamp(s / maxS));
  const tokensFor = (s: number) => minT + Math.round((maxT - minT) * clamp((s - minS) / (maxS - minS)));
  const f = score * seg(t, 0.12, 0.55);
  const lit = tokensFor(f);

  return (
    <g opacity={seg(t, 0.02, 0.15)}>
      <Tokens x={X0} y={TOK_Y} n={lit} max={maxT} size={SIZE} />
      {Array.from({ length: win }, (_, i) => (
        <rect key={i} x={X0 + (maxT + i) * STEP} y={TOK_Y} width={SIZE} height={SIZE} rx={3}
          style={{ fill: 'none', stroke: 'var(--sb-token)', strokeWidth: 1.5, strokeDasharray: '3 3' }} />
      ))}
      <Label x={X0 + maxT * STEP + (win * STEP - 4) / 2} y={TOK_Y - 8} text={`+${win} win`} anchor="middle" muted />

      <rect class="sb-tok" x={BX0} y={BAR_Y} width={BX1 - BX0} height={10} rx={2} />
      <rect class="sb-tok on" x={BX0} y={BAR_Y} width={bx(minS) - BX0} height={10} rx={2} opacity={0.35} />
      {f > 0 && <rect x={BX0} y={BAR_Y} width={bx(f) - BX0} height={10} rx={2} style={{ fill: 'var(--accent)' }} />}
      <rect x={bx(f) - 1} y={BAR_Y - 4} width={2} height={18} style={{ fill: 'var(--accent)' }} />
      <Label x={bx(minS)} y={BAR_Y - 8} text={`${minS}`} anchor="middle" muted />
      <Label x={BX1} y={BAR_Y - 8} text={`${maxS}`} anchor="end" muted />
      <Label x={bx(f)} y={BAR_Y + 28} text={`${Math.round(f)} pts`} anchor="middle" />

      <Label x={200} y={146} text={`tie after ${minutes} minutes, so no win bonus`} anchor="middle" muted />
      <Readout x={10} y={190} text={`You: ${score}`} anchor="start" />
      <Readout x={390} y={190} text={`${tokensFor(score)} Soul Orbs`} />
    </g>
  );
}
