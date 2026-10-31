import { describe, expect, it } from 'vitest';
import { ARCHIVE_ODDS, archiveChance, archiveMultiplier, expectedRerollCost, rerollCost } from './archives';

describe('archiveMultiplier', () => {
  it('is 1 with no books', () => {
    expect(archiveMultiplier([])).toBe(1);
    expect(archiveMultiplier([0, 0, 0])).toBe(1);
  });

  it('multiplies each book on its own, so books compound', () => {
    expect(archiveMultiplier([5])).toBeCloseTo(1.05, 12);
    expect(archiveMultiplier([5, 5])).toBeCloseTo(1.1025, 12);
    expect(archiveMultiplier([5, 5, 5])).toBeCloseTo(1.157625, 12);
    expect(archiveMultiplier([2, 0, 4])).toBeCloseTo(1.02 * 1.04, 12);
  });

  it('ignores values that are not a book % and anything past the 3 slots', () => {
    expect(archiveMultiplier([1, 6, 50])).toBe(1);
    expect(archiveMultiplier([5, 5, 5, 5])).toBeCloseTo(1.157625, 12);
  });
});

describe('Christmas 2025 odds and re-rolls', () => {
  it('has weights out of 100, 3% most likely', () => {
    expect(ARCHIVE_ODDS.reduce((a, o) => a + o.weight, 0)).toBe(100);
    expect(archiveChance(3)).toBe(0.45);
    expect(archiveChance(5)).toBe(0.15);
  });

  it('costs $3M, then $1M more per roll, capped at $5M', () => {
    expect([0, 1, 2, 3, 10].map(rerollCost)).toEqual([3e6, 4e6, 5e6, 5e6, 5e6]);
  });

  it('works out 4% -> 5% by hand: 3M + 0.85·4M + 5M·0.85²/0.15', () => {
    expect(expectedRerollCost(4, 5)).toBeCloseTo(3e6 + 0.85 * 4e6 + (5e6 * 0.85 ** 2) / 0.15, 0);
    expect(expectedRerollCost(5, 5)).toBe(0);
  });

  it('matches a seeded simulation of the re-roll station', () => {
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const roll = () => {
      let r = rand() * 100;
      for (const o of ARCHIVE_ODDS) if ((r -= o.weight) < 0) return o.percent;
      return 3;
    };
    for (const from of [2, 3, 4]) {
      const runs = 40_000;
      let total = 0;
      for (let n = 0; n < runs; n++) {
        let level = from, rolls = 0;
        while (level < 5) {
          total += rerollCost(rolls);
          const p = roll();
          if (p > level) { level = p; rolls = 1; } else rolls++;
        }
      }
      expect(total / runs / expectedRerollCost(from, 5), `from ${from}%`).toBeCloseTo(1, 1);
    }
  });
});
