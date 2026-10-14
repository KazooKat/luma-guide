import { describe, expect, it } from 'vitest';
import data from '../data/event.json';
import type { EventData } from '../data/types';
import { actionsForChance, applyPayout, chanceWithin, deliver, jobTokenChance } from './event';

const EVENT = data as unknown as EventData; // see src/tabs/event/common.tsx

/** Seeded PRNG so the simulation is deterministic. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('job token odds', () => {
  it('is chance / bound (luma-events @ 35eba9b: Fisherman 364, Hunter 6, out of 90,000)', () => {
    expect(jobTokenChance(364, 90_000)).toBeCloseTo(0.0040444, 6);
    expect(jobTokenChance(6, 90_000)).toBeCloseTo(1 / 15_000, 10);
  });

  it('Tree Feller triples the bound, so Lumberjack odds drop to a third', () => {
    expect(jobTokenChance(10, 90_000, 3)).toBeCloseTo(jobTokenChance(10, 90_000) / 3, 12);
  });

  it('matches a simulation of the nextInt(bound) < chance roll', () => {
    const rng = mulberry32(7);
    let hits = 0;
    const trials = 2_000_000;
    for (let i = 0; i < trials; i++) if (Math.floor(rng() * 90_000) < 364) hits++;
    expect(hits / trials).toBeCloseTo(jobTokenChance(364, 90_000), 3);
  });

  it('works out the actions needed for a given chance', () => {
    const p = jobTokenChance(364, 90_000);
    const n = actionsForChance(p, 0.5);
    expect(chanceWithin(p, n)).toBeGreaterThanOrEqual(0.5);
    expect(chanceWithin(p, n - 1)).toBeLessThan(0.5);
    expect(actionsForChance(1, 0.9)).toBe(1);
  });

  it('every job in the built data has a sane chance', () => {
    expect(EVENT.jobs.list).toHaveLength(10);
    for (const j of EVENT.jobs.list) expect(jobTokenChance(j.chance, EVENT.jobs.bound)).toBeGreaterThan(0);
  });
});

describe('minigame payout modes (TokenPayout.apply)', () => {
  it('normal passes the formula result through', () => {
    expect(applyPayout(7, { amount: 1, flat: false })).toBe(7);
    expect(applyPayout(0, { amount: 1, flat: false })).toBe(0);
  });
  it('a multiplier rounds half up, like Java Math.round', () => {
    expect(applyPayout(3, { amount: 1.5, flat: false })).toBe(5); // 4.5 -> 5
    expect(applyPayout(3, { amount: 0.5, flat: false })).toBe(2); // 1.5 -> 2
  });
  it('flat ("casual") pays everyone the same, even with no score', () => {
    expect(applyPayout(0, { amount: 4, flat: true })).toBe(4);
  });
  it('"just for fun" pays nothing', () => {
    expect(applyPayout(12, { amount: 0, flat: false })).toBe(0);
  });
});

describe('token delivery (TokenExchanging.give)', () => {
  it('rounds the server multiplier up', () => {
    expect(deliver(3, 1.5, 20)).toEqual({ shown: 5, given: 5 });
  });
  it('caps what you get at 20, while the message shows the uncapped number', () => {
    expect(deliver(15, 2, 20)).toEqual({ shown: 30, given: 20 });
  });
  it('gives nothing for less than 1', () => {
    expect(deliver(0, 2, 20)).toEqual({ shown: 0, given: 0 });
  });
});
