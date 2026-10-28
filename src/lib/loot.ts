// Chest odds for SkyWars loot pools (LootChests.roll in luma-events). A chest gets exactly 1 package from each
// guaranteed category, then a random number of rolls (min to max, every count equally likely), each roll a weighted
// pick from the random packages with repeats allowed. Every pick is independent, so the odds below are exact.

export interface LootItem { material: string; count: number }
export interface LootPackage { key: string; weight: number; items: LootItem[]; src: string }
export interface LootPool {
  name: string;
  /** The chest block that uses this pool, e.g. "exposed_copper_chest". */
  chest: string;
  chestSrc: string;
  guaranteed: { name: string; packages: LootPackage[] }[];
  random: LootPackage[];
  minRolls: number;
  maxRolls: number;
  src: string;
}

const total = (ps: LootPackage[]) => ps.reduce((a, p) => a + p.weight, 0);
const rollCounts = (pool: LootPool) => Array.from({ length: pool.maxRolls - pool.minRolls + 1 }, (_, i) => pool.minRolls + i);

/** Chance one weighted pick from `ps` lands on a package that `hit` accepts. */
function pickChance(ps: LootPackage[], hit: (p: LootPackage) => boolean): number {
  const w = total(ps);
  return w ? ps.filter(hit).reduce((a, p) => a + p.weight, 0) / w : 0;
}

/** Chance that a chest from this pool gets at least 1 package that `hit` accepts. */
export function chestChance(pool: LootPool, hit: (p: LootPackage) => boolean): number {
  let none = 1;
  for (const c of pool.guaranteed) none *= 1 - pickChance(c.packages, hit);
  const q = pickChance(pool.random, hit);
  const counts = rollCounts(pool);
  none *= counts.reduce((a, r) => a + (1 - q) ** r, 0) / counts.length;
  return 1 - none;
}

/** Chance a chest holds at least 1 of any of these materials. */
export const chanceOfAny = (pool: LootPool, materials: readonly string[]) =>
  chestChance(pool, (p) => p.items.some((i) => materials.includes(i.material)));

/** Chance a chest gets this exact package at least once. */
export const chanceOfPackage = (pool: LootPool, pkg: LootPackage) => chestChance(pool, (p) => p === pkg);

/** Chance of this package when a guaranteed category makes its one pick. */
export const shareOf = (ps: LootPackage[], pkg: LootPackage) => pickChance(ps, (p) => p === pkg);

/** Average number of random rolls a chest gets. */
export const averageRolls = (pool: LootPool) => (pool.minRolls + pool.maxRolls) / 2;
