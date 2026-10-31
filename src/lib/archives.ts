// Archive of Astralis job books. The boost comes from LumaItems (items/misc/jobs/ArchiveOfAstralisItemNest.kt); how
// books were handed out and re-rolled comes from luma-events @ 465b8be (the christmas branch, Christmas 2025).

/** The % a book can have (LumaItems createItem rolls nextInt(2, 6)). */
export const ARCHIVE_PERCENTS = [2, 3, 4, 5] as const;

/**
 * Where a book counts: LumaItems fires job items from every armor slot and both hands (equipmentSources), one slot at
 * a time, so a book in each hand plus one on your head via /hat all apply.
 */
export const ARCHIVE_SLOTS = ['Main hand', 'Off hand', 'Head (/hat)'] as const;

const valid = (p: number) => (ARCHIVE_PERCENTS as readonly number[]).includes(p);

/**
 * What the held books multiply a job's XP and money by. Each book multiplies by (1 + p / 100) on its own
 * (event.exp *= p / 100 + 1), so they compound. 0 or anything that isn't a book % means an empty slot.
 */
export function archiveMultiplier(percents: readonly number[]): number {
  return percents.slice(0, ARCHIVE_SLOTS.length).filter(valid).reduce((m, p) => m * (1 + p / 100), 1);
}

/** Christmas 2025 present and re-roll odds (ArchivePercentChance.kt: weights out of 100). */
export const ARCHIVE_ODDS: readonly { percent: number; weight: number }[] = [
  { percent: 5, weight: 15 },
  { percent: 4, weight: 30 },
  { percent: 3, weight: 45 },
  { percent: 2, weight: 10 },
];
const TOTAL = ARCHIVE_ODDS.reduce((a, o) => a + o.weight, 0);
export const archiveChance = (percent: number) => (ARCHIVE_ODDS.find((o) => o.percent === percent)?.weight ?? 0) / TOTAL;

/** Christmas 2025 re-roll station (ArchiveReRollGui.kt): $3M, +$1M per roll already on the book, at most $5M. */
export const REROLL = { base: 3_000_000, step: 1_000_000, max: 5_000_000 } as const;
export const rerollCost = (rolls: number) => Math.min(REROLL.base + rolls * REROLL.step, REROLL.max);

/**
 * Expected money to re-roll a book from `from`% until it reaches at least `to`%, starting with `rolls` re-rolls on it.
 * A roll pays the cost, then rolls a new % from ARCHIVE_ODDS. A higher % replaces the book with a fresh one that has
 * 1 roll on it (so the next roll costs $4M again); anything else just adds 1 roll. A 5% book can't be re-rolled.
 */
export function expectedRerollCost(from: number, to: number, rolls = 0): number {
  if (from >= to) return 0;
  // From 2 rolls on, the cost is capped, so E(level, rolls >= 2) is one value per level.
  const memo = new Map<string, number>();
  const E = (level: number, r: number): number => {
    if (level >= to) return 0;
    const key = `${level}:${Math.min(r, 2)}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const stay = ARCHIVE_ODDS.filter((o) => o.percent <= level).reduce((a, o) => a + o.weight, 0) / TOTAL;
    const up = ARCHIVE_ODDS.filter((o) => o.percent > level).reduce((a, o) => a + (o.weight / TOTAL) * E(o.percent, 1), 0);
    let v: number;
    if (r >= 2) v = (rerollCost(2) + up) / (1 - stay); // E = cost + stay·E + up
    else v = rerollCost(r) + up + stay * E(level, r + 1);
    memo.set(key, v);
    return v;
  };
  return E(from, rolls);
}
