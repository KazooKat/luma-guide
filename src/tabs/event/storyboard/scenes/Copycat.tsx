// Copycat: a build seen from above in your walled plot. Beat 1: you study it while the memorize bar runs out, then
// `missingBlocks` of its blocks vanish and you fly to the gaps and fill them: `yourRight` with the right block,
// `wrongBlocks` with the wrong one, and the rest left empty. Beat 2 checks each gap, counts your share right against
// `targetPercent`, and a rival with only `rivalRight` right drops out. Beat 3 counts rounds survived up to
// `roundsForMax`, which spreads `minOrbs` to `maxOrbs` Soul Orbs, then adds `mostPointsBonus` for the most points.
// Game time is compressed (a 16 second preview and a whole build phase in 1 beat), which is why the scene says "sped up".
import { cellCenter, clamp, Dot, easeInOut, easeOut, Float, Label, lerp, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'copycat';

/** The build from above: W is one block type, A another, and . is empty plot floor. */
const BUILD = [
  '..AAAA..',
  '.AWWWWA.',
  'AWWAAWWA',
  'AWWAAWWA',
  '.AWWWWA.',
  '..AAAA..',
];
const COLS = 8, ROWS = 6;
const FILL: Record<string, string> = { W: 'var(--sb-wall)', A: 'var(--sb-team-a)' };
/** A block type that isn't in the build, for the wrong guess. */
const WRONG_FILL = 'var(--sb-team-b)';
/**
 * The order blocks go missing in, for you and for the rival (each player's gaps are picked separately). The first
 * `missingBlocks` of each list vanish; yours are also the order you fly to them in, so the path reads as a tour.
 */
const YOUR_GAPS: [number, number][] = [[2, 0], [5, 0], [6, 1], [6, 2], [7, 3], [5, 4], [4, 5], [1, 4], [0, 2], [3, 2], [2, 2], [4, 3], [3, 1], [1, 3]];
const RIVAL_GAPS: [number, number][] = [[3, 0], [1, 1], [2, 1], [0, 3], [3, 3], [5, 2], [7, 2], [6, 4], [2, 5], [5, 5], [4, 1], [1, 2], [6, 3], [3, 4]];

/** Your plot (big, left) and the rival's (small, bottom right). */
const YOU_PLOT = { x: 16, y: 30, size: 17, gap: 3 };
const RIVAL_PLOT = { x: 300, y: 112, size: 8, gap: 2 };
type PlotGeo = typeof YOU_PLOT;

const at = (p: PlotGeo, c: number, r: number) => cellCenter(p.x, p.y, p.size, p.gap, c, r);
const keyOf = (c: number, r: number) => `${c},${r}`;

/** How a gap looks right now: still empty, or filled (pop 0 to 1) with the right or the wrong block. */
interface Gap { pop: number; wrong: boolean }
/** A check mark drawn on a gap in beat 2: `ok` for right, otherwise wrong or still empty. */
interface Mark { ok: boolean; p: number }

/** One plot: a wall outline, the build's blocks, dim cells where blocks are missing, and check outlines. */
function Plot({ geo, gaps, marks }: { geo: PlotGeo; gaps: Map<string, Gap>; marks?: Map<string, Mark> }) {
  const { size, gap } = geo;
  const pad = Math.max(4, gap * 2);
  const w = COLS * (size + gap) - gap, h = ROWS * (size + gap) - gap;
  const cells = [];
  const checks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = BUILD[r][c];
      if (ch === '.') continue;
      const [cx, cy] = at(geo, c, r);
      const k = keyOf(c, r);
      const g = gaps.get(k);
      if (g) {
        cells.push(<rect key={`h${k}`} class="sb-c dim" x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={size > 10 ? 3 : 2} />);
      }
      const pop = g ? clamp(g.pop) : 1;
      if (pop > 0) {
        const s = size * (0.4 + 0.6 * easeOut(pop));
        cells.push(
          <rect
            key={k} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={size > 10 ? 3 : 2} opacity={0.4 + 0.6 * pop}
            style={{ fill: g?.wrong ? WRONG_FILL : FILL[ch] }}
          />,
        );
      }
      const m = marks?.get(k);
      if (m && m.p > 0) {
        const s = size + 4;
        checks.push(
          <rect
            key={`m${k}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={4} opacity={clamp(m.p)}
            class={`sb-line${m.ok ? '' : ' hot'}${!m.ok && !(g && g.pop >= 1) ? ' dash' : ''}`}
            style={{ stroke: m.ok ? 'var(--sb-safe)' : undefined, strokeWidth: 2 }}
          />,
        );
      }
    }
  }
  return (
    <g>
      <rect class="sb-line" x={geo.x - pad} y={geo.y - pad} width={w + pad * 2} height={h + pad * 2} rx={4} />
      {cells}
      {checks}
    </g>
  );
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
  const memSec = values.memorizeSeconds, buildSec = values.buildSeconds, target = values.targetPercent;
  const missing = Math.min(values.missingBlocks, YOUR_GAPS.length, RIVAL_GAPS.length);
  const right = Math.min(values.yourRight, missing);
  const wrong = Math.min(values.wrongBlocks, missing - right);
  const rivalRight = Math.min(values.rivalRight, missing);
  const minOrbs = values.minOrbs, maxOrbs = values.maxOrbs, roundsForMax = values.roundsForMax, bonus = values.mostPointsBonus;
  const orbsFor = (rounds: number) => minOrbs + Math.round((maxOrbs - minOrbs) * Math.min(1, rounds / roundsForMax));

  // Beat 1: memorize until VANISH, then the gaps open and you fly to each one you fill (right ones first, then the wrong one).
  const VANISH = 0.4;
  const vanished = beat > 0 || t >= VANISH;
  const visits = right + wrong;
  const fly = beat === 0 ? seg(t, VANISH + 0.05, 0.93) * visits : visits;
  const yourGaps = YOUR_GAPS.slice(0, missing);
  const path: Pt[] = [at(YOU_PLOT, 0, 0), ...yourGaps.slice(0, visits).map(([c, r]) => at(YOU_PLOT, c, r))];
  const leg = Math.min(Math.max(visits - 1, 0), Math.floor(fly));
  const legP = visits ? easeInOut(clamp(fly - leg)) : 0;
  const you: Pt = visits
    ? [lerp(path[leg][0], path[leg + 1][0], legP), lerp(path[leg][1], path[leg + 1][1], legP)]
    : path[0];

  const yourMap = new Map<string, Gap>();
  if (vanished) {
    yourGaps.forEach(([c, r], i) => {
      const filled = i < visits ? seg(fly, i + 0.75, i + 1) : 0;
      yourMap.set(keyOf(c, r), { pop: filled, wrong: i >= right });
    });
  }

  // Beat 2: each of your gaps is checked in turn, then the rival's plot is checked all at once and they drop out.
  const checkAt = (i: number) => 0.05 + (i / Math.max(1, missing)) * 0.4;
  const yourMarks = new Map<string, Mark>();
  let rightSoFar = 0;
  if (beat >= 1) {
    yourGaps.forEach(([c, r], i) => {
      const p = beat === 1 ? seg(t, checkAt(i), checkAt(i) + 0.08) : 1;
      yourMarks.set(keyOf(c, r), { ok: i < right, p });
      if (p > 0 && i < right) rightSoFar++;
    });
  }
  const pct = Math.round((100 * rightSoFar) / Math.max(1, missing));
  const points = right * values.pointsPerBlock - wrong * values.wrongPenalty;

  const rivalGaps = RIVAL_GAPS.slice(0, missing);
  const rivalMap = new Map<string, Gap>();
  const rivalMarks = new Map<string, Mark>();
  const rivalFill = beat === 0 ? seg(t, VANISH + 0.05, 0.9) : 1;
  const rivalCheck = beat === 1 ? seg(t, 0.55, 0.65) : beat === 2 ? 1 : 0;
  if (vanished) {
    rivalGaps.forEach(([c, r], i) => {
      rivalMap.set(keyOf(c, r), { pop: i < rivalRight ? seg(rivalFill * rivalRight, i + 0.5, i + 1) : 0, wrong: false });
      rivalMarks.set(keyOf(c, r), { ok: i < rivalRight, p: rivalCheck });
    });
  }
  const rivalPct = Math.round((100 * rivalRight) / Math.max(1, missing));
  const rivalOut = rivalPct < target;
  const out = beat === 1 && rivalOut ? seg(t, 0.72, 0.9) : beat === 2 && rivalOut ? 1 : 0;
  const rivalAt = at(RIVAL_PLOT, 0, 0);

  // Beat 3: rounds survived tick up to roundsForMax, then the most points bonus lands.
  const rounds = beat === 2 ? Math.floor(seg(t, 0.05, 0.7) * roundsForMax) : 0;
  const won = beat === 2 && t >= 0.82;
  const orbs = orbsFor(rounds) + (won ? bonus : 0);
  const tokMax = maxOrbs + bonus;
  const chipY = 162, chipStep = 13, tokY = 162, tokEnd = 392;
  const tokX = (i: number) => tokEnd - tokMax * 14 + 4 + i * 14 + 5;
  const floats = [];
  if (beat === 2) {
    for (let n = 1; n <= roundsForMax; n++) {
      const gain = orbsFor(n) - orbsFor(n - 1);
      if (gain <= 0) continue;
      const when = 0.05 + (n / roundsForMax) * 0.65;
      floats.push(<Float key={n} x={tokX(orbsFor(n) - 1)} y={tokY - 4} p={(t - when) / 0.18} text={`+${gain}`} />);
    }
    floats.push(<Float key="win" x={tokX(orbsFor(roundsForMax) + bonus - 1)} y={tokY - 4} p={(t - 0.82) / 0.18} text={`+${bonus}`} />);
  }

  const hudX = 204;
  const memLeft = 1 - seg(t, 0, VANISH);
  const buildLeft = 1 - seg(t, VANISH, 1);
  return (
    <Stage>
      <SpedUp />
      <g opacity={beat === 2 ? 0.25 : 1}>
        <Plot geo={YOU_PLOT} gaps={yourMap} marks={yourMarks} />
        <Dot x={you[0]} y={you[1]} r={6} />
      </g>

      {beat < 2 && (
        <g>
          <Label x={RIVAL_PLOT.x} y={RIVAL_PLOT.y - 9} text="rival" muted />
          <Plot geo={RIVAL_PLOT} gaps={rivalMap} marks={rivalMarks} />
          {out < 1
            ? <Dot x={rivalAt[0]} y={rivalAt[1]} kind="rival" r={5 * (1 - 0.6 * out)} opacity={1 - out} />
            : <Dot x={rivalAt[0]} y={rivalAt[1]} kind="ghost" r={5} />}
          {rivalCheck > 0 && (
            <Label x={RIVAL_PLOT.x + 39} y={188} text={`${rivalPct}%${out > 0 ? ', out' : ''}`} anchor="middle" muted={out > 0} />
          )}
        </g>
      )}

      {beat === 0 && (
        <g>
          <Label x={hudX} y={44} text={vanished ? `Go! ${missing} missing` : 'Memorize the build'} />
          <Bar x={hudX} y={58} w={188} left={vanished ? buildLeft : memLeft} fill={vanished ? 'var(--sb-safe)' : 'var(--sb-token)'} />
          <Label x={hudX} y={84} text={vanished ? `${Math.ceil(buildSec * buildLeft)}s to put them back` : `${Math.ceil(memSec * memLeft)}s`} />
        </g>
      )}

      {beat === 1 && (
        <g>
          <Readout x={hudX} y={70} text={`${pct}% right`} anchor="start" />
          <Label x={hudX} y={94} text={`need ${target}%`} />
          {t >= checkAt(missing) && <Label x={hudX} y={112} text={`${points} pts`} muted />}
        </g>
      )}

      {beat === 2 && (
        <g>
          <Readout x={tokEnd} y={74} text={`${orbs} Soul Orbs`} />
          <Label x={tokEnd} y={100} text={`${rounds} round${rounds === 1 ? '' : 's'} survived`} anchor="end" />
          {won && <Label x={tokEnd} y={118} text={`+${bonus} most points`} anchor="end" />}
          {Array.from({ length: roundsForMax }, (_, i) => (
            <rect
              key={i} x={YOU_PLOT.x + i * chipStep} y={chipY} width={10} height={10} rx={2}
              class="sb-tok" style={i < rounds ? { fill: 'var(--text-2)' } : undefined}
            />
          ))}
          <Label x={YOU_PLOT.x} y={chipY + 28} text="rounds" muted />
          <Tokens x={tokEnd} y={tokY} n={orbs} max={tokMax} anchor="end" />
          <Label x={tokEnd} y={tokY + 28} text={`max ${tokMax}`} anchor="end" muted />
        </g>
      )}
      {floats}
    </Stage>
  );
}
