// mcMMO speed-ups for Alchemist (Catalysis) and Fisherman (Master Angler), from Luma's fork
// LumaLibre/mcMMO @ e19e043: AlchemyManager.calculateBrewSpeed, AlchemyBrewTask, FishingManager.processMasterAngler,
// advanced.yml and skillranks.yml defaults. Luma runs Retro Mode (skills go to 1000): in game, /alchemy at
// level 155 shows "Brewing Speed: 1.46x" and /fishing at 425 shows Master Angler -2.0 s / -6.0 s.
// Fishing hook timing is vanilla + Paper (LumaLibre/Paper FishingHook.java.patch).

export const MCMMO_MAX_LEVEL = 1000;

const clampLevel = (level: number) => (Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0);

// ---------- Alchemy ----------

/** Catalysis: brewing speed ramps linearly from 1x at level 0 to 4x at level 1000 (Retro Mode). */
export function catalysisSpeed(level: number): number {
  // Same operation order as mcMMO, so 155 gives 1.4649999… and shows as "1.46x" like /alchemy does.
  return Math.min(4, 1 + 3 * (clampLevel(level) / 1000));
}

/**
 * Ticks for one brew. mcMMO's brew task counts a 400-tick timer down by `speed` each tick and
 * finishes once it drops below max(speed, 2), so 1x takes 399 ticks and 4x takes 100.
 */
export function brewTicks(speed: number): number {
  return Math.floor((400 - Math.max(speed, 2)) / speed) + 1;
}

/** Brews one always-fed brewing stand finishes per hour at this Alchemy level. */
export const brewsPerStandHour = (level: number) => (20 * 3600) / brewTicks(catalysisSpeed(level));

/** Concoctions rank thresholds (Retro Mode). Higher tiers unlock more ingredients. */
export const CONCOCTIONS_LEVELS = [0, 100, 200, 350, 500, 750, 900, 1000];

export function concoctionsTier(level: number): number {
  const L = clampLevel(level);
  return CONCOCTIONS_LEVELS.filter((t) => L >= t).length;
}

// ---------- Fishing ----------

/** Master Angler rank thresholds (Retro Mode). Rank 1 unlocks at level 1. */
export const MASTER_ANGLER_LEVELS = [1, 200, 300, 400, 600, 700, 800, 900];

export function masterAnglerRank(level: number): number {
  const L = clampLevel(level);
  return MASTER_ANGLER_LEVELS.filter((t) => L >= t).length;
}

export interface FishingSetup {
  /** mcMMO Fishing level. */
  level: number;
  /** Lure enchantment level on the rod, 0-5. */
  lure: number;
  /** Raining where the bobber is (open sky, in a biome where it rains). */
  raining: boolean;
  /** Fishing from a boat: Master Angler takes a bit more off both waits. */
  boat: boolean;
  /** Seconds spent reacting to the bite, reeling in and casting again until the bobber sits in water. */
  handlingSeconds: number;
}

export interface FishingTiming {
  rank: number;
  /** Range the "wait for a fish" timer is rolled from, in ticks. */
  minWait: number;
  maxWait: number;
  /** Whether vanilla Lure still subtracts from the roll (only without Master Angler). */
  vanillaLure: boolean;
  /** Average timer ticks consumed per game tick: rain adds a 25% chance of an extra tick. */
  timerSpeed: number;
  /** Average seconds from the bobber landing to a bite. */
  waitSeconds: number;
  secondsPerCatch: number;
  catchesPerHour: number;
}

/**
 * Average time per catch.
 * - Vanilla: the hook rolls a wait of 100-600 ticks, then a fish swims in over 20-80 ticks.
 *   Lure takes 100 ticks per level off the wait roll; a roll at or below 0 is rerolled next tick.
 * - Master Angler takes 10 ticks per rank off the minimum (floor 40) and 30 per rank off the maximum
 *   (floor 100). With Master Angler, mcMMO turns vanilla Lure off and instead takes 100 ticks per Lure
 *   level off the maximum, so Lure IV and V keep working.
 * - Boat: with Master Angler, another 10 ticks off the minimum and 30 off the maximum (same floors).
 * - Rain: each tick has a 25% chance to count double, for both the wait and the swim-in.
 * Assumes open sky above the bobber (under a roof, half the ticks don't count).
 */
export function fishingTiming(s: FishingSetup): FishingTiming {
  const rank = masterAnglerRank(s.level);
  const lure = Math.min(5, Math.max(0, Math.floor(s.lure) || 0));
  let minWait = 100;
  let maxWait = 600;
  let lureTicks = lure * 100;
  if (rank > 0) {
    const boat = s.boat ? 1 : 0;
    minWait = Math.max(40, minWait - 10 * rank - 10 * boat);
    maxWait = Math.max(100, maxWait - 30 * rank - 30 * boat - lureTicks);
    if (maxWait < minWait) maxWait = minWait + 100;
    lureTicks = 0;
  }
  // Paper: a lure bigger than the whole range leaves 1 tick instead of looping forever.
  const values: number[] = [];
  for (let r = minWait; r <= maxWait; r++) values.push(lureTicks >= maxWait ? 1 : r - lureTicks);
  const positive = values.filter((t) => t > 0);
  const pPositive = positive.length / values.length;
  const meanPositive = positive.reduce((a, b) => a + b, 0) / positive.length;

  const timerSpeed = s.raining ? 1.25 : 1;
  const SWIM_IN = 50; // mean of 20-80 ticks
  // One tick per roll (rerolls included), then the timers run down at timerSpeed.
  const waitTicks = 1 / pPositive + (meanPositive + SWIM_IN) / timerSpeed;
  const waitSeconds = waitTicks / 20;
  const secondsPerCatch = waitSeconds + Math.max(0, s.handlingSeconds || 0);
  return {
    rank, minWait, maxWait, vanillaLure: rank === 0 && lure > 0, timerSpeed,
    waitSeconds, secondsPerCatch, catchesPerHour: 3600 / secondsPerCatch,
  };
}
