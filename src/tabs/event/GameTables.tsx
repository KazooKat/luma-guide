import type { JSX } from 'preact';
import {
  copycatTokens, hiddenFraction, manor2Range, manor2Tokens, requiredAccuracy, secondsPerBlock,
  type CopycatMath, type Manor2Math, type ScoreRangeMath,
} from '../../lib/gameMath';

const pct = (p: number) => `${Math.round(p * 100)}%`;
/** A column header with a shorter version for phones. */
const Head = ({ long, short }: { long: string; short: string }) => (
  <span role="columnheader" aria-label={long}><span class="gt-long">{long}</span><span class="gt-short" aria-hidden="true">{short}</span></span>
);
/** Background for a cell, stronger as `t` goes from 0 to 1. */
const heat = (t: number) => ({ background: `color-mix(in srgb, var(--chart) ${Math.round(Math.min(1, Math.max(0, t)) * 65)}%, transparent)` });

/** Copycat: how each round gets harder, and what surviving it pays. */
export function CopycatRounds({ c, sr, cite }: { c: CopycatMath; sr: ScoreRangeMath; cite: JSX.Element }) {
  const rounds = Array.from({ length: c.maxRounds.value }, (_, i) => i + 1);
  const minOrbs = sr.MIN_TOKENS.value;
  const maxOrbs = sr.MAX_TOKENS.value;
  return (
    <div class="wu-block game-table">
      <h3>Round by round{cite}</h3>
      <p class="explain-line">
        Each round takes away a bigger share of the blocks that have an open side, gives you less time per missing block, and needs more of them right.
        A build over {c.FULL_FRACTION_BLOCKS.value} blocks loses a smaller share, and you always get at least {c.MIN_BUILD_SECONDS.value} seconds.
        Soul Orbs count the rounds you get through, and the player with the most points at the end gets {sr.WIN_BONUS.value} more.
      </p>
      <div class="gt-table copycat" role="table" aria-label="Copycat rounds">
        <div class="gt-row head" role="row">
          <Head long="Round" short="#" />
          <Head long="Blocks removed" short="Removed" />
          <Head long="Time per block" short="Per block" />
          <Head long="Need right" short="Need" />
          <Head long="Soul Orbs if you get through it" short="Orbs" />
        </div>
        {rounds.map((r) => {
          const need = requiredAccuracy(c, r);
          const orbs = copycatTokens(sr, c, r);
          return (
            <div class="gt-row" role="row" key={r}>
              <span role="rowheader" class="gt-key">{r}</span>
              <span role="cell">{pct(hiddenFraction(c, r))}</span>
              <span role="cell">{secondsPerBlock(c, r).toFixed(2)} s</span>
              <span role="cell" class="gt-heat" style={heat((need - c.START_REQUIRED_ACCURACY.value) / (c.MAX_REQUIRED_ACCURACY.value - c.START_REQUIRED_ACCURACY.value))}>{pct(need)}</span>
              <span role="cell" class="gt-heat" style={heat((orbs - minOrbs) / (maxOrbs - minOrbs))}>{orbs}</span>
            </div>
          );
        })}
      </div>
      <p class="note">
        Fall short of "need right" and you're out, unless nobody reaches it, then everyone stays in. The game stops after round {c.maxRounds.value} by default, or sooner if the server runs out of builds.
      </p>
    </div>
  );
}

const MANOR_SCORES = Array.from({ length: 15 }, (_, i) => i * 50);
const MANOR_MINUTES = [2.5, 3, 3.5, 4, 4.5, 5];

/** Manor 2: Soul Orbs by score and by how long the game ran, since a shorter game pays out over a lower range. */
export function Manor2Payouts({ m, sr, cite }: { m: Manor2Math; sr: ScoreRangeMath; cite: JSX.Element }) {
  const full = m.duration.value / 60_000;
  const minutes = MANOR_MINUTES.filter((x) => x <= full);
  const short = manor2Range(m, 0);
  const whole = manor2Range(m, full);
  const span = sr.MAX_TOKENS.value - sr.MIN_TOKENS.value;
  return (
    <div class="wu-block game-table">
      <h3>Soul Orbs by score{cite}</h3>
      <p class="explain-line">
        A full {full} minute game pays {sr.MIN_TOKENS.value} Soul Orbs at {whole.min} points or less and {sr.MAX_TOKENS.value} at {whole.max} or more.
        A game that ends sooner, when one side is wiped out, pays over a lower range, but never lower than {short.min} to {short.max} (the {m.EXPECTED_PLAYTIME.value / 120_000} minute range).
        Your side winning adds {sr.WIN_BONUS.value}, and a tie when time runs out adds nothing.
      </p>
      <div class="gt-table manor" role="table" aria-label="Manor 2 Soul Orbs by score and game length">
        <div class="gt-row head" role="row">
          <Head long="Score" short="Score" />
          {minutes.map((x, i) => <Head key={x} long={i === 0 ? `${x} min or less` : `${x} min`} short={i === 0 ? `≤${x}m` : `${x}m`} />)}
        </div>
        {MANOR_SCORES.map((s) => (
          <div class="gt-row" role="row" key={s}>
            <span role="rowheader" class="gt-key">{s}</span>
            {minutes.map((x) => {
              const t = manor2Tokens(sr, m, s, x);
              return <span role="cell" class="gt-heat" style={heat((t - sr.MIN_TOKENS.value) / span)} key={x}>{t}</span>;
            })}
          </div>
        ))}
      </div>
      <p class="note">Game length counts from when the game starts. Scores between the rows pay in between.</p>
    </div>
  );
}
