import { describe, expect, it } from 'vitest';
import eventData from '../data/event.json';
import { chanceOfAny, chanceOfPackage, chestChance, shareOf, type LootPackage, type LootPool } from './loot';

const LOOT = (eventData as unknown as { skywarsLoot: { pools: LootPool[] } | null }).skywarsLoot;

/** mulberry32: a small seeded PRNG so the simulation is the same every run. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** LootChests.roll + pick, step for step: 1 pick per guaranteed category, then nextInt(min, max + 1) weighted picks. */
function simulateChest(pool: LootPool, r: () => number): LootPackage[] {
  const pick = (ps: LootPackage[]) => {
    let roll = Math.floor(r() * ps.reduce((a, p) => a + p.weight, 0));
    for (const p of ps) { roll -= p.weight; if (roll < 0) return p; }
    throw new Error('unreachable');
  };
  const out = pool.guaranteed.map((c) => pick(c.packages));
  const rolls = pool.minRolls + Math.floor(r() * (pool.maxRolls - pool.minRolls + 1));
  for (let i = 0; i < rolls; i++) out.push(pick(pool.random));
  return out;
}

describe('loot odds', () => {
  const pkg = (key: string, weight: number, material = key): LootPackage => ({ key, weight, items: [{ material, count: 1 }], src: 'x:1' });
  const pool: LootPool = {
    name: 't', chest: 'copper_chest', chestSrc: 'x:1', src: 'x:1', minRolls: 1, maxRolls: 3,
    guaranteed: [{ name: 'gear', packages: [pkg('a', 3), pkg('b', 1)] }],
    random: [pkg('a', 1), pkg('c', 1)],
  };

  it('works out a guaranteed pick and the random rolls together', () => {
    // a: guaranteed 3/4, and each random roll 1/2 over 1, 2 or 3 rolls
    const noneRandom = (0.5 + 0.25 + 0.125) / 3;
    expect(chanceOfAny(pool, ['a'])).toBeCloseTo(1 - 0.25 * noneRandom, 12);
    expect(chanceOfAny(pool, ['b'])).toBeCloseTo(0.25, 12);
    expect(chanceOfAny(pool, ['c'])).toBeCloseTo(1 - noneRandom, 12);
    expect(chanceOfAny(pool, ['zzz'])).toBe(0);
    expect(shareOf(pool.guaranteed[0].packages, pool.guaranteed[0].packages[0])).toBe(0.75);
  });

  it.runIf(LOOT)('matches a simulation of the plugin roll for every pool and package', () => {
    const r = rng(20261028);
    const N = 40000;
    for (const p of LOOT!.pools) {
      const seen = new Map<LootPackage, number>();
      for (let i = 0; i < N; i++) for (const k of new Set(simulateChest(p, r))) seen.set(k, (seen.get(k) ?? 0) + 1);
      for (const k of [...p.random, ...p.guaranteed.flatMap((c) => c.packages)]) {
        const exact = chanceOfPackage(p, k);
        // 4.5 standard errors: a real formula mistake shows up, sampling noise doesn't
        expect(Math.abs((seen.get(k) ?? 0) / N - exact), `${p.name} ${k.key}`).toBeLessThan(4.5 * Math.sqrt(exact * (1 - exact) / N) + 1e-9);
      }
    }
  });

  it.runIf(LOOT)('agrees with the numbers the SkyWars guide states', () => {
    const epic = LOOT!.pools.find((p) => p.name === 'epic')!;
    for (const m of ['mace', 'totem_of_undying', 'enchanted_golden_apple']) expect(Math.round(chanceOfAny(epic, [m]) * 100), m).toBe(12);
    const gear = epic.guaranteed[0].packages;
    expect(Math.round(shareOf(gear, gear.find((p) => p.key === 'diamond_sword')!) * 100)).toBe(19);
    expect(chestChance(epic, (p) => p.items.some((i) => i.material.startsWith('netherite_')))).toBeGreaterThan(0.15);
  });

  it.runIf(LOOT)('every loot item has an icon on the site', async () => {
    const { existsSync } = await import('node:fs');
    const missing = new Set<string>();
    for (const p of LOOT!.pools) {
      if (!existsSync(`public/icons/${p.chest}.png`)) missing.add(p.chest);
      for (const k of [...p.random, ...p.guaranteed.flatMap((c) => c.packages)]) for (const i of k.items) if (!existsSync(`public/icons/${i.material}.png`)) missing.add(i.material);
    }
    expect([...missing], 'add these to EXTRA_ICONS in scripts/build_data.py').toEqual([]);
  });
});
