// Incursion: you cross the map and dive into the enemy team's hole for `holePoints`, then on the next trip you shoot
// `kills` enemies on the way for `killPoints` each (the guide's own example, 1 hole and 2 kills). Beat 3 turns those
// points into tokens: `baseTokens` always, plus 1 per `pointsPerToken`, up to `maxTokens`. Crossing the map takes
// longer than a beat, so beats 1 and 2 say "sped up".
import { along, clamp, Dot, easeInOut, easeOut, Float, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens, type Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'incursion';

const MAP = { x: 10, y: 18, w: 380, h: 124 };
const ZONE_W = 78;
const SPAWN: Pt = [30, 110];
const HOME_HOLE: Pt = [58, 56];
const ENEMY_HOLE: Pt = [342, 104];
/** Cover in the middle of the map, as [x, y, w, h]. Both routes below go around it. */
const WALLS = [[140, 30, 12, 50], [248, 80, 12, 50], [194, 18, 12, 26], [194, 116, 12, 26]];
/** The way from your spawn to the enemy hole. Beat 2 walks the same way and stops at B and C to shoot. */
const B: Pt = [104, 110], C: Pt = [214, 76], D: Pt = [296, 62];
const ROUTE: Pt[] = [SPAWN, B, C, D, ENEMY_HOLE];
/** Beat 1: you reach the hole at DIVE_AT and drop in until DIVE_END, when the points land. */
const DIVE_AT = 0.6, DIVE_END = 0.66;
/** The enemies you meet on the second trip: each walks from `from` to `to`, and you fire at `shot`. */
const FOES: { from: Pt; to: Pt; shot: number }[] = [
  { from: [236, 104], to: [172, 108], shot: 0.26 },
  { from: [306, 40], to: [266, 54], shot: 0.54 },
];
const HIT = 0.04; // the beam lands this long after it fires
/** Beat 2's walk as [t, point] keys, eased between each pair: out of spawn, shoot, move up, shoot, head for the hole. */
const WALK: [number, Pt][] = [[0.04, SPAWN], [0.24, B], [0.36, B], [0.52, C], [0.64, C], [1, D]];

/** Where a walk given as [t, point] keys is at time t, eased between keys. */
function walk(keys: [number, Pt][], t: number): Pt {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i];
    if (t <= t1) {
      const [t0, p0] = keys[i - 1];
      const f = easeInOut(seg(t, t0, t1));
      return [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];
    }
  }
  return keys[keys.length - 1][1];
}

/** A team's hole seen from above: a pit ringed in the team's colour. */
function Hole({ at, team }: { at: Pt; team: 'a' | 'b' }) {
  const stroke = `var(--sb-team-${team})`;
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={12} stroke-width={2.5} style={{ fill: 'var(--sb-stage)', stroke }} />
      <circle cx={at[0]} cy={at[1]} r={6} stroke-width={1} opacity={0.5} style={{ fill: 'none', stroke }} />
    </g>
  );
}

/** A team's end of the map, tinted in its colour (square on the inside edge, rounded on the outside). */
function Zone({ side }: { side: 'a' | 'b' }) {
  const x = side === 'a' ? MAP.x : MAP.x + MAP.w - ZONE_W;
  const inner = side === 'a' ? x + ZONE_W - 12 : x;
  return (
    <g opacity={0.16} style={{ fill: `var(--sb-team-${side})` }}>
      <rect x={x} y={MAP.y} width={ZONE_W} height={MAP.h} rx={10} />
      <rect x={inner} y={MAP.y} width={12} height={MAP.h} />
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const hole = values.holePoints, kill = values.killPoints, ppt = values.pointsPerToken;
  const base = values.baseTokens, max = values.maxTokens;
  const foes = FOES.slice(0, values.kills);
  const total = hole + foes.length * kill;
  const tokensFor = (p: number) => clamp(base + Math.floor(p / ppt), base, max);

  // Points so far: the dive lands at the end of beat 1, each kill in beat 2 when its beam hits.
  const killsDone = beat === 1 ? foes.filter((f) => t >= f.shot + HIT).length : beat === 2 ? foes.length : 0;
  const pts = beat === 0 ? (t >= DIVE_END ? hole : 0) : hole + killsDone * kill;

  // You. Beat 1: run the route and drop into the hole. Beat 2: respawn, shoot your way back out.
  let you: Pt, youR = 7, youOp = 1;
  if (beat === 0) {
    you = along(ROUTE, easeInOut(seg(t, 0.05, DIVE_AT)));
    const sink = seg(t, DIVE_AT, DIVE_END);
    youR = lerp(7, 4, sink);
    youOp = lerp(1, 0.5, sink) * (1 - seg(t, 0.85, 0.98));
  } else {
    you = walk(WALK, t);
    youOp = seg(t, 0, 0.06);
  }

  const foeAt = (f: (typeof FOES)[number], i: number): Pt => {
    if (beat === 0) return [f.from[0], f.from[1] + 3 * Math.sin(2 * Math.PI * (t + i / 2))];
    return walk([[0, f.from], [f.shot, f.to]], t);
  };

  const mapOp = beat === 2 ? 1 - seg(t, 0, 0.12) : 1;
  const splash = seg(t, DIVE_END, DIVE_END + 0.4);

  return (
    <Stage>
      {beat < 2 && <SpedUp />}
      {mapOp > 0 && (
        <g opacity={mapOp}>
          <rect class="sb-c" x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx={10} />
          <Zone side="a" />
          <Zone side="b" />
          {WALLS.map(([x, y, w, h], i) => <rect key={i} class="sb-c wall" x={x} y={y} width={w} height={h} rx={3} />)}
          <g opacity={beat === 0 ? 0.6 : 0.45}>
            <Hole at={HOME_HOLE} team="a" />
            <Label x={HOME_HOLE[0]} y={HOME_HOLE[1] - 18} text="your hole" anchor="middle" muted />
          </g>
          <g opacity={beat === 0 ? 1 : 0.6}>
            <Hole at={ENEMY_HOLE} team="b" />
            <Label x={ENEMY_HOLE[0]} y={ENEMY_HOLE[1] + 31} text="enemy hole" anchor="middle" />
          </g>
          {beat === 0 && splash > 0 && splash < 1 && (
            <circle cx={ENEMY_HOLE[0]} cy={ENEMY_HOLE[1]} r={12 + 9 * easeOut(splash)} fill="none" stroke-width={2} opacity={1 - splash} style={{ stroke: 'var(--sb-token)' }} />
          )}

          {beat === 0 && t < DIVE_AT && <g opacity={0.5}><Line points={ROUTE} kind="you" dash /></g>}
          {beat === 1 && t >= 0.64 && <g opacity={0.5}><Line points={[you, ENEMY_HOLE]} kind="you" dash /></g>}

          {foes.map((f, i) => {
            const at = foeAt(f, i);
            const gone = beat === 1 ? seg(t, f.shot + HIT, f.shot + HIT + 0.08) : 0;
            // You stand still while you shoot, so the beam starts where you are.
            const beam = beat === 1 ? seg(t, f.shot, f.shot + 0.12) : 0;
            return (
              <g key={i}>
                {beam > 0 && beam < 1 && <g opacity={1 - beam}><Line points={[you, at]} kind="you" /></g>}
                {gone < 1 && <Dot x={at[0]} y={at[1]} kind="b" opacity={1 - gone} />}
                {gone > 0 && <Dot x={at[0]} y={at[1]} kind="ghost" opacity={0.8 * gone} />}
              </g>
            );
          })}

          {youOp > 0 && <Dot x={you[0]} y={you[1]} r={youR} opacity={youOp} />}
          {beat === 0 && <Float x={ENEMY_HOLE[0]} y={ENEMY_HOLE[1] - 16} p={splash} text={`+${hole}`} />}
          {beat === 1 && foes.map((f, i) => {
            const at = f.to;
            return <Float key={i} x={at[0]} y={at[1] - 12} p={seg(t, f.shot + HIT, f.shot + HIT + 0.4)} text={`+${kill}`} />;
          })}
        </g>
      )}

      {beat === 2 && <Payout t={t} total={total} ppt={ppt} base={base} max={max} />}

      <g opacity={beat === 2 ? 0.6 : 1}>
        <Readout x={MAP.x} y={190} text={`You: ${pts}`} anchor="start" />
      </g>
      {beat < 2 ? (
        <g opacity={0.6}>
          <Tokens x={MAP.x + MAP.w} y={162} n={tokensFor(pts)} max={max} anchor="end" />
          <Label x={MAP.x + MAP.w} y={190} text={`${tokensFor(pts)} tokens`} anchor="end" />
        </g>
      ) : (
        <Readout x={MAP.x + MAP.w} y={190} text={`${tokensFor(total)} tokens`} />
      )}
    </Stage>
  );
}

/**
 * Beat 3: a row of `max` token chips. The first `base` are always lit; under each of the rest sits a `ppt`-point
 * segment of a points bar, and the bar fills with your points, lighting a chip each time a segment is full.
 */
function Payout({ t, total, ppt, base, max }: { t: number; total: number; ppt: number; base: number; max: number }) {
  const SIZE = 20, STEP = SIZE + 4, X0 = (400 - (max * STEP - 4)) / 2, TOK_Y = 44, BAR_Y = 76;
  const fillFrom = 0.12, fillTo = 0.55;
  const f = total * seg(t, fillFrom, fillTo);
  const lit = clamp(base + Math.floor(f / ppt), base, max);
  const segs = max - base;
  const barX = (p: number) => X0 + base * STEP + Math.min(segs, p / ppt) * STEP;
  const earned = Math.min(segs, Math.floor(total / ppt));

  return (
    <g opacity={seg(t, 0.02, 0.15)}>
      <Label x={X0 + (base * STEP - 4) / 2} y={TOK_Y - 8} text={`base ${base}`} anchor="middle" />
      <Label x={X0 + max * STEP - 4} y={TOK_Y - 8} text={`max ${max}`} anchor="end" />
      <Tokens x={X0} y={TOK_Y} n={lit} max={max} size={SIZE} />
      <Label x={X0 + (base * STEP - 4) / 2} y={BAR_Y + 9} text="always" anchor="middle" muted />
      {Array.from({ length: segs }, (_, k) => {
        const x = X0 + (base + k) * STEP;
        const full = clamp((f - k * ppt) / ppt);
        return (
          <g key={k}>
            <rect class="sb-tok" x={x} y={BAR_Y} width={SIZE} height={10} rx={2} />
            {full > 0 && <rect x={x} y={BAR_Y} width={SIZE * full} height={10} rx={2} style={{ fill: 'var(--accent)' }} />}
          </g>
        );
      })}
      <rect x={barX(f) - 1} y={BAR_Y - 4} width={2} height={18} style={{ fill: 'var(--accent)' }} />
      <Label x={barX(f)} y={BAR_Y + 28} text={`${Math.round(f)} pts`} anchor="middle" />
      <Label x={X0 + max * STEP - 4} y={BAR_Y + 28} text={`${segs * ppt}`} anchor="end" muted />
      <Label x={200} y={128} text={`+1 token per ${ppt} points`} anchor="middle" />
      {Array.from({ length: earned }, (_, k) => {
        const at = fillFrom + (fillTo - fillFrom) * (((k + 1) * ppt) / total);
        return <Float key={k} x={X0 + (base + k) * STEP + SIZE / 2} y={TOK_Y - 4} p={seg(t, at, at + 0.35)} text="+1" />;
      })}
    </g>
  );
}
