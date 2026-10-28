// Ports of the per-game formulas in luma-events, fed with the constants scripts/build-event.mjs reads from the code
// (src/data/event.json gameMath). Each function names the Java method it follows; keep them step for step.

export interface Num { value: number; src: string }
export interface ScoreRangeMath { MIN_TOKENS: Num; MAX_TOKENS: Num; WIN_BONUS: Num; src: string }
export interface CopycatMath {
  MIN_HIDDEN_FRACTION: Num; MAX_HIDDEN_FRACTION: Num; HARDEST_ROUND: Num; TIME_SCALE_PER_ROUND: Num; MIN_TIME_SCALE: Num;
  START_REQUIRED_ACCURACY: Num; MIN_REQUIRED_STEP: Num; MAX_REQUIRED_STEP: Num; MAX_REQUIRED_ACCURACY: Num;
  MIN_BUILD_SECONDS: Num; FULL_FRACTION_BLOCKS: Num; MIN_SIZE_SCALE: Num;
  buildSecondsPerBlock: Num; maxRounds: Num; MIN_ROUNDS: Num; MAX_ROUNDS: Num;
  src: string;
}
export interface Manor2Math { MIN_SCORE: Num; MAX_SCORE: Num; EXPECTED_PLAYTIME: Num; duration: Num; src: string }
export interface GameMath { scoreRange: ScoreRangeMath | null; copycat: CopycatMath | null; manor2: Manor2Math | null }

/** Java's Math.round for doubles: floor(x + 0.5). */
const javaRound = (x: number) => Math.floor(x + 0.5);

/** ScoreRangeTokenFormula.tokens: MIN + round((MAX - MIN) * progress through the range), + the bonus for a win. */
export function scoreRangeTokens(sr: ScoreRangeMath, score: number, minScore: number, maxScore: number, won = false): number {
  const max = Math.max(minScore + 1, maxScore);
  const progress = Math.min(1, Math.max(0, (score - minScore) / (max - minScore)));
  const earned = sr.MIN_TOKENS.value + javaRound((sr.MAX_TOKENS.value - sr.MIN_TOKENS.value) * progress);
  return won ? earned + sr.WIN_BONUS.value : earned;
}

// ---- Copycat (Copycat.java hiddenFraction / timeScale / requiredAccuracy) ----------------------------------------

/** Share of a build's open-sided blocks that go missing in this round (before the big-build cut). */
export function hiddenFraction(c: CopycatMath, round: number): number {
  const progress = Math.min(1, (round - 1) / (c.HARDEST_ROUND.value - 1));
  return c.MIN_HIDDEN_FRACTION.value + (c.MAX_HIDDEN_FRACTION.value - c.MIN_HIDDEN_FRACTION.value) * progress;
}

export function timeScale(c: CopycatMath, round: number): number {
  return Math.max(c.MIN_TIME_SCALE.value, 1 - c.TIME_SCALE_PER_ROUND.value * (round - 1));
}

/** Build seconds you get per missing block this round (Round.buildSeconds before the 15 s floor and rounding up). */
export const secondsPerBlock = (c: CopycatMath, round: number) => c.buildSecondsPerBlock.value * timeScale(c, round);

/** Share of your missing blocks you must put back right to survive this round. */
export function requiredAccuracy(c: CopycatMath, round: number): number {
  let required = c.START_REQUIRED_ACCURACY.value;
  for (let r = 2; r <= round && required < c.MAX_REQUIRED_ACCURACY.value; r++) {
    const progress = Math.min(1, (r - 2) / (c.HARDEST_ROUND.value - 2));
    required += c.MIN_REQUIRED_STEP.value + (c.MAX_REQUIRED_STEP.value - c.MIN_REQUIRED_STEP.value) * progress;
  }
  return Math.min(c.MAX_REQUIRED_ACCURACY.value, required);
}

/** Soul Orbs for this many rounds survived (CopycatTokenFormula), before the most-points bonus. */
export const copycatTokens = (sr: ScoreRangeMath, c: CopycatMath, roundsSurvived: number) =>
  scoreRangeTokens(sr, roundsSurvived, c.MIN_ROUNDS.value, c.MAX_ROUNDS.value);

// ---- Manor 2 (Manor2TokenFormula.rangeSupplier) -----------------------------------------------------------------

/** The score range a game of this length pays across: 2 Soul Orbs at the low end, 8 at the high end. */
export function manor2Range(m: Manor2Math, minutesPlayed: number): { min: number; max: number } {
  const expected = m.EXPECTED_PLAYTIME.value;
  const played = Math.max(expected / 2, minutesPlayed * 60_000);
  const progress = played / expected;
  return { min: Math.trunc(m.MIN_SCORE.value * progress), max: Math.trunc(m.MAX_SCORE.value * progress) };
}

export function manor2Tokens(sr: ScoreRangeMath, m: Manor2Math, score: number, minutesPlayed: number, won = false): number {
  const { min, max } = manor2Range(m, minutesPlayed);
  return scoreRangeTokens(sr, score, min, max, won);
}
