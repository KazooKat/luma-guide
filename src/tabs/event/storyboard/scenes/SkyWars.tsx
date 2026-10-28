// SkyWars: islands seen from above inside a square border, with your points tallied on the right. The scene plays the
// guide's own example. Beat 1: you loot your island's copper chest, bridge to an enemy island and take all `hearts` of
// their health (1 point a heart), then the kill adds `killPoints`. Beat 2: the border shrinks to `finalBorder` by
// `finalBorder` around the middle island while you head there, survival adds 1 point every `survivalSeconds` for
// `minutesAlive` minutes, and a snowball knocks a second enemy into the void for the last of `kills` kills. Beat 3 turns
// the total into Soul Orbs: `baseTokens` plus 1 per `pointsPerToken` (rounded), up to `maxTokens`, and `winBonus` more
// for the last team standing. Game time is compressed, which is why the scene says "sped up".
import { along, Dot, easeInOut, easeOut, Float, Grid, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'skywars';

/** The map: a square border around 8 islands in a ring and a bigger one in the middle. */
const MID: Pt = [120, 95];
const HALF = 80; // the border's starting half-width
const END_HALF = 20; // drawn size of the final border (the real one depends on the map, so only its label is a number)
const RING = 58;
const ISLANDS: Pt[] = Array.from({ length: 8 }, (_, i): Pt => {
  const a = (i / 8) * Math.PI * 2;
  return [MID[0] + RING * Math.cos(a), MID[1] + RING * Math.sin(a)];
});
const HOME = ISLANDS[4]; // west
const FOE1 = ISLANDS[5]; // north-west, the enemy you fight in beat 1
const FOE2 = ISLANDS[7]; // north-east, the enemy you knock off in beat 2
const CELL = 7, GAP = 2;

/** Beat 1 timing: loot, bridge out, the hits, then the kill. */
const LOOT = [0.04, 0.16], BRIDGE = [0.18, 0.38], HITS = [0.42, 0.49, 0.56, 0.63, 0.7], KILL1 = 0.76;
/** Where you stop on the bridge, as a share of the way from your island to theirs. */
const REACH = 0.7;
/** Beat 2 timing: walk to the middle, the enemy steps onto its bridge, the snowball, the fall, and the border shrink. */
const WALK = [0.05, 0.4], FOE2_WALK = [0.1, 0.45], THROW = 0.5, FALL = [0.52, 0.64], SHRINK = [0.08, 0.92], ALIVE = [0.05, 0.95];
/** Beat 3 timing: when each Soul Orb lights, and when the win bonus does. */
const TOK_AT = 0.1, TOK_STEP = 0.1, WIN_AT = 0.72;

/** An n x n island of cells centred on `at`, with its copper chest in the corner. */
function Island({ at, n, chest, looted = false, opacity = 1 }: { at: Pt; n: number; chest: 'hot' | 'safe'; looted?: boolean; opacity?: number }) {
  const w = n * (CELL + GAP) - GAP;
  return (
    <g opacity={opacity}>
      <Grid x={at[0] - w / 2} y={at[1] - w / 2} cols={n} rows={n} size={CELL} gap={GAP} look={() => ({ kind: 'wall' })} />
      <rect class={`sb-c ${chest}`} x={at[0] + w / 2 - 7} y={at[1] - w / 2 + 1} width={6} height={6} rx={1} opacity={looted ? 0.35 : 1} />
    </g>
  );
}

/** A row of small blocks from `a` to `b`, the first `shown` of `count` placed (top-down, so a dotted line of cells). */
function Bridge({ a, b, count, shown }: { a: Pt; b: Pt; count: number; shown: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const s = 5 * easeOut(Math.max(0, Math.min(1, shown - i)));
        if (s <= 0) return null;
        const [x, y] = along([a, b], (i + 1) / (count + 1));
        return <rect key={i} class="sb-c" x={x - s / 2} y={y - s / 2} width={s} height={s} rx={1} />;
      })}
    </g>
  );
}

/** A rival who is hit at `p` = 0 and gone by `p` = 1: pushed along `push`, shrinking and fading, then a ghost. */
function Faller({ at, push, p }: { at: Pt; push: Pt; p: number }) {
  if (p <= 0) return <Dot x={at[0]} y={at[1]} kind="rival" r={6} />;
  const e = easeOut(Math.min(1, p));
  const x = at[0] + push[0] * e, y = at[1] + push[1] * e;
  if (p >= 1) return <Dot x={x} y={y} kind="ghost" r={6} />;
  return <Dot x={x} y={y} kind="rival" r={6 * (1 - 0.6 * p)} opacity={1 - p} />;
}

/** The border as a dashed square of half-width `half` around the middle. */
function Border({ half }: { half: number }) {
  const [x, y] = MID;
  return <Line points={[[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half], [x - half, y - half]]} kind="hot" dash />;
}

export function Scene({ beat, t, values }: SceneProps) {
  const hearts = values.hearts, killPts = values.killPoints, kills = values.kills;
  const alivePts = Math.round((values.minutesAlive * 60) / values.survivalSeconds);
  const base = values.baseTokens, ppt = values.pointsPerToken, max = values.maxTokens, win = values.winBonus;

  // Beat 1: loot, bridge out to the enemy island, 5 hits that take their hearts, then the kill.
  const looted = beat > 0 || t >= LOOT[1];
  const reach: Pt = [lerp(HOME[0], FOE1[0], REACH), lerp(HOME[1], FOE1[1], REACH)];
  const bridge1 = beat === 0 ? seg(t, BRIDGE[0], BRIDGE[1]) * 4 : 4;
  const hitsLanded = beat === 0 ? HITS.filter((h) => t >= h).length : HITS.length;
  const heartsLeft = hearts - Math.round((hearts * hitsLanded) / HITS.length);
  const foe1Fade = beat > 0 ? 1 : seg(t, KILL1, KILL1 + 0.1);
  const foe1Gone = beat > 0 || t >= KILL1;

  // Beat 2: walk to the middle island while the border shrinks, then snowball the second enemy off its bridge.
  const walk = beat === 0 ? 0 : beat === 1 ? easeInOut(seg(t, WALK[0], WALK[1])) : 1;
  const route: Pt[] = [reach, FOE1, MID];
  const out = beat === 0 ? easeInOut(seg(t, BRIDGE[0], BRIDGE[1] + 0.02)) : 1;
  const you: Pt = beat === 0 ? [lerp(HOME[0], reach[0], out), lerp(HOME[1], reach[1], out)] : along(route, walk);
  const bridge2 = beat === 0 ? 0 : beat === 1 ? seg(t, WALK[0], WALK[1]) * 4 : 4;
  const foe2Stop: Pt = [lerp(FOE2[0], MID[0], 0.45), lerp(FOE2[1], MID[1], 0.45)];
  const foe2Walk = beat === 0 ? 0 : beat === 1 ? easeInOut(seg(t, FOE2_WALK[0], FOE2_WALK[1])) : 1;
  const foe2At: Pt = [lerp(FOE2[0], foe2Stop[0], foe2Walk), lerp(FOE2[1], foe2Stop[1], foe2Walk)];
  const foe2Fall = beat === 0 ? 0 : beat === 1 ? seg(t, FALL[0], FALL[1]) : 1;
  const bridge3 = beat === 0 ? 0 : beat === 1 ? seg(t, 0.02, 0.12) * 4 : 4;
  const sizeLabel = beat === 0 ? 0 : beat === 1 ? seg(t, 0.6, 0.8) : 1;
  const half = beat === 0 ? HALF : beat === 1 ? lerp(HALF, END_HALF, easeInOut(seg(t, SHRINK[0], SHRINK[1]))) : END_HALF;
  const outside = (p: Pt) => Math.max(Math.abs(p[0] - MID[0]), Math.abs(p[1] - MID[1])) > half;

  // The tally: damage is 1 point a heart, kills, and survival points through beat 2.
  const damage = hearts - heartsLeft;
  const killCount = (foe1Gone ? 1 : 0) + (foe2Fall >= 1 ? 1 : 0);
  const shownKills = Math.min(kills, killCount);
  const alive = beat === 0 ? 0 : beat === 1 ? Math.floor(seg(t, ALIVE[0], ALIVE[1]) * alivePts) : alivePts;
  const score = damage + shownKills * killPts + alive;

  // Beat 3: base Soul Orbs, then 1 per pointsPerToken (rounded), then the win bonus.
  const earned = Math.min(max - base, Math.round(score / ppt));
  const lit = beat < 2 ? 0 : Math.min(base + earned, Math.max(0, Math.floor((t - TOK_AT) / TOK_STEP) + 1));
  const winOn = beat === 2 && t >= WIN_AT;

  const PX = 232, PR = 388, TY = 146;
  const tokX = (i: number) => PX + i * 14 + 5;
  const winX = PX + max * 14 + 6;
  const rows: [string, number][] = [['Hearts dealt', damage], [`${shownKills} kill${shownKills === 1 ? '' : 's'}`, shownKills * killPts], ['Time alive', alive]];

  return (
    <Stage>
      <SpedUp />
      <g opacity={beat === 2 ? 0.35 : 1}>
        {ISLANDS.map((p, i) => (
          <Island key={i} at={p} n={3} chest="hot" looted={p === HOME && looted} opacity={beat === 1 && outside(p) ? 0.45 : 1} />
        ))}
        <Island at={MID} n={4} chest="safe" />
        <Bridge a={HOME} b={FOE1} count={4} shown={bridge1} />
        <Bridge a={FOE1} b={MID} count={4} shown={bridge2} />
        <Bridge a={FOE2} b={MID} count={4} shown={bridge3} />
        <Border half={half} />
        {sizeLabel > 0 && (
          <g opacity={sizeLabel}>
            <Label x={MID[0]} y={MID[1] + END_HALF + 14} text={`${values.finalBorder} by ${values.finalBorder}`} anchor="middle" muted />
          </g>
        )}

        {beat === 0 && t >= LOOT[0] && t < LOOT[1] + 0.06 && (
          <rect x={lerp(HOME[0] + 10, you[0], easeInOut(seg(t, LOOT[0], LOOT[1]))) - 2.5} y={lerp(HOME[1] - 10, you[1], easeInOut(seg(t, LOOT[0], LOOT[1]))) - 2.5} width={5} height={5} rx={1} style={{ fill: 'var(--sb-hot)' }} />
        )}

        {/* The first enemy, with its hearts drawn above it. */}
        <Faller at={FOE1} push={[0, 0]} p={foe1Fade} />
        {beat === 0 && !foe1Gone && (
          <g>
            {Array.from({ length: hearts }, (_, i) => {
              const x = FOE1[0] - (hearts * 5.5) / 2 + i * 5.5, y = FOE1[1] - 22;
              return i < heartsLeft
                ? <rect key={i} x={x} y={y} width={4} height={4} rx={1} style={{ fill: 'var(--sb-team-b)' }} />
                : <rect key={i} class="sb-tok" x={x} y={y} width={4} height={4} rx={1} />;
            })}
          </g>
        )}
        {beat === 0 && HITS.map((h, i) => (t >= h && t < h + 0.04 ? <Line key={i} points={[you, FOE1]} kind="you" /> : null))}
        {beat === 0 && <Float x={FOE1[0]} y={FOE1[1] - 26} p={(t - KILL1) / 0.22} text={`+${killPts}`} />}

        {/* The second enemy, knocked off its bridge by a snowball in beat 2. */}
        {beat === 1 && t >= THROW - 0.04 && t < FALL[0] + 0.02 && <Line points={[you, foe2At]} kind="you" dash />}
        <Faller at={foe2At} push={[16, 16]} p={foe2Fall} />
        {beat === 1 && <Float x={foe2Stop[0] + 16} y={foe2Stop[1] - 10} p={(t - FALL[1]) / 0.22} text={`+${killPts}`} />}
        {beat === 1 && Array.from({ length: alivePts }, (_, i) => (
          <Float key={i} x={you[0]} y={you[1] - 12} p={(t - lerp(ALIVE[0], ALIVE[1], (i + 1) / alivePts)) / 0.12} text="+1" />
        ))}

        <Dot x={you[0]} y={you[1]} r={6} />
      </g>

      <Label x={PX} y={28} text="Your points" muted />
      <g opacity={beat === 2 ? 0.6 : 1}>
        {rows.map(([name, pts], i) => (
          <g key={i}>
            <Label x={PX} y={52 + i * 22} text={name} />
            <Label x={PR} y={52 + i * 22} text={`${pts}`} anchor="end" />
          </g>
        ))}
      </g>
      <Readout x={PX} y={132} text={`${score} pts`} anchor="start" />

      <g opacity={beat === 2 ? 1 : 0.5}>
        <Tokens x={PX} y={TY} n={lit} max={max} />
        <rect class={`sb-tok${winOn ? ' on' : ''}`} x={winX} y={TY} width={10} height={10} rx={3} />
        {beat === 2 && (
          <g>
            <Label x={PX} y={TY + 28} text={`${base} + ${earned} = ${base + earned} Soul Orbs`} />
            <Label x={PX} y={TY + 46} text={`+${win} if your team wins`} muted />
          </g>
        )}
      </g>
      {beat === 2 && Array.from({ length: base + earned }, (_, i) => (
        <Float key={i} x={tokX(i)} y={TY - 4} p={(t - (TOK_AT + i * TOK_STEP)) / 0.25} text="+1" />
      ))}
      {beat === 2 && <Float x={winX + 5} y={TY - 4} p={(t - WIN_AT) / 0.25} text={`+${win}`} />}
    </Stage>
  );
}
