// Prop Hunt: while the Seeker waits `hidingSeconds`, you walk up to a block, left-click it to look like it, and
// right-click to lock in place, which hides you from the Seeker. Then the Seeker hunts: it walks right past your
// locked block, but catches the other Hider, who is still an unlocked moving block. You earn 1 point every
// `secondsPerPoint` you stay uncaught, counting from the start. Beat 3 pays your score as tokens, clamped to
// `minTokens`..`maxTokens`: 8 for a Hider never caught, and the floor of 3 for a Seeker with 1 catch.
import { along, cellCenter, Dot, easeInOut, Float, Grid, Label, Line, Readout, seg, SpedUp, Stage, Tokens, type Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'prop-hunt';

const COLS = 12, ROWS = 7, SIZE = 18, GAP = 3;
const GX = 12, GY = 28;
const RX = 296; // the right-hand panel
const k = (c: number, r: number) => `${c},${r}`;
/** The furniture: blocks a Hider can copy. */
const BLOCKS = new Set(['2,1', '3,1', '2,2', '7,0', '8,0', '9,0', '5,4', '6,4', '5,5', '10,3', '10,4', '0,5', '1,5', '8,6', '9,6']);
const at = (c: number, r: number) => cellCenter(GX, GY, SIZE, GAP, c, r);
const path = (cells: [number, number][]): Pt[] => cells.map(([c, r]) => at(c, r));

const SPOT: [number, number] = [4, 4]; // where you lock, next to the block you copy
const COPY: [number, number] = [5, 4];
const YOU_WALK = path([[1, 3], [4, 3], SPOT]);
const RIVAL_0 = path([[10, 6], [10, 5], [11, 5], [11, 2], [10, 2], [10, 1]]);
const RIVAL_1 = path([[10, 1], [9, 1], [9, 2], [8, 2]]);
const SEEK_IN = path([[0, 3], [4, 3], [8, 3], [8, 2]]);
const SEEK_OUT = path([[8, 2], [8, 3], [6, 3]]);
const CATCH = 0.5;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A Hider disguised as a block: the block's colour, outlined so the eye can follow who it is. */
function Prop({ x, y, you, opacity = 1 }: { x: number; y: number; you?: boolean; opacity?: number }) {
  const s = SIZE - 2;
  return (
    <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={3} opacity={opacity}
      style={{ fill: 'var(--sb-wall)', stroke: you ? 'var(--accent)' : 'var(--sb-rival)', strokeWidth: 2 }} />
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const hide = values.hidingSeconds, seek = values.seekingMinutes * 60, per = values.secondsPerPoint;
  const min = values.minTokens, max = values.maxTokens, catches = values.seekerCatches;
  const full = hide + seek;
  const time = beat === 0 ? t * hide : beat === 1 ? hide + t * seek : full;
  const pts = Math.floor(time / per);
  const look = (c: number, r: number) => (BLOCKS.has(k(c, r)) ? { kind: 'wall' as const } : undefined);

  // You: walk up, copy the block next to you, then lock.
  const youAt = beat === 0 ? along(YOU_WALK, easeInOut(seg(t, 0, 0.3))) : at(...SPOT);
  const disguised = beat > 0 ? 1 : seg(t, 0.4, 0.48);
  const locked = beat > 0 || t >= 0.58;
  const copy = at(...COPY);

  // The other Hider is disguised too but never locks, so the Seeker can see it moving and hit it.
  const rival = beat === 0 ? along(RIVAL_0, easeInOut(t)) : beat === 1 ? along(RIVAL_1, easeInOut(seg(t, 0, 0.45))) : RIVAL_1[RIVAL_1.length - 1];
  const caught = beat > 1 || (beat === 1 && t >= CATCH);
  const seeker = beat === 1
    ? (t < CATCH ? along(SEEK_IN, easeInOut(seg(t, 0, CATCH))) : along(SEEK_OUT, easeInOut(seg(t, 0.58, 0.85))))
    : ([340, 145] as Pt);
  const seekerPts = caught ? 1 : 0;

  // Beat 3: a Hider never caught, and a Seeker with `catches` catches, against the floor and cap.
  const TX = 20, TS = 14;
  const tokens = (score: number) => Math.min(max, Math.max(min, score));
  const hiderPts = Math.floor(full / per);
  const fill = Math.round(tokens(hiderPts) * seg(t, 0.05, 0.4));
  // The Seeker's row shows the raw score first, then the floor lifts it.
  const seekerTok = t >= 0.55 ? tokens(catches) : t >= 0.2 ? Math.min(max, catches) : 0;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : word.endsWith('h') ? 'es' : 's'}`;

  return (
    <Stage>
      {beat < 2 && <SpedUp />}
      {beat < 2 && (
      <g>
        <Grid x={GX} y={GY} cols={COLS} rows={ROWS} size={SIZE} gap={GAP} look={look} />
        {beat === 0 && t >= 0.3 && t < 0.48 && <Line points={[youAt, copy]} kind="you" dash />}
        {disguised < 1 && <Dot x={youAt[0]} y={youAt[1]} opacity={1 - disguised} />}
        {disguised > 0 && <Prop x={youAt[0]} y={youAt[1]} you opacity={disguised} />}
        {beat === 0 && t >= 0.4 && t < 0.58 && <Label x={youAt[0]} y={youAt[1] - 16} text="disguised" anchor="middle" />}
        {locked && <Label x={youAt[0]} y={youAt[1] - 16} text="locked" anchor="middle" />}
        {caught ? <Dot x={rival[0]} y={rival[1]} kind="ghost" /> : <Prop x={rival[0]} y={rival[1]} />}
        {beat === 1 && <Float x={seeker[0]} y={seeker[1] - 12} p={seg(t, CATCH, CATCH + 0.25)} text="+1" />}
        {beat === 1 && t >= CATCH && <Label x={rival[0]} y={rival[1] - 13} text="caught" anchor="middle" />}
      </g>
      )}

      {beat === 0 && (
        <g>
          <rect class="sb-line dash" x={RX} y={128} width={88} height={48} rx={6} />
          <Label x={RX + 44} y={192} text={`waits ${hide} s`} anchor="middle" muted />
        </g>
      )}
      {beat < 2 && (
        <g>
          <Dot x={seeker[0]} y={seeker[1]} kind="b" />
          <Label x={seeker[0]} y={seeker[1] + 21} text="Seeker" anchor="middle" />
          <Label x={RX} y={42} text={`${clock(time)} / ${clock(full)}`} muted />
          <Label x={RX} y={70} text="you, hiding" />
          <Readout x={RX} y={98} text={`${pts} pt${pts === 1 ? '' : 's'}`} anchor="start" />
          {beat === 1 && <Label x={RX} y={118} text={`Seeker ${seekerPts} pt${seekerPts === 1 ? '' : 's'}`} />}
        </g>
      )}

      {beat === 2 && (
        <g>
          <Label x={TX} y={46} text={`You, never caught: ${plural(hiderPts, 'pt')}`} />
          <Tokens x={TX} y={56} n={fill} max={max} size={TS} />
          <Readout x={392} y={74} text={plural(fill, 'token')} />
          <Label x={TX} y={118} text={`Seeker, ${plural(catches, 'catch')}: ${plural(catches, 'pt')}`} />
          <Tokens x={TX} y={128} n={seekerTok} max={max} size={TS} />
          {t >= 0.55 && t < 0.72 && Array.from({ length: Math.max(0, tokens(catches) - Math.min(max, catches)) }, (_, i) => (
            <rect key={i} x={TX + (catches + i) * (TS + 4) - 2} y={126} width={TS + 4} height={TS + 4} rx={4} opacity={1 - seg(t, 0.55, 0.72)}
              style={{ fill: 'none', stroke: 'var(--sb-token)', strokeWidth: 2 }} />
          ))}
          {t >= 0.55 && <Label x={TX} y={164} text={`raised to the ${min} token minimum`} muted />}
          <Readout x={392} y={146} text={plural(seekerTok, 'token')} />
          <Label x={TX + max * (TS + 4) - 4} y={190} text={`cap ${max}`} anchor="end" muted />
        </g>
      )}
    </Stage>
  );
}
