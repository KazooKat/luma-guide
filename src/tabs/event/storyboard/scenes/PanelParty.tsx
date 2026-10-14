// Panel Party: a block is called ("Stand on: blue"), the players head for it while the bar runs out, then every
// other block is removed and the player left on a red block falls out. Beat 3 runs the guide's 12-panel example:
// 1 token per `panelsPerToken` panels survived plus 1 per purple panel, which comes to 9 of the 13 cap.
// Game time is compressed (11 seconds to find the block, then a whole game), which is why the scene says "sped up".
import { cellCenter, clamp, Dot, easeInOut, Float, Label, lerp, Readout, rng, seg, SpedUp, Stage, Tokens } from '../kit';
import type { Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'panel-party';

const COLS = 10, ROWS = 6, SIZE = 17, GAP = 3;
const GX = 16, GY = 26;
/** Block colours of the panel. Index 0 is the called block. */
const FILLS = ['var(--sb-team-a)', 'var(--sb-team-b)', 'var(--sb-hot)', 'var(--sb-safe)'];
const CALLED = 0;
/** Where each player ends up: you and 1 rival on called blocks, the other rival on a red block. */
const YOU_TO: [number, number] = [6, 1], RIVAL_TO: [number, number] = [1, 2], LOSER_TO: [number, number] = [5, 3];
/** The panel: a seeded scatter of 4 colours, with the middle 4 cells (where everyone spawns) kept off the called block. */
const PANEL: number[][] = (() => {
  const r = rng(21);
  const p = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => Math.floor(r() * FILLS.length)));
  for (const [c, rr] of [[4, 2], [5, 2], [4, 3], [5, 3]]) if (p[rr][c] === CALLED) p[rr][c] = 1;
  p[YOU_TO[1]][YOU_TO[0]] = CALLED;
  p[RIVAL_TO[1]][RIVAL_TO[0]] = CALLED;
  p[LOSER_TO[1]][LOSER_TO[0]] = 1;
  return p;
})();
/** When each removed block starts to drop in beat 2, so the floor clears in a ripple rather than all at once. */
const DROP_AT: number[][] = (() => {
  const r = rng(5);
  return PANEL.map((row) => row.map(() => 0.04 + 0.16 * r()));
})();

const at = (c: number, r: number) => cellCenter(GX, GY, SIZE, GAP, c, r);
const MID: Pt = [GX + (COLS * (SIZE + GAP) - GAP) / 2, GY + (ROWS * (SIZE + GAP) - GAP) / 2];
const walk = (from: Pt, to: Pt, p: number): Pt => {
  const e = easeInOut(p);
  return [lerp(from[0], to[0], e), lerp(from[1], to[1], e)];
};

/** The panel's blocks; `gone(c, r)` (0 to 1) shrinks and fades a removed block out, like the kit's Grid. */
function Panel({ gone }: { gone: (c: number, r: number) => number }) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const f = clamp(gone(c, r));
      if (f >= 1) continue;
      const s = SIZE * (1 - 0.6 * f);
      const [cx, cy] = at(c, r);
      cells.push(<rect key={`${c},${r}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={3} opacity={1 - f} style={{ fill: FILLS[PANEL[r][c]] }} />);
    }
  }
  return <g>{cells}</g>;
}

/** A bossbar that empties as `left` goes 1 to 0. */
function Bar({ x, y, w, left, fill }: { x: number; y: number; w: number; left: number; fill: string }) {
  return (
    <g>
      <rect class="sb-tok" x={x} y={y} width={w} height={7} rx={3.5} />
      <rect x={x} y={y} width={w * clamp(left)} height={7} rx={3.5} style={{ fill }} />
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const findSec = values.greenRoundSeconds, holdSec = values.dontMoveSeconds;
  const panels = values.panels, purple = values.purplePanels, per = values.panelsPerToken, max = values.maxTokens;
  const tokensFor = (n: number) => Math.min(max, Math.floor(n / per) + Math.max(0, n - (panels - purple)));

  // Beat 1: everyone spawns in the middle and heads for a block. Beat 2: the floor clears and the loser falls.
  const move = beat === 0 ? t : 1;
  const you = walk([MID[0] + 5, MID[1] - 4], at(...YOU_TO), seg(move, 0.15, 0.6));
  const rival = walk([MID[0] - 6, MID[1] - 2], at(...RIVAL_TO), seg(move, 0.2, 0.7));
  const loser = walk([MID[0], MID[1] + 6], at(...LOSER_TO), seg(move, 0.3, 0.75));
  const clear = beat === 0 ? 0 : beat === 1 ? t : 1;
  const gone = (c: number, r: number) => (PANEL[r][c] === CALLED ? 0 : seg(clear, DROP_AT[r][c], DROP_AT[r][c] + 0.2));
  const fall = seg(clear, DROP_AT[LOSER_TO[1]][LOSER_TO[0]], DROP_AT[LOSER_TO[1]][LOSER_TO[0]] + 0.25);

  // Panels survived: the first once beat 2's bar ends, then the rest of the 12 through beat 3.
  const survived = beat === 0 ? 0 : beat === 1 ? (t >= 0.9 ? 1 : 0) : 1 + Math.floor(seg(t, 0.05, 0.65) * (panels - 1));
  const toks = tokensFor(survived);
  const purpleIn = Math.max(0, survived - (panels - purple));

  const chipY = 162, chipStep = 13, tokY = 162, tokEnd = 392;
  const tokX = (i: number) => tokEnd - max * 14 + 4 + i * 14 + 5;
  const floats = [];
  if (beat === 2) {
    for (let n = 2; n <= panels; n++) {
      const gain = tokensFor(n) - tokensFor(n - 1);
      if (gain <= 0) continue;
      const when = 0.05 + ((n - 1) / (panels - 1)) * 0.6;
      floats.push(<Float key={n} x={tokX(tokensFor(n) - 1)} y={tokY - 4} p={(t - when) / 0.18} text={`+${gain}`} />);
    }
  }

  const hudX = 244;
  const left = 1 - t;
  return (
    <Stage>
      <SpedUp />
      <g opacity={beat === 2 ? 0.25 : 1}>
        <Panel gone={gone} />
        <Dot x={rival[0]} y={rival[1]} kind="rival" />
        {fall < 1
          ? <Dot x={loser[0]} y={loser[1]} kind="rival" r={7 * (1 - 0.6 * fall)} opacity={1 - fall} />
          : <Dot x={loser[0]} y={loser[1]} kind="ghost" />}
        {fall >= 1 && beat === 1 && <Label x={loser[0]} y={loser[1] + 22} text="out" anchor="middle" muted />}
        <Dot x={you[0]} y={you[1]} />
      </g>

      {beat < 2 ? (
        <g>
          <Label x={hudX} y={44} text="Stand on:" />
          <rect x={hudX + 80} y={30} width={18} height={18} rx={3} style={{ fill: FILLS[CALLED] }} />
          <Bar x={hudX} y={60} w={148} left={left} fill={beat === 0 ? 'var(--sb-safe)' : 'var(--sb-hot)'} />
          <Label
            x={hudX} y={86}
            text={beat === 0 ? `${Math.ceil(findSec * left)}s to find it` : `Don't move! ${Math.ceil(holdSec * left)}s`}
          />
        </g>
      ) : (
        <g>
          <Readout x={tokEnd} y={74} text={`${toks} tokens`} />
          <Label x={tokEnd} y={100} text={`${survived} panels / ${per} = ${Math.floor(survived / per)}`} anchor="end" />
          <Label x={tokEnd} y={118} text={`+${purpleIn} purple`} anchor="end" />
        </g>
      )}

      <g opacity={beat === 2 ? 1 : 0.6}>
        {Array.from({ length: panels }, (_, i) => {
          const isPurple = i >= panels - purple;
          const lit = i < survived;
          return (
            <rect
              key={i} x={GX + i * chipStep} y={chipY} width={10} height={10} rx={2}
              class="sb-tok" style={lit ? { fill: isPurple ? 'var(--chart)' : 'var(--text-2)' } : undefined}
            />
          );
        })}
        <Label x={GX + (panels - purple) * chipStep} y={chipY - 6} text="purple" muted />
        <Label x={GX} y={chipY + 28} text={`${survived} panel${survived === 1 ? '' : 's'} survived`} />
        <Tokens x={tokEnd} y={tokY} n={toks} max={max} anchor="end" />
        <Label x={tokEnd} y={tokY + 28} text={`max ${max}`} anchor="end" muted />
      </g>
      {floats}
    </Stage>
  );
}
