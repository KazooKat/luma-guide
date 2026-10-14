// Freeze Tag: you land `hitsToFreeze` hits on an enemy (each hit but the last knocks them back) and the last one locks
// them in ice for `pointsPerFreeze`. Then `hitsToUnfreeze` hits crack a frozen teammate free for `pointsPerUnfreeze`.
// The pay beat shows the Paintball 2.1 formula the game really uses: `winTokens` or `loseTokens`, plus a low-score
// bonus of up to `lowScoreBonus` that your 10 points don't get, because a higher score never pays more.
import type { Pt } from '../kit';
import { Dot, easeInOut, easeOut, Float, Label, lerp, Readout, seg, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'freeze-tag';

const AX = 10, AY = 16, AW = 380, AH = 132;
const ENEMY: Pt = [262, 62], MATE: Pt = [150, 118], START: Pt = [92, 82];
const KNOCK = 7;

/** When each of `n` hits lands, spread evenly from `a` to `b` in the beat. */
const hitTimes = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (n > 1 ? lerp(a, b, i / (n - 1)) : b));

/** A block of ice around a frozen player; `crack` (0 to 1) fades it and draws more cracks as it is hit. */
function Ice({ x, y, show, crack = 0 }: { x: number; y: number; show: number; crack?: number }) {
  if (show <= 0) return null;
  const s = 13;
  const cracks = Math.round(crack * 4);
  const lines: [number, number, number, number][] = [[-8, -6, 2, 3], [6, -9, -1, 1], [-9, 7, 1, 0], [8, 8, 0, -2]];
  return (
    <g opacity={show * (1 - 0.55 * crack)}>
      <rect x={x - s} y={y - s} width={s * 2} height={s * 2} rx={4} style={{ fill: 'var(--sb-team-a)', fillOpacity: 0.28, stroke: 'var(--text)', strokeWidth: 1.5 }} />
      {lines.slice(0, cracks).map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x + x1} y1={y + y1} x2={x + x2} y2={y + y2} style={{ stroke: 'var(--text)', strokeWidth: 1.2 }} />
      ))}
    </g>
  );
}

/** `n` hit pips above a player, the first `lit` filled. */
function Pips({ x, y, n, lit }: { x: number; y: number; n: number; lit: number }) {
  const step = 9, x0 = x - ((n - 1) * step) / 2;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x0 + i * step} cy={y} r={3} style={{ fill: i < lit ? 'var(--sb-hot)' : 'var(--sb-token-off)' }} />
      ))}
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const toFreeze = values.hitsToFreeze, toFree = values.hitsToUnfreeze;
  const freezePts = values.pointsPerFreeze, freePts = values.pointsPerUnfreeze;
  const win = values.winTokens, lose = values.loseTokens, bonus = values.lowScoreBonus;

  // Beat 1: walk up to the enemy, then the hits land. Each one but the last knocks them back a little.
  const fHits = hitTimes(toFreeze, 0.32, 0.58);
  const ft = beat === 0 ? t : 1;
  const fLanded = fHits.filter((h) => ft >= h).length;
  const knock = fHits.slice(0, -1).reduce((k, h) => k + KNOCK * seg(ft, h, h + 0.06), 0);
  const enemy: Pt = [ENEMY[0] + knock, ENEMY[1] - knock * 0.3];
  const frozen = seg(ft, fHits[toFreeze - 1], fHits[toFreeze - 1] + 0.05);
  const besideEnemy: Pt = [enemy[0] - 20, enemy[1] + 4];

  // Beat 2: go over to the frozen teammate and hit them free; they run off once the ice breaks.
  const uHits = hitTimes(toFree, 0.3, 0.6);
  const ut = beat === 1 ? t : beat === 2 ? 1 : 0;
  const uLanded = uHits.filter((h) => ut >= h).length;
  const freed = seg(ut, uHits[toFree - 1], uHits[toFree - 1] + 0.05);
  const mate: Pt = [lerp(MATE[0], MATE[0] - 70, easeInOut(seg(ut, 0.66, 1))), lerp(MATE[1], MATE[1] - 18, easeInOut(seg(ut, 0.66, 1)))];
  const besideMate: Pt = [MATE[0] + 20, MATE[1] - 4];

  let you: Pt;
  if (beat === 0) {
    const walk = easeInOut(seg(t, 0, 0.3));
    you = [lerp(START[0], besideEnemy[0], walk), lerp(START[1], besideEnemy[1], walk)];
    if (t > 0.3) you = besideEnemy;
  } else if (beat === 1) {
    const walk = easeInOut(seg(t, 0, 0.26));
    you = [lerp(besideEnemy[0], besideMate[0], walk), lerp(besideEnemy[1], besideMate[1], walk)];
  } else you = besideMate;

  const pts = (frozen >= 1 ? freezePts : 0) + (freed >= 1 ? freePts : 0);
  const lastF = fHits[toFreeze - 1], lastU = uHits[toFree - 1];
  const arena = beat === 2 ? 0 : 1; // the pay rows sit on a clean background

  // The pay beat: base tokens for a win and a loss, and a column of low-score bonus chips your score doesn't earn.
  const fill = beat === 2 ? easeOut(seg(t, 0.05, 0.5)) : 0;
  const rowX = 100, step = 14, bonusX = rowX + win * step + 10;

  return (
    <Stage>
      <g opacity={arena}>
        <rect x={AX} y={AY} width={AW} height={AH} rx={10} style={{ fill: 'var(--sb-cell)', fillOpacity: 0.35 }} />
        <Label x={AX + 8} y={AY + 16} text="Your team" muted />
        <Label x={AX + AW - 8} y={AY + 16} text="Enemies" anchor="end" muted />
        {/* the rest of both teams, so it reads as a team game */}
        <Dot x={56} y={52} kind="a" />
        <Dot x={60} y={128} kind="a" />
        <Dot x={338} y={108} kind="b" />
        <Dot x={312} y={132} kind="b" />
        <g opacity={beat === 1 ? 0.45 : 1}>
          <Dot x={enemy[0]} y={enemy[1]} kind="b" />
          <Ice x={enemy[0]} y={enemy[1]} show={frozen} />
          <Pips x={enemy[0]} y={enemy[1] - 21} n={toFreeze} lit={fLanded} />
        </g>
        <g opacity={beat === 0 ? 0.45 : 1}>
          <Dot x={mate[0]} y={mate[1]} kind="a" />
          <Ice x={MATE[0]} y={MATE[1]} show={1 - freed} crack={uLanded / toFree} />
          {freed < 1 && <Pips x={MATE[0]} y={MATE[1] - 21} n={toFree} lit={uLanded} />}
        </g>
        <Dot x={you[0]} y={you[1]} />
        {beat === 0 && <Float x={enemy[0]} y={enemy[1] - 30} p={(t - lastF) / 0.38} text={`+${freezePts}`} />}
        {beat === 1 && <Float x={MATE[0]} y={MATE[1] - 30} p={(t - lastU) / 0.38} text={`+${freePts}`} />}
      </g>
      {beat === 2 && (
        <g>
          <Label x={bonusX + (bonus * step - 4) / 2} y={38} text={`up to +${bonus}`} anchor="middle" muted />
          <Label x={rowX - 8} y={62} text="Team wins" anchor="end" />
          <Tokens x={rowX} y={52} n={Math.round(fill * win)} max={win} />
          <Tokens x={bonusX} y={52} n={0} max={bonus} />
          <Label x={rowX - 8} y={94} text="Team loses" anchor="end" />
          <Tokens x={rowX} y={84} n={Math.round(fill * lose)} max={lose} />
          <Tokens x={bonusX} y={84} n={0} max={bonus} />
          <Label x={bonusX + (bonus * step - 4) / 2} y={118} text="you: +0" anchor="middle" />
        </g>
      )}
      <g opacity={beat === 2 ? 1 : 0.75}>
        <Readout x={AX} y={188} text={`${pts} pts`} anchor="start" />
      </g>
      {beat === 2 && <Label x={AX + 112} y={184} text="a higher score never pays more" muted />}
    </Stage>
  );
}
