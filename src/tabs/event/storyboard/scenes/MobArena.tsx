// Mob Arena: the arena from above, with spawn points in the corners and the green revive altar near the bottom.
// Beat 1: wave 1 of `waves` starts, mobs stream in from the spawn points (`mobsPerPlayer` per player) and a boss walks
// in, and you and a teammate cut them down while the enemies-left bar empties. Beat 2: your teammate falls and leaves
// a soul, you pick it up and carry it within `reviveRadius` blocks of the altar, and they come back there. Beat 3: the
// waves tick off with a `breakSeconds` break between them, wave 3 ends in Victory, and the payout is `soulOrbs`.
// Game time is compressed, which is why beats 1 and 2 say "sped up".
import { cellCenter, Dot, easeInOut, easeOut, Float, Grid, Label, lerp, Line, Readout, seg, SpedUp, Stage, type Pt } from '../kit';
import type { SceneProps } from '../Storyboard';

export const key = 'mob-arena';

/** The arena grid, and the cells used as spawn points and the altar. */
const GX = 12, GY = 22, SIZE = 16, GAP = 3, COLS = 13, ROWS = 8;
const at = (c: number, r: number) => cellCenter(GX, GY, SIZE, GAP, c, r);
const SPAWNS: [number, number][] = [[0, 0], [12, 0], [0, 7], [12, 7]];
const ALTAR_CELL: [number, number] = [6, 6];
const ALTAR = at(...ALTAR_CELL);
const RING = 26; // drawn size of the revive range around the altar
const PX = 272, PR = 392; // the side panel

const YOU: Pt = [110, 84];
const MATE: Pt = [160, 84];

/** Beat 1: each mob spawns at `s`, walks up to whoever kills it, and dies at `s + KILL`. Even ones are yours. */
const MOBS = Array.from({ length: 8 }, (_, i) => ({ from: at(...SPAWNS[(i * 3) % 4]), s: 0.04 + i * 0.085 }));
const WALK = 0.16, KILL = 0.2, FADE = 0.06;
/** The boss walks in from the top right corner and goes down after 3 hits. */
const BOSS_FROM = at(12, 0), BOSS_TO: Pt = [196, 58], BOSS_HITS = [0.62, 0.72, 0.82], BOSS_DIES = 0.86;

/** Beat 2: the fall, the walk to the soul, the pickup, the walk to the altar, and the revive. */
const FALL = [0.06, 0.14], TO_SOUL = [0.16, 0.38], TO_ALTAR = [0.42, 0.68], REVIVE = 0.7;
const DROP: Pt = [ALTAR[0] + 12, ALTAR[1] - 18]; // where you stand inside the ring
const BACK: Pt = [ALTAR[0] - 16, ALTAR[1] - 4]; // where your teammate comes back

/** Beat 3: when each wave lights, and when Victory shows. */
const WAVE_AT = 0.06, WAVE_STEP = 0.2, WIN_AT = 0.72;

/** Where a mob is: from its spawn point to a spot just short of its target, then still. */
function mobPos(from: Pt, to: Pt, p: number): Pt {
  const dx = from[0] - to[0], dy = from[1] - to[1];
  const d = Math.hypot(dx, dy) || 1;
  const stop: Pt = [to[0] + (dx / d) * 18, to[1] + (dy / d) * 18];
  const e = easeInOut(p);
  return [lerp(from[0], stop[0], e), lerp(from[1], stop[1], e)];
}

/** A soul on the ground: a small diamond in the token colour with a pulsing ring. */
function Soul({ x, y, t, scale = 1 }: { x: number; y: number; t: number; scale?: number }) {
  if (scale <= 0) return null;
  const pulse = (t * 4) % 1;
  const s = 5 * scale;
  return (
    <g>
      <circle cx={x} cy={y} r={6 + 8 * pulse} fill="none" stroke-width={1.5} opacity={(1 - pulse) * 0.7 * scale} style={{ stroke: 'var(--sb-token)' }} />
      <path d={`M${x} ${y - s * 1.4}L${x + s} ${y}L${x} ${y + s * 1.4}L${x - s} ${y}Z`} style={{ fill: 'var(--sb-token)' }} />
    </g>
  );
}

export function Scene({ beat, t, values }: SceneProps) {
  const waves = values.waves, perPlayer = values.mobsPerPlayer, radius = values.reviveRadius;
  const breakS = values.breakSeconds, orbs = values.soulOrbs;

  // Beat 1: how many enemies are down, for the bar.
  const killed = beat === 0 ? MOBS.filter((m) => t >= m.s + KILL).length + (t >= BOSS_DIES ? 1 : 0) : MOBS.length + 1;
  const left = 1 - killed / (MOBS.length + 1);

  // Beat 2: your walk and the soul.
  let you: Pt = YOU;
  if (beat === 1) {
    if (t < TO_ALTAR[0]) {
      const p = easeInOut(seg(t, TO_SOUL[0], TO_SOUL[1]));
      you = [lerp(YOU[0], MATE[0] - 10, p), lerp(YOU[1], MATE[1], p)];
    } else {
      const p = easeInOut(seg(t, TO_ALTAR[0], TO_ALTAR[1]));
      you = [lerp(MATE[0] - 10, DROP[0], p), lerp(MATE[1], DROP[1], p)];
    }
  }
  const fell = beat === 1 ? seg(t, FALL[0], FALL[1]) : 0;
  const carried = beat === 1 && t >= TO_SOUL[1];
  const revived = beat === 1 ? seg(t, REVIVE, REVIVE + 0.1) : 0;
  const soulAt: Pt = carried ? [you[0], you[1] - 14] : MATE;
  const inRing = beat === 1 && Math.hypot(you[0] - ALTAR[0], you[1] - ALTAR[1]) <= RING;

  const arenaOp = beat === 2 ? 1 - seg(t, 0, 0.12) : 1;
  const status = beat === 1 ? (t < FALL[0] ? 'Fighting' : t < TO_SOUL[1] ? 'Teammate fell' : t < REVIVE ? 'Soul picked up' : 'Revived!') : '';

  return (
    <Stage>
      {beat < 2 && <SpedUp />}
      {arenaOp > 0 && (
        <g opacity={arenaOp}>
          <Grid
            x={GX} y={GY} cols={COLS} rows={ROWS} size={SIZE} gap={GAP}
            look={(c, r) => (SPAWNS.some(([sc, sr]) => sc === c && sr === r) ? { kind: 'hot' } : c === ALTAR_CELL[0] && r === ALTAR_CELL[1] ? { kind: 'safe' } : undefined)}
          />
          <circle cx={ALTAR[0]} cy={ALTAR[1]} r={RING} fill="none" stroke-width={inRing ? 2.5 : 1.5} stroke-dasharray="4 4" style={{ stroke: 'var(--sb-safe)' }} />
          <Label x={ALTAR[0]} y={ALTAR[1] + RING + 13} text="altar" anchor="middle" />
          {beat === 1 && <Label x={ALTAR[0] + RING + 4} y={ALTAR[1] + 5} text={`${radius} blocks`} muted />}
          {beat === 0 && t < 0.3 && <Label x={GX + 2} y={GY - 6} text="spawn points" muted />}

          {/* Beat 1: the wave. */}
          {beat === 0 && MOBS.map((m, i) => {
            if (t < m.s) return null;
            const killer = i % 2 === 0 ? YOU : MATE;
            const pos = mobPos(m.from, killer, seg(t, m.s, m.s + WALK));
            const gone = seg(t, m.s + KILL, m.s + KILL + FADE);
            const hit = t >= m.s + KILL - 0.04 && t < m.s + KILL;
            return (
              <g key={i}>
                {hit && <Line points={[killer, pos]} kind="you" />}
                {gone < 1 && <Dot x={pos[0]} y={pos[1]} r={5} kind="b" opacity={(1 - gone) * seg(t, m.s, m.s + 0.03)} />}
              </g>
            );
          })}
          {beat === 0 && t < BOSS_DIES + FADE && (() => {
            const p = easeInOut(seg(t, 0.02, 0.5));
            const pos: Pt = [lerp(BOSS_FROM[0], BOSS_TO[0], p), lerp(BOSS_FROM[1], BOSS_TO[1], p)];
            const gone = seg(t, BOSS_DIES, BOSS_DIES + FADE);
            return (
              <g>
                {BOSS_HITS.map((h, i) => (t >= h && t < h + 0.04 ? <Line key={i} points={[i === 1 ? YOU : MATE, pos]} kind="you" /> : null))}
                <Dot x={pos[0]} y={pos[1]} r={10} kind="b" opacity={1 - gone} />
                {gone < 1 && <Label x={pos[0]} y={pos[1] - 15} text="boss" anchor="middle" muted />}
              </g>
            );
          })()}

          {/* Beat 2: a couple of mobs hang back while your teammate is down. */}
          {beat === 1 && [at(12, 7), at(0, 0)].map((p, i) => (
            <Dot key={i} x={p[0] + (i ? 14 : -14) + 3 * Math.sin(2 * Math.PI * (t + i / 2))} y={p[1] + (i ? -6 : 8)} r={5} kind="b" opacity={0.7} />
          ))}

          {/* Your teammate: fights in beat 1, falls and is carried back in beat 2. */}
          {beat === 1 && fell > 0 && revived < 1 && <Dot x={MATE[0]} y={MATE[1]} kind="ghost" opacity={fell * (1 - revived)} />}
          {beat === 1 && fell > 0 && !carried && <Soul x={MATE[0]} y={MATE[1]} t={t} scale={easeOut(fell)} />}
          {beat === 1 && carried && <Soul x={soulAt[0]} y={soulAt[1]} t={t} scale={1 - revived} />}
          {(beat === 0 || fell < 1) && <Dot x={MATE[0]} y={MATE[1]} kind="a" opacity={1 - fell} />}
          {revived > 0 && <Dot x={BACK[0]} y={BACK[1]} kind="a" opacity={revived} />}
          {beat === 1 && <Float x={BACK[0] - 30} y={BACK[1] - 8} p={seg(t, REVIVE, REVIVE + 0.3)} text="revived" />}

          <Dot x={you[0]} y={you[1]} />
        </g>
      )}

      {/* The side panel: the wave bar in beat 1, what is happening in beat 2. */}
      {beat < 2 && (
        <g>
          <Label x={PX} y={36} text={`Wave 1/${waves}`} />
          <rect class="sb-tok" x={PX} y={46} width={PR - PX} height={10} rx={3} />
          {left > 0 && <rect x={PX} y={46} width={(PR - PX) * left} height={10} rx={3} style={{ fill: 'var(--sb-team-b)' }} />}
          <Label x={PX} y={74} text="enemies left" muted />
          {beat === 0 && (
            <g>
              <Label x={PX} y={104} text={`${perPlayer} per player`} />
              <Label x={PX} y={122} text="plus a boss" muted />
            </g>
          )}
          {beat === 1 && <Label x={PX} y={110} text={status} />}
        </g>
      )}

      {/* Beat 3: the waves tick off with a break between them, then Victory. */}
      {beat === 2 && (
        <g opacity={seg(t, 0.04, 0.16)}>
          {Array.from({ length: waves }, (_, i) => {
            const w = 80, gap = 50, x0 = (400 - (waves * w + (waves - 1) * gap)) / 2;
            const x = x0 + i * (w + gap);
            const on = t >= WAVE_AT + i * WAVE_STEP;
            return (
              <g key={i}>
                <rect class={`sb-c${on ? ' safe' : ''}`} x={x} y={40} width={w} height={26} rx={5} />
                <text class="sb-lbl" x={x + w / 2} y={58} text-anchor="middle" style={on ? { fill: 'var(--sb-stage)' } : undefined}>{`Wave ${i + 1}`}</text>
                {i < waves - 1 && (
                  <g>
                    <Label x={x + w + gap / 2} y={52} text={`${breakS}s`} anchor="middle" muted />
                    <Label x={x + w + gap / 2} y={66} text="break" anchor="middle" muted />
                  </g>
                )}
              </g>
            );
          })}
          <g opacity={seg(t, WIN_AT, WIN_AT + 0.08)}>
            <Readout x={200} y={122} text="Victory!" anchor="middle" />
            <Label x={200} y={146} text="Win or lose, no payout" anchor="middle" muted />
          </g>
        </g>
      )}

      {beat === 2
        ? <Readout text={`${orbs} Soul Orbs`} />
        : <Label x={PR} y={190} text={`${orbs} Soul Orbs`} anchor="end" muted />}
    </Stage>
  );
}
