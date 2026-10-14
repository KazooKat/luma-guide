// Bomberman: a grid of soft columns with obsidian pillars on every odd/odd cell. You drop TNT, and `fuseSeconds` later
// it clears every soft column within `blastRadius` (measured flat, so the reach is round, not a cross), 1 point each.
// Beat 2 catches a rival in the next blast for a kill, which leaves you last one standing. Beat 3 runs the guide's
// 4-player example through the token formula: 3, plus up to 10 by score over the target, plus 2 for a round win, capped.
import { along, cellCenter, clamp, Dot, easeInOut, easeOut, Float, Grid, Label, lerp, Readout, seg, Stage, Tokens, type Pt } from '../kit';
import { BEAT_MS, type SceneProps } from '../Storyboard';

export const key = 'bomberman';

const COLS = 13, ROWS = 7, SIZE = 18, GAP = 3, STEP = SIZE + GAP;
const GX = 12, GY = 26;
const LX = 296; // the score ledger, right of the grid
const pillar = (c: number, r: number) => c % 2 === 1 && r % 2 === 1;
const k = (c: number, r: number) => `${c},${r}`;
/** Already dug at the start: your lane on row 2 and the rival's lane on row 4. */
const OPEN = new Set([0, 1, 2, 3, 4].map((c) => k(c, 2)).concat([5, 6, 7, 8, 9, 10, 11, 12].map((c) => k(c, 4))));
const at = (c: number, r: number) => cellCenter(GX, GY, SIZE, GAP, c, r);
const path = (cells: [number, number][]): Pt[] => cells.map(([c, r]) => at(c, r));

/** Bomb 1 goes at the end of your lane, bomb 2 where the 2 lanes meet once bomb 1 has opened it. */
const BOMB1: [number, number] = [4, 2], BOMB2: [number, number] = [4, 4];
const RIVAL_START: [number, number] = [12, 4], RIVAL_STOP: [number, number] = [6, 4];
const PLACE1 = 0.2, PLACE2 = 0.16;

/** Soft columns a bomb at (bc, br) clears, given what is already open. */
function blast(bc: number, br: number, radius: number, open: Set<string>) {
  const out: string[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if ((c - bc) ** 2 + (r - br) ** 2 > radius ** 2 || pillar(c, r) || open.has(k(c, r))) continue;
    out.push(k(c, r));
  }
  return out;
}

/** "1068" as "1,068". */
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A lit bomb: a hot core, a ring that closes in as the fuse burns, and the seconds left. */
function Bomb({ x, y, p, fuse }: { x: number; y: number; p: number; fuse: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={6} style={{ fill: 'var(--sb-hot)' }} />
      <circle class="sb-line hot" cx={x} cy={y} r={6 + 8 * (1 - p)} />
      <Label x={x} y={y + 25} text={`${(fuse * (1 - p)).toFixed(1)} s`} anchor="middle" />
    </g>
  );
}

/** The flash as a bomb goes off, out to its reach. */
function Boom({ x, y, q, reach }: { x: number; y: number; q: number; reach: number }) {
  if (q <= 0 || q >= 1) return null;
  return <circle cx={x} cy={y} r={lerp(6, reach, easeOut(q))} opacity={1 - q} style={{ fill: 'var(--sb-hot)', fillOpacity: 0.3, stroke: 'var(--sb-hot)', strokeWidth: 2 }} />;
}

export function Scene({ beat, t, values }: SceneProps) {
  const fuse = values.fuseSeconds, radius = values.blastRadius, ppc = values.pointsPerColumn;
  const kill = values.pointsPerKill, win = values.roundWinPoints;
  const fuseT = (fuse * 1000) / BEAT_MS;
  const boom1 = PLACE1 + fuseT, boom2 = PLACE2 + fuseT;
  const reach = radius * STEP + 4;

  const cleared1 = blast(...BOMB1, radius, OPEN);
  const open1 = new Set([...OPEN, ...cleared1]);
  const cleared2 = blast(...BOMB2, radius, open1);
  const gone1 = beat > 0 ? 1 : seg(t, boom1, boom1 + 0.1);
  const gone2 = beat > 1 ? 1 : beat === 1 ? seg(t, boom2, boom2 + 0.1) : 0;
  const fall1 = new Set(cleared1), fall2 = new Set(cleared2);
  const look = (c: number, r: number) => {
    if (pillar(c, r)) return { kind: 'wall' as const };
    const id = k(c, r);
    if (OPEN.has(id)) return { hide: true };
    if (fall1.has(id)) return { fall: gone1 };
    if (fall2.has(id)) return { fall: gone2 };
    return undefined;
  };

  // You: walk to the end of your lane and drop bomb 1, step back (your own bomb can't hurt you), then go down the
  // newly opened column, drop bomb 2 and step back again.
  let you: Pt;
  if (beat === 0) {
    you = t < 0.24
      ? along(path([[0, 2], BOMB1]), easeInOut(seg(t, 0, PLACE1)))
      : along(path([BOMB1, [3, 2]]), easeInOut(seg(t, 0.24, 0.32)));
  } else if (beat === 1) {
    you = t < 0.2
      ? along(path([[3, 2], BOMB1, BOMB2]), easeInOut(seg(t, 0, PLACE2)))
      : along(path([BOMB2, [4, 3]]), easeInOut(seg(t, 0.2, 0.26)));
  } else you = at(4, 3);

  // The rival comes down its lane toward the gap bomb 1 opened, and is caught by bomb 2.
  const rival = beat === 0 ? at(...RIVAL_START) : beat === 1 ? along(path([RIVAL_START, RIVAL_STOP]), easeInOut(seg(t, 0, 0.42))) : at(...RIVAL_STOP);
  const rivalOut = beat > 1 || (beat === 1 && t >= boom2);

  const b1 = at(...BOMB1), b2 = at(...BOMB2);
  const live1 = beat === 0 && t >= PLACE1 && t < boom1;
  const live2 = beat === 1 && t >= PLACE2 && t < boom2;
  const won = beat === 1 && t >= boom2 + 0.12;

  // The ledger: each line shows once it has happened.
  const n1 = cleared1.length * ppc, n2 = cleared2.length * ppc;
  const lines: [string, boolean][] = [
    [`+${n1} columns`, beat > 0 || t >= boom1],
    [`+${n2} columns`, beat === 1 && t >= boom2],
    [`+${kill} kill`, beat === 1 && t >= boom2],
    [`+${win} round win`, won],
  ];
  const total = (lines[0][1] ? n1 : 0) + (lines[1][1] ? n2 + kill : 0) + (won ? win : 0);

  // Beat 3: the guide's example, 4 players, after 2 rounds.
  const exCols = values.exampleColumns, exKills = values.exampleKills, target = values.exampleTarget;
  const exScore = exCols * ppc + exKills * kill + win;
  const frac = clamp(exScore / target);
  const base = values.baseTokens, fromScore = Math.round(values.scoreTokens * frac), bonus = values.winBonusTokens, max = values.maxTokens;
  const show1 = t >= 0.08, show2 = t >= 0.35, show3 = t >= 0.55;
  const lit = Math.min(max, (show1 ? base : 0) + (show2 ? fromScore : 0) + (show3 ? bonus : 0));
  const TX = 20, TS = 24, TSTEP = TS + 4, TY = 114;
  const groupMid = (from: number, n: number) => TX + from * TSTEP + (n * TSTEP - 4) / 2;
  const BX = 20, BW = 360, BY = 74;

  return (
    <Stage>
      <g opacity={beat === 2 ? 0.12 : 1}>
        <Grid x={GX} y={GY} cols={COLS} rows={ROWS} size={SIZE} gap={GAP} look={look} />
        {beat === 0 && t >= boom1 && <circle class="sb-line hot dash" cx={b1[0]} cy={b1[1]} r={reach} opacity={0.7} />}
        {beat === 1 && t >= boom2 && <circle class="sb-line hot dash" cx={b2[0]} cy={b2[1]} r={reach} opacity={0.7} />}
        {live1 && <Bomb x={b1[0]} y={b1[1]} p={seg(t, PLACE1, boom1)} fuse={fuse} />}
        {live2 && <Bomb x={b2[0]} y={b2[1]} p={seg(t, PLACE2, boom2)} fuse={fuse} />}
        {beat === 0 && <Boom x={b1[0]} y={b1[1]} q={seg(t, boom1, boom1 + 0.15)} reach={reach} />}
        {beat === 1 && <Boom x={b2[0]} y={b2[1]} q={seg(t, boom2, boom2 + 0.15)} reach={reach} />}
        <Dot x={rival[0]} y={rival[1]} kind={rivalOut ? 'ghost' : 'rival'} opacity={beat === 0 ? 0.45 : 1} />
        <Dot x={you[0]} y={you[1]} />
        {beat === 0 && <Float x={b1[0]} y={b1[1] - 10} p={seg(t, boom1, boom1 + 0.3)} text={`+${n1}`} />}
        {beat === 1 && <Float x={rival[0]} y={rival[1] - 10} p={seg(t, boom2, boom2 + 0.3)} text={`+${kill}`} />}
        {won && <Label x={you[0]} y={GY - 8} text="last one standing" anchor="middle" />}
      </g>

      {beat < 2 && (
        <g>
          {lines.map(([text, on], i) => on && <Label key={i} x={LX} y={44 + i * 20} text={text} />)}
          <Readout x={392} y={162} text={`${total} pts`} />
        </g>
      )}

      {beat === 2 && (
        <g>
          <Label x={BX} y={34} text="Example: 4 players, after 2 rounds" muted />
          <Label x={BX} y={58} text={`${exCols} columns + ${exKills * kill} kill + ${win} win = ${exScore} pts`} />
          <rect x={BX} y={BY} width={BW} height={10} rx={5} class="sb-tok" />
          <rect x={BX} y={BY} width={Math.max(10, BW * frac * easeOut(seg(t, 0, 0.3)))} height={10} rx={5} class="sb-tok on" />
          <Label x={BX + BW * frac} y={BY + 26} text={`${Math.round(frac * 100)}%`} anchor="middle" />
          <Label x={BX + BW} y={BY + 26} text={`target ${thousands(target)}`} anchor="end" />
          <Tokens x={TX} y={TY} n={lit} max={max} size={TS} />
          {show1 && <Label x={groupMid(0, base)} y={TY + TS + 16} text={`${base} base`} anchor="middle" />}
          {show2 && fromScore > 0 && <Label x={groupMid(base, fromScore)} y={TY + TS + 16} text={`+${fromScore} score`} anchor="middle" />}
          {show3 && <Label x={groupMid(base + fromScore, bonus)} y={TY + TS + 16} text={`+${bonus} win`} anchor="middle" />}
          <Float x={groupMid(base + fromScore, bonus)} y={TY - 4} p={seg(t, 0.55, 0.8)} text={`+${bonus}`} />
          <Readout x={392} y={190} text={`${lit} token${lit === 1 ? '' : 's'}`} />
        </g>
      )}
    </Stage>
  );
}
