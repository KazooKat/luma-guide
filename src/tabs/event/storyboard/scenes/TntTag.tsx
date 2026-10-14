// TNT Tag: you are a Runner with the Tagger (TNT on its head) behind you. Every `pointSeconds` untagged fills the
// bar and scores 1 point. In beat 2 the Tagger tags you, so the TNT and the reset hit you; you tag a Runner to pass it
// on, and when the `roundSeconds` round ends, the Runner holding the TNT explodes. The pay beat is 1 token per point,
// out of the `maxPoints` a Runner never tagged in all `rounds` rounds can get. Game time is compressed ("sped up").
import type { Pt } from '../kit';
import { along, clamp, Dot, easeInOut, Float, Label, lerp, Readout, seg, SpedUp, Stage, Tokens } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'tnt-tag';

const AX = 10, AY = 30, AW = 380, AH = 124;
/** Your run in beat 1, with the Tagger on the same route a little behind. */
const RUN: Pt[] = [[70, 118], [150, 62], [250, 112], [330, 66], [300, 134]];
const LAG = 0.16;
const RIVAL: Pt = [196, 106];
const OTHERS: Pt[] = [[60, 52], [360, 120]];

/** Beat 2's game clock: from where beat 1 ends to the round's end at t = 0.6. */
const beat2Seconds = (t: number, from: number, round: number) => lerp(from, round, clamp(t / 0.6));

function Tnt({ x, y }: { x: number; y: number }) {
  return <rect x={x - 5} y={y - 17} width={10} height={9} rx={1.5} style={{ fill: 'var(--sb-hot)', stroke: 'var(--sb-stage)', strokeWidth: 1 }} />;
}

export function Scene({ beat, t, values }: SceneProps) {
  const per = values.pointSeconds, round = values.roundSeconds, rounds = values.rounds, max = values.maxPoints;
  // Beat 1 covers just over 2 points' worth of running.
  const beat1End = per * 2 + per / 6;
  const tagAt = 0.12, passAt = 0.32;
  const sec = beat === 0 ? lerp(0, beat1End, t) : beat === 1 ? beat2Seconds(t, beat1End, round) : round;

  // Your untagged run: from the start in beat 1, from the moment you pass the TNT on in beat 2.
  const tagged = beat >= 1 && (beat === 2 || t >= tagAt);
  const passed = beat === 2 || (beat === 1 && t >= passAt);
  const passSec = beat2Seconds(passAt, beat1End, round);
  const runFrom = passed ? passSec : 0;
  const earlyPts = Math.floor(beat1End / per);
  const pts = !tagged ? Math.floor(sec / per) : earlyPts + Math.floor(Math.max(0, sec - passSec) / per);
  const holding = tagged && !passed;
  const bar = holding ? 0 : ((sec - runFrom) % per) / per;

  // Positions.
  let you: Pt, tagger: Pt, rival: Pt = RIVAL;
  const runEnd = RUN[RUN.length - 1], taggerEnd = along(RUN, 1 - LAG);
  if (beat === 0) {
    you = along(RUN, t);
    tagger = along(RUN, Math.max(0, t - LAG));
  } else {
    const close = easeInOut(seg(t, 0, tagAt));
    const catchAt: Pt = [runEnd[0] - 14, runEnd[1] - 6];
    // After the tag the old Tagger runs off, you chase the Runner in the middle, tag them and run away.
    tagger = t < tagAt ? [lerp(taggerEnd[0], catchAt[0], close), lerp(taggerEnd[1], catchAt[1], close)]
      : along([catchAt, [230, 60], [120, 50]], easeInOut(seg(t, tagAt, 0.62)));
    const toRival: Pt = [RIVAL[0] + 16, RIVAL[1] + 4];
    you = t < tagAt ? runEnd
      : t < passAt ? [lerp(runEnd[0], toRival[0], easeInOut(seg(t, tagAt + 0.02, passAt))), lerp(runEnd[1], toRival[1], easeInOut(seg(t, tagAt + 0.02, passAt)))]
      : [lerp(toRival[0], 352, easeInOut(seg(t, passAt, 0.6))), lerp(toRival[1], 58, easeInOut(seg(t, passAt, 0.6)))];
    if (beat === 2) you = [352, 58];
    if (beat === 1 && t >= passAt) rival = [lerp(RIVAL[0], 250, easeInOut(seg(t, passAt + 0.04, 0.6))), lerp(RIVAL[1], 88, easeInOut(seg(t, passAt + 0.04, 0.6)))];
    if (beat === 2) rival = [250, 88];
    if (beat === 2) tagger = [120, 50];
  }
  const boom = beat === 1 ? seg(t, 0.6, 0.92) : beat === 2 ? 1 : 0;
  const tntOn: Pt | null = boom > 0 ? null : !tagged ? tagger : holding ? you : rival;

  const left = Math.max(0, Math.ceil(round - sec));
  const pointFloats = beat === 0 ? [1, 2].map((k) => (t - (k * per) / beat1End) / 0.35) : [];

  return (
    <Stage>
      <SpedUp />
      <Label x={AX} y={18} text={`round ${left}s`} muted />
      <rect x={AX + 70} y={11} width={210} height={6} rx={3} class="sb-tok" />
      <rect x={AX + 70} y={11} width={210 * (left / round)} height={6} rx={3} style={{ fill: left < round / 4 ? 'var(--sb-hot)' : 'var(--sb-rival)' }} />

      <g opacity={beat === 2 ? 0.18 : 1}>
        <rect x={AX} y={AY} width={AW} height={AH} rx={10} style={{ fill: 'var(--sb-cell)', fillOpacity: 0.35 }} />
        {OTHERS.map(([x, y], i) => <Dot key={i} x={x + 6 * Math.sin((beat + t) * 2.1 + i)} y={y} kind="rival" />)}
        <Dot x={tagger[0]} y={tagger[1]} kind={tagged ? 'rival' : 'b'} />
        {boom < 1 && <Dot x={rival[0]} y={rival[1]} kind={passed ? 'b' : 'rival'} opacity={1 - boom} />}
        {boom >= 1 && <Dot x={rival[0]} y={rival[1]} kind="ghost" />}
        {boom > 0 && boom < 1 && <circle cx={rival[0]} cy={rival[1]} r={8 + 30 * boom} style={{ fill: 'var(--sb-hot)', opacity: 0.6 * (1 - boom) }} />}
        <Dot x={you[0]} y={you[1]} kind="you" />
        {holding && <circle cx={you[0]} cy={you[1]} r={6} style={{ fill: 'var(--sb-team-b)' }} />}
        {tntOn && <Tnt x={tntOn[0]} y={tntOn[1]} />}
        {boom > 0 && <Label x={rival[0]} y={rival[1] + 26} text="out" anchor="middle" />}
        {beat === 1 && t >= tagAt && t < passAt + 0.15 && <Label x={you[0]} y={you[1] + 24} text="reset to 0" anchor="middle" />}
        {pointFloats.map((p, i) => <Float key={i} x={you[0]} y={you[1] - 12} p={p} text="+1" />)}
      </g>

      {beat === 2 && (
        <g>
          <Label x={200} y={58} text="1 token per point" anchor="middle" />
          <Tokens x={200 - (max * 20 - 4) / 2} y={72} n={Math.min(max, Math.round(pts * clamp(t / 0.3)))} max={max} size={16} />
          <Label x={200} y={112} text={`never tagged in ${rounds} rounds: ${max}`} anchor="middle" muted />
        </g>
      )}

      <g opacity={beat === 1 ? 0.6 : 1}>
        <Readout x={AX} y={192} text={`${pts} pt${pts === 1 ? '' : 's'}`} anchor="start" />
      </g>
      {beat < 2 && (
        <g opacity={beat === 0 ? 1 : 0.85}>
          <Label x={AX + 96} y={176} text={`next point: ${per}s untagged`} muted />
          <rect x={AX + 96} y={182} width={150} height={8} rx={4} class="sb-tok" />
          <rect x={AX + 96} y={182} width={150 * bar} height={8} rx={4} style={{ fill: 'var(--sb-token)' }} />
        </g>
      )}
      {beat === 2 && <Readout x={390} y={192} text={`${pts} token${pts === 1 ? '' : 's'}`} />}
    </Stage>
  );
}
