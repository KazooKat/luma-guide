// Soccer: a simplified pitch, 2 a side. You (team a) run into the ball at the centre spot, which is a First touch
// play, and the push sends it past their keeper into the goal you attack: a Goal play and `pointsPerGoal` for your
// team, first to `pointsToWin`. Beat 3 skips to the end of the game (so it says "sped up") and pays the guide's
// example: `examplePlays` plays on the team that is ahead is `baseTokens` + 1 per `playsPerToken` plays +
// `winBonus`, up to `maxTokens`.
import { along, clamp, Dot, easeInOut, Float, Label, lerp, Line, Readout, seg, SpedUp, Stage, Tokens, type Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'soccer';

const X0 = 28, X1 = 372, Y0 = 18, Y1 = 128, MX = (X0 + X1) / 2, MY = (Y0 + Y1) / 2;
const GOAL_H = 36, GOAL_D = 10, BOX_W = 40, BOX_H = 64;
const CONTACT = 0.32;
const BALL_FROM: Pt = [MX, MY], BALL_TO: Pt = [X1 + GOAL_D / 2 + 1, MY - 2];
const YOU_RUN: Pt[] = [[118, 104], [160, 86], [MX - 14, MY + 2]];
const YOU_AFTER: Pt[] = [[MX - 14, MY + 2], [236, 76], [290, 80]];
const BAR_X = 236, BAR_W = 100;
const TOK = 14, STEP = TOK + 4;

/** A label on a small stage-coloured backing, so it reads on top of the pitch. */
function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  // About 7.5px a character for .sb-lbl at 14px.
  const w = text.length * 7.5 + 12;
  return (
    <g>
      <rect x={x - w / 2} y={y - 14} width={w} height={19} rx={4} style={{ fill: 'var(--sb-stage)' }} opacity={0.85} />
      <Label x={x} y={y} text={text} anchor="middle" />
    </g>
  );
}

function Pitch() {
  return (
    <g>
      <rect class="sb-c" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} rx={4} />
      <rect class="sb-line" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} rx={4} />
      <Line points={[[MX, Y0], [MX, Y1]]} />
      <circle class="sb-line" cx={MX} cy={MY} r={18} />
      <rect class="sb-line" x={X0} y={MY - BOX_H / 2} width={BOX_W} height={BOX_H} />
      <rect class="sb-line" x={X1 - BOX_W} y={MY - BOX_H / 2} width={BOX_W} height={BOX_H} />
      <rect class="sb-c wall" x={X0 - GOAL_D} y={MY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} rx={2} />
      <rect class="sb-c wall" x={X1} y={MY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} rx={2} />
      <Label x={X0 + 6} y={Y1 - 7} text="you defend" muted />
      <Label x={X1 - 6} y={Y1 - 7} text="you attack" anchor="end" muted />
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const ppg = values.pointsPerGoal, win = values.pointsToWin, base = values.baseTokens, ppt = values.playsPerToken;
  const bonus = values.winBonus, max = values.maxTokens, plays = values.examplePlays;

  // The shot: from the touch at CONTACT in beat 1 until it is in the goal at 0.3 of beat 2.
  const shot = seg(beat + t, CONTACT, 1.3);
  const touched = beat > 0 || t >= CONTACT;
  const scored = beat > 1 || (beat === 1 && t >= 0.3);
  const [bx, by] = touched ? along([BALL_FROM, BALL_TO], 1 - (1 - shot) ** 1.6) : BALL_FROM;

  const [yx, yy] = !touched ? along(YOU_RUN, seg(t, 0, CONTACT)) : along(YOU_AFTER, beat === 0 ? seg(t, CONTACT, 1) * 0.5 : 0.5 + 0.5 * (beat === 1 ? easeInOut(seg(t, 0, 0.4)) : 1));
  const late = (a: number) => (beat === 0 ? seg(t, a, 1) * 0.6 : 0.6 + 0.4 * (beat === 1 ? seg(t, 0, 0.4) : 1));
  const mate = along([[110, 40], [215, 44]], late(0));
  const chaser = along([[255, 42], [320, 62]], late(0.1));
  // Their keeper steps across too late: the ball passes more than a player's width below.
  const keeper = along([[352, 38], [354, 56]], late(0.5));

  // Your plays and the team score. Beat 3 jumps to the end of the game.
  const end = beat === 2 ? seg(t, 0, 0.2) : 0;
  const yours = beat === 2 ? Math.round(lerp(2, plays, end)) : (touched ? 1 : 0) + (scored ? 1 : 0);
  const scoreA = beat === 2 ? ppg * Math.round(lerp(1, win / ppg, end)) : scored ? ppg : 0;
  const barA = beat === 1 ? (scored ? seg(t, 0.3, 0.5) : 0) * (ppg / win) : beat === 2 ? scoreA / win : 0;

  // The payout, built up group by group: the 3 to start, 1 per 2 plays, then the bonus for being ahead.
  const fromPlays = Math.floor(plays / ppt);
  const group = (n: number, a: number, b: number) => (beat === 2 ? Math.floor(seg(t, a, b) * n + 1e-6) : 0);
  const nBase = group(base, 0.2, 0.34), nPlays = group(fromPlays, 0.38, 0.58), nBonus = group(bonus, 0.6, 0.7);
  const lit = Math.min(max, nBase + nPlays + nBonus);
  const tx = (400 - (max * STEP - 4)) / 2, ty = 50;
  const mid = (from: number, n: number) => tx + from * STEP + (n * STEP - 4) / 2;
  const show = (a: number) => (beat === 2 ? seg(t, a, a + 0.06) : 0);

  return (
    <Stage>
      {beat === 2 && <SpedUp />}
      {beat === 2 && <Label x={X0} y={12} text="end of the game" muted />}
      {beat === 2 && <g opacity={0.15}><Pitch /></g>}
      {beat < 2 && <g>
        <Pitch />
        {!touched && <g opacity={0.8}><Line points={[YOU_RUN[0], [yx, yy]]} kind="you" dash /></g>}
        {touched && !scored && <Line points={[BALL_FROM, [bx, by]]} dash />}
        <Dot x={mate[0]} y={mate[1]} kind="a" />
        <Dot x={chaser[0]} y={chaser[1]} kind="b" />
        <Dot x={keeper[0]} y={keeper[1]} kind="b" />
        <Dot x={yx} y={yy} />
        <rect class="sb-ink" x={bx - 5} y={by - 5} width={10} height={10} rx={2} />
        {beat === 0 && touched && <Tag x={MX} y={MY + 34} text="First touch, 1 play" />}
        {scored && beat === 1 && (
          <g opacity={seg(t, 0.3, 0.38)}>
            <Tag x={X1 - 60} y={MY + 30} text={`Goal, +${ppg} points`} />
          </g>
        )}
      </g>}

      {beat === 2 && (
        <g>
          <Tokens x={tx} y={ty} n={lit} max={max} size={TOK} />
          <g opacity={show(0.2)}><Label x={mid(0, base)} y={ty + 32} text={`${base} to start`} anchor="middle" /></g>
          <g opacity={show(0.38)}><Label x={mid(base, fromPlays)} y={ty - 8} text={`+${fromPlays} for ${plays} plays`} anchor="middle" /></g>
          <g opacity={show(0.6)}><Label x={mid(base + fromPlays, bonus)} y={ty + 32} text={`+${bonus} ahead`} anchor="middle" /></g>
          <Label x={tx + max * STEP - 4} y={ty + 32} text={`max ${max}`} anchor="end" muted />
          <Readout x={MX} y={118} text={`${lit} tokens`} anchor="middle" />
        </g>
      )}

      <g opacity={beat === 1 ? 0.6 : 1}>
        <Readout x={X0} y={168} text={`${yours} play${yours === 1 ? '' : 's'}`} anchor="start" />
        <Label x={X0} y={188} text="your plays" muted />
      </g>
      <Float x={X0 + 124} y={160} p={beat === 0 ? seg(t, CONTACT, CONTACT + 0.3) : beat === 1 ? seg(t, 0.3, 0.6) : 0} text="+1" />

      <g opacity={beat === 0 ? 0.6 : 1}>
        <Label x={X1} y={146} text={`first to ${win}`} anchor="end" muted />
        <rect class="sb-tok" x={BAR_X} y={154} width={BAR_W} height={8} rx={4} />
        <rect class="sb-a" x={BAR_X} y={154} width={BAR_W * clamp(barA)} height={8} rx={4} />
        <circle class="sb-a" cx={BAR_X - 10} cy={158} r={4} />
        <Label x={X1} y={163} text={`${scoreA}`} anchor="end" />
        <rect class="sb-tok" x={BAR_X} y={170} width={BAR_W} height={8} rx={4} />
        <circle class="sb-b" cx={BAR_X - 10} cy={174} r={4} />
        <Label x={X1} y={179} text="0" anchor="end" />
      </g>
      <Float x={BAR_X - 26} y={164} p={beat === 1 ? seg(t, 0.3, 0.7) : 0} text={`+${ppg}`} />
    </Stage>
  );
}
