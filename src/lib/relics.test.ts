import { describe, expect, it } from 'vitest';
import {
  astralOrbOdds, disassemblyOdds, DISASSEMBLY_REWARDS, enchantCountOdds, GRUBBY_PER_ACTION, GRUBBY_TOTAL,
  magmaticIfZero, MOB_RELIC_SPAWN, mobRelicPerKill, rejectionOdds,
} from './relics';

/** Seeded PRNG so the simulation is deterministic. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nextInt = (rng: () => number, until: number) => Math.floor(rng() * until);

/** A literal port of the plugin's loop: pick random entry; while (key < nextInt(101)) pick again. */
function simulateRejection(weights: number[], trials: number, rng: () => number): number[] {
  const hits = weights.map(() => 0);
  for (let t = 0; t < trials; t++) {
    let i = nextInt(rng, weights.length);
    while (weights[i] < nextInt(rng, 101)) i = nextInt(rng, weights.length);
    hits[i]++;
  }
  return hits.map((h) => h / trials);
}

describe('rejection-sampling odds', () => {
  it('closed form matches a simulation of the plugin loop (disassembler weights)', () => {
    const weights = DISASSEMBLY_REWARDS.map((r) => r.weight);
    const sim = simulateRejection(weights, 400_000, mulberry32(42));
    const exact = rejectionOdds(weights);
    exact.forEach((p, i) => expect(Math.abs(sim[i] - p)).toBeLessThan(0.002));
  });

  it('closed form matches the simulation where (w + 1) vs w matters most (weights 0, 1, 3)', () => {
    const weights = [0, 1, 3];
    const sim = simulateRejection(weights, 200_000, mulberry32(7));
    // (w + 1) / sum -> 1/7, 2/7, 4/7. A plain w / sum reading would give 0, 1/4, 3/4.
    rejectionOdds(weights).forEach((p, i) => expect(Math.abs(sim[i] - p)).toBeLessThan(0.005));
  });

  it('a weight of 0 is rare but possible', () => {
    const [zero] = rejectionOdds([0, 50]);
    expect(zero).toBeCloseTo(1 / 52, 10);
  });
});

describe('disassembly', () => {
  it('normal relic: Lunar Core is 6 / 565, shards 45 / 565, odds sum to 1', () => {
    const odds = disassemblyOdds(false);
    const by = (l: string) => odds.find((o) => o.reward.label === l)!.chance;
    expect(by('Lunar Core')).toBeCloseTo(6 / 565, 12);
    expect(by('4 Relic Shards')).toBeCloseTo(45 / 565, 12);
    expect(odds.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1, 12);
  });

  it('Astral relic adds an Astral Core at 101 / 666', () => {
    const odds = disassemblyOdds(true);
    expect(odds[0].reward.label).toBe('Astral Core');
    expect(odds[0].chance).toBeCloseTo(101 / 666, 12);
  });
});

describe('Astral Orb', () => {
  it('merges both Magmatic entries (36 + 1) out of 317', () => {
    const rows = astralOrbOdds();
    expect(rows.find((r) => r.set === 'Magmatic')!.chance).toBeCloseTo(37 / 317, 12);
    expect(rows.find((r) => r.set === 'Valley')!.chance).toBeCloseTo(71 / 317, 12);
    expect(rows.reduce((a, r) => a + r.chance, 0)).toBeCloseTo(1, 12);
  });

  it('Magmatic alone at weight 0 would be 1 / 281', () => {
    expect(magmaticIfZero()).toBeCloseTo(1 / 281, 12);
  });
});

describe('enchant counts (RelicCreator)', () => {
  it('weight 1 (Pulsar/Solar/Delta): 0 or 1 enchants, 50/50', () => {
    expect([...enchantCountOdds(1)]).toEqual([[0, 0.5], [1, 0.5]]);
  });
  it('weight 2 (Nova): 1 or 2 enchants', () => {
    expect([...enchantCountOdds(2)]).toEqual([[1, 0.5], [2, 0.5]]);
  });
  it('weight 7 (Lunar): 3 to 7 enchants, evenly', () => {
    const odds = enchantCountOdds(7);
    expect([...odds.keys()]).toEqual([3, 4, 5, 6, 7]);
    for (const p of odds.values()) expect(p).toBeCloseTo(0.2, 12);
  });
});

describe('drop sources', () => {
  it('9 in 101 hostile mobs spawn with a relic', () => expect(MOB_RELIC_SPAWN).toBeCloseTo(0.0891, 4));
  it('Grubby Relic: 3 in 20,000 job actions', () => expect(1 / GRUBBY_PER_ACTION).toBeCloseTo(6666.67, 1));
  it('Grubby total weight is 611', () => expect(GRUBBY_TOTAL).toBe(611));
  it('about 1 relic per 132 kills without Looting, 1 per 98 with Looting III', () => {
    expect(Math.round(1 / mobRelicPerKill(0))).toBe(132);
    expect(Math.round(1 / mobRelicPerKill(3))).toBe(98);
  });
});
