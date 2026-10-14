// Paintball 2.1: you walk the bottom row throwing paintballs; each throw paints the block it lands on and the block
// under you, and every block that wasn't your colour scores `pointsPerBlock` for your team (other team's blocks too).
// In beat 2 a rival paints over your blocks: their score rises and yours never drops, and after `gameMinutes` the team
// with more points wins. The pay beat shows `winTokens` or `loseTokens`, plus the bonus of up to `firstBonus` that
// `bonusPlayers` players per team get (`otherBonus`, or `firstBonus` for the 1st), picked effectively at random.
import type { Pt } from '../kit';
import { cellCenter, clamp, Dot, easeOut, Float, Label, lerp, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'paintball';

const COLS = 14, ROWS = 5, SIZE = 18, GAP = 3;
const GX = (400 - (COLS * (SIZE + GAP) - GAP)) / 2, GY = 34;
const cc = (c: number, r: number) => cellCenter(GX, GY, SIZE, GAP, c, r);

type Team = 'a' | 'b';
/** One throw, at loop time `at` (beat + t): it paints `cells` for `team`. `by` is the thrower's cell. */
interface Throw { at: number; team: Team; by: [number, number]; target: [number, number] }

/** Your walk along the bottom row in beat 1, and back a little in beat 2. */
const yourCol = (g: number) => (g <= 1 ? lerp(1, 12, g) : lerp(12, 8, clamp(g - 1)));
/** The rival's walk along the top row in beat 2, right to left. */
const rivalCol = (g: number) => lerp(13, 2, clamp((g - 1) / 0.8));

const THROWS: Throw[] = [];
for (let k = 0; k < 11; k++) {
  const at = 0.06 + k * 0.08;
  const c = Math.round(yourCol(at));
  THROWS.push({ at, team: 'a', by: [c, 4], target: [c, [2, 1, 3][k % 3]] });
}
for (let k = 0; k < 3; k++) {
  const at = 1.1 + k * 0.22;
  const c = Math.round(yourCol(at));
  THROWS.push({ at, team: 'a', by: [c, 4], target: [Math.min(COLS - 1, c + 2), 3 - k] });
}
// The rival works back along the top row, painting over the blocks you painted in beat 1, right to left.
for (let k = 0; k < 7; k++) {
  const at = 1.06 + k * 0.1;
  THROWS.push({ at, team: 'b', by: [Math.round(rivalCol(at)), 0], target: THROWS[10 - k].target });
}
THROWS.sort((p, q) => p.at - q.at);

/** Blocks the other team painted before the scene starts, two of them right where your early throws land. */
const START_B: [number, number][] = [[12, 0], [13, 0], [13, 1], [12, 2], [13, 3], [11, 3], THROWS[2].target, THROWS[5].target];

const FLIGHT = 0.05;

/** Who owns each cell, each team's points, and the loop time of every scoring paint, at loop time `g`. */
function replay(g: number) {
  const owner = new Map<string, Team>(START_B.map(([c, r]) => [`${c},${r}`, 'b' as Team]));
  const score = { a: 0, b: START_B.length };
  const pops: { at: number; cell: [number, number] }[] = [];
  for (const th of THROWS) {
    if (th.at > g) break;
    for (const cell of [th.target, th.by]) {
      const k = cell.join(',');
      if (owner.get(k) === th.team) continue;
      owner.set(k, th.team);
      score[th.team]++;
      if (th.team === 'a') pops.push({ at: th.at, cell });
    }
  }
  return { owner, score, pops };
}

function Cells({ owner, opacity }: { owner: Map<string, Team>; opacity: number }) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const [x, y] = cc(c, r);
      const o = owner.get(`${c},${r}`);
      const style = o ? { fill: `var(--sb-team-${o})` } : undefined;
      out.push(<rect key={`${c},${r}`} class="sb-c" x={x - SIZE / 2} y={y - SIZE / 2} width={SIZE} height={SIZE} rx={3} style={style} />);
    }
  }
  return <g opacity={opacity}>{out}</g>;
}

/** A big team score, in the team's colour. */
const Score = ({ x, y, team, n, anchor }: { x: number; y: number; team: Team; n: number; anchor: 'start' | 'end' }) => (
  <text class="sb-read" x={x} y={y} text-anchor={anchor} style={{ fill: `var(--sb-team-${team})` }}>{n}</text>
);

export function Scene({ beat, t, values }: SceneProps) {
  const ppb = values.pointsPerBlock, minutes = values.gameMinutes;
  const win = values.winTokens, lose = values.loseTokens, bonus = values.firstBonus, other = values.otherBonus, bonusPlayers = values.bonusPlayers;
  const g = beat === 2 ? 2 : beat + t;
  const { owner, score, pops } = replay(g);

  const youAt = (x: number) => cc(0, 4)[0] + x * (SIZE + GAP);
  const you: Pt = [youAt(yourCol(Math.min(g, 2))), cc(0, 4)[1] + 16];
  const rival: Pt = [youAt(rivalCol(g)), cc(0, 0)[1] - 16];

  // Paintballs in the air: from the thrower to the block, landing at the throw's time.
  const balls = THROWS.filter((th) => g > th.at - FLIGHT && g < th.at && beat < 2).map((th, i) => {
    const p = seg(g, th.at - FLIGHT, th.at);
    const from = th.team === 'a' ? you : rival;
    const [tx, ty] = cc(...th.target);
    return <circle key={i} cx={lerp(from[0], tx, p)} cy={lerp(from[1], ty, p)} r={3.5} style={{ fill: `var(--sb-team-${th.team})` }} />;
  });

  // The clock runs out at the end of beat 2, then the winner is called.
  const left = beat === 0 ? lerp(minutes * 60, 110, t) : beat === 1 ? lerp(110, 0, seg(t, 0, 0.8)) : 0;
  const clock = `${Math.floor(Math.ceil(left) / 60)}:${String(Math.ceil(left) % 60).padStart(2, '0')}`;
  const over = beat === 2 || (beat === 1 && t >= 0.8);

  const fill = beat === 2 ? easeOut(seg(t, 0.05, 0.5)) : 0;
  const rowX = 96, step = 14, bonusX = rowX + win * step + 10, bonusMid = bonusX + (bonus * step - 4) / 2;

  return (
    <Stage>
      <SpedUp />
      {/* Hidden in beat 3 so the pay rows sit on a clean background. */}
      <g opacity={beat === 2 ? 0 : 1}>
        <Cells owner={owner} opacity={1} />
        <Dot x={rival[0]} y={rival[1]} kind="b" opacity={beat === 0 ? 0.5 : 1} />
        <Dot x={you[0]} y={you[1]} />
        {balls}
        {beat === 0 && pops.map((pp, i) => {
          const [x, y] = cc(...pp.cell);
          return <Float key={i} x={x} y={y - 4} p={(g - pp.at) / 0.3} text={`+${ppb}`} />;
        })}
      </g>
      <Label x={4} y={12} text={clock} muted />
      <g opacity={beat === 2 ? 0.5 : 1}>
        <Label x={8} y={168} text="your team" />
        <Score x={8} y={194} team="a" n={score.a} anchor="start" />
        <Label x={392} y={168} text="other team" anchor="end" />
        <Score x={392} y={194} team="b" n={score.b} anchor="end" />
        {over && <Label x={200} y={186} text={score.a >= score.b ? 'your team wins' : 'other team wins'} anchor="middle" />}
      </g>
      {beat === 2 && (
        <g>
          <Label x={bonusMid} y={40} text={`+${other} or ${bonus}`} anchor="middle" muted />
          <Label x={rowX - 8} y={64} text="Team wins" anchor="end" />
          <Tokens x={rowX} y={54} n={Math.round(fill * win)} max={win} />
          <Tokens x={bonusX} y={54} n={0} max={bonus} />
          <Label x={rowX - 8} y={96} text="Team loses" anchor="end" />
          <Tokens x={rowX} y={86} n={Math.round(fill * lose)} max={lose} />
          <Tokens x={bonusX} y={86} n={0} max={bonus} />
          <Label x={bonusMid} y={120} text={`${bonusPlayers} random`} anchor="middle" muted />
          <Label x={bonusMid} y={134} text="players" anchor="middle" muted />
        </g>
      )}
    </Stage>
  );
}
