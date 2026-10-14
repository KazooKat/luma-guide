// Manor: the Hunter can see a Runner within `hunterSeesNear` blocks or from `hunterSeesFar` blocks away, but not in
// the band between, so the scene draws both rings around the Hunter. You start too close (seen), back off into the
// band (hidden), and a second Runner far out stays seen. In beat 2 the Hunter goes for that Runner and catches it with
// 1 hit, which adds `catchBonusSeconds` to the clock, while you keep to the band and earn 1 point about every
// `secondsPerPoint`. Beat 3 pays score + `bonusTokens`, capped at `maxTokens`.
import { Dot, easeInOut, Float, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens, type Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'manor';

const PX = 5.5; // px per block
const RX = 296; // the right-hand panel
const HUNTER_0: Pt = [150, 104];
const HUNTER_1: Pt = [196, 116];
const RIVAL_0: Pt = [244, 100];
const RIVAL_1: Pt = [207, 110];
const CATCH = 0.42;
const RUNNER_R = 4.5; // Runners are shrunk to half size

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mix = (a: Pt, b: Pt, p: number): Pt => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) / PX;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Scene({ beat, t, values }: SceneProps) {
  const near = values.hunterSeesNear, far = values.hunterSeesFar;
  const per = values.secondsPerPoint, delay = values.hunterDelaySeconds, bonusSec = values.catchBonusSeconds;
  const base = values.timeMinutes * 60 + values.timeSeconds;
  const bonus = values.bonusTokens, max = values.maxTokens, hunterCatches = values.hunterCatches;
  const sees = (d: number) => d <= near || d >= far;

  // Game time: beat 1 runs from the Hunter's spawn for as long again, beat 2 to the end of the extended game.
  const mid = delay * 2, end = base + bonusSec;
  const time = beat === 0 ? lerp(delay, mid, t) : beat === 1 ? lerp(mid, end, t) : end;
  const caught = beat > 1 || (beat === 1 && t >= CATCH);
  const limit = caught ? end : base;
  const pts = Math.floor(time / per);

  const hunter = beat === 0 ? HUNTER_0 : beat === 1 ? mix(HUNTER_0, HUNTER_1, easeInOut(seg(t, 0, CATCH))) : HUNTER_1;
  const rival = beat === 0 ? RIVAL_0 : mix(RIVAL_0, RIVAL_1, easeInOut(seg(t, 0, CATCH)));
  // You: start 4 blocks off (seen), then back out to 10 blocks, inside the band, and keep that distance.
  const youDist = beat === 0 ? lerp(4, 10, easeInOut(seg(t, 0.15, 0.55))) : 10;
  const angle = Math.PI * (beat === 0 ? 1.15 : lerp(1.15, 1.25, t));
  const you: Pt = [hunter[0] + Math.cos(angle) * youDist * PX, hunter[1] + Math.sin(angle) * youDist * PX];
  const youSeen = sees(dist(you, hunter));
  const rivalSeen = !caught && sees(dist(rival, hunter));

  // Beat 3: you, never caught, and a Hunter with `hunterCatches` catches.
  const TX = 20, TS = 12, TSTEP = TS + 4;
  const tokens = (score: number) => Math.min(max, score + bonus);
  const youTok = t >= 0.4 ? tokens(pts) : t >= 0.1 ? Math.min(max, pts) : 0;
  const huntTok = t >= 0.4 ? tokens(hunterCatches) : t >= 0.1 ? Math.min(max, hunterCatches) : 0;
  /** A short outline flash on the chips the +2 adds, done before the t = 0.75 still. */
  const Bonus = ({ from, y, t }: { from: number; y: number; t: number }) => (t < 0.4 || t >= 0.72 ? null : (
    <g opacity={1 - seg(t, 0.4, 0.72)}>
      {Array.from({ length: Math.max(0, tokens(from) - Math.min(max, from)) }, (_, i) => (
        <rect key={i} x={TX + (from + i) * TSTEP - 2} y={y - 2} width={TSTEP} height={TSTEP} rx={4} style={{ fill: 'none', stroke: 'var(--sb-token)', strokeWidth: 2 }} />
      ))}
    </g>
  ));

  return (
    <Stage>
      {beat < 2 && <SpedUp />}
      {beat < 2 && (
      <g>
        <circle cx={hunter[0]} cy={hunter[1]} r={far * PX} style={{ fill: 'var(--sb-safe)', fillOpacity: 0.14 }} />
        <circle cx={hunter[0]} cy={hunter[1]} r={near * PX} style={{ fill: 'var(--sb-stage)' }} />
        <circle cx={hunter[0]} cy={hunter[1]} r={near * PX} style={{ fill: 'var(--sb-hot)', fillOpacity: 0.2 }} />
        <circle class="sb-line dash" cx={hunter[0]} cy={hunter[1]} r={far * PX} />
        <circle class="sb-line hot dash" cx={hunter[0]} cy={hunter[1]} r={near * PX} />
        <Label x={hunter[0]} y={hunter[1] - near * PX - 4} text={`${near}`} anchor="middle" muted />
        <Label x={hunter[0]} y={hunter[1] - far * PX - 4} text={`${far} blocks`} anchor="middle" muted />
        {youSeen && <Line points={[hunter, you]} kind="hot" dash />}
        {rivalSeen && <Line points={[hunter, rival]} kind="hot" dash />}
        <Dot x={hunter[0]} y={hunter[1]} kind="b" />
        <Label x={hunter[0]} y={hunter[1] + 22} text="Hunter" anchor="middle" />
        <Dot x={rival[0]} y={rival[1]} r={RUNNER_R} kind={caught ? 'ghost' : 'rival'} />
        <Dot x={you[0]} y={you[1]} r={RUNNER_R} />
        <Label x={you[0]} y={you[1] - 13} text={youSeen ? 'seen' : 'hidden'} anchor="middle" />
        {beat === 1 && <Float x={hunter[0]} y={hunter[1] - 12} p={seg(t, CATCH, CATCH + 0.25)} text="+1" />}
      </g>
      )}

      {beat < 2 && (
        <g>
          <Label x={RX} y={42} text={`${clock(time)} / ${clock(limit)}`} muted />
          {beat === 1 && t >= CATCH && t < CATCH + 0.35 && <Label x={RX} y={58} text={`catch: +${bonusSec} s`} />}
          <Label x={RX} y={82} text="you, running" />
          <Readout x={RX} y={110} text={plural(pts, 'pt')} anchor="start" />
          {beat === 1 && <Label x={RX} y={132} text={`Hunter ${plural(caught ? 1 : 0, 'pt')}`} />}
        </g>
      )}

      {beat === 2 && (
        <g>
          <Label x={TX} y={46} text={`You, never caught: ${plural(pts, 'pt')} + ${bonus}`} />
          <Tokens x={TX} y={56} n={youTok} max={max} size={TS} />
          <Bonus from={pts} y={56} t={t} />
          <Readout x={392} y={72} text={plural(youTok, 'token')} />
          <Label x={TX} y={118} text={`Hunter, ${hunterCatches} catches: ${plural(hunterCatches, 'pt')} + ${bonus}`} />
          <Tokens x={TX} y={128} n={huntTok} max={max} size={TS} />
          <Bonus from={hunterCatches} y={128} t={t} />
          <Readout x={392} y={144} text={plural(huntTok, 'token')} />
          <Label x={TX + max * TSTEP - 4} y={170} text={`cap ${max}`} anchor="end" muted />
        </g>
      )}
    </Stage>
  );
}
