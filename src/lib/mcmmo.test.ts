import { describe, expect, it } from 'vitest';
import {
  brewTicks, brewsPerStandHour, catalysisSpeed, concoctionsTier, fishingTiming, masterAnglerRank,
} from './mcmmo';

describe('Catalysis (Luma mcMMO, Retro Mode)', () => {
  it('matches the in-game /alchemy reading: level 155 shows "Brewing Speed: 1.46x"', () => {
    expect(catalysisSpeed(155).toFixed(2)).toBe('1.46');
  });

  it('ramps from 1x at level 0 to 4x at 1000 and stays capped', () => {
    expect(catalysisSpeed(0)).toBe(1);
    expect(catalysisSpeed(500)).toBe(2.5);
    expect(catalysisSpeed(1000)).toBe(4);
    expect(catalysisSpeed(2500)).toBe(4);
    expect(catalysisSpeed(-5)).toBe(1);
    expect(catalysisSpeed(NaN)).toBe(1);
  });

  it('brew task finishes when the 400-tick timer drops below max(speed, 2)', () => {
    expect(brewTicks(1)).toBe(399);
    expect(brewTicks(4)).toBe(100);
    expect(brewTicks(2.5)).toBe(160); // 400 - 160*2.5 = 0 < 2.5, but 400 - 159*2.5 = 2.5 is not
    // Brute-force the task loop for a spread of speeds.
    for (let L = 0; L <= 1000; L += 37) {
      const s = catalysisSpeed(L);
      let timer = 400, n = 0;
      do { timer -= s; n++; } while (!(timer < Math.max(s, 2)));
      expect(brewTicks(s), `level ${L}`).toBe(n);
    }
  });

  it('one stand: ~180 brews/h at level 0, 720/h at 1000', () => {
    expect(brewsPerStandHour(0)).toBeCloseTo(72000 / 399, 6);
    expect(brewsPerStandHour(1000)).toBe(720);
  });

  it('Concoctions tier matches the in-game reading (155 -> rank 2/8) and the Retro thresholds', () => {
    expect(concoctionsTier(155)).toBe(2);
    expect([0, 99, 100, 349, 350, 999, 1000].map(concoctionsTier)).toEqual([1, 1, 2, 3, 4, 7, 8]);
  });
});

describe('Master Angler + Lure + rain', () => {
  it('rank thresholds match the in-game unlock (400 -> rank 4) and the /fishing reading at 425', () => {
    expect(masterAnglerRank(0)).toBe(0);
    expect(masterAnglerRank(1)).toBe(1);
    expect(masterAnglerRank(399)).toBe(3);
    expect(masterAnglerRank(400)).toBe(4);
    expect(masterAnglerRank(425)).toBe(4);
    expect(masterAnglerRank(1000)).toBe(8);
    // /fishing at 425: "min wait time reduction: -2.0 seconds", "max wait time reduction: -6.0 seconds"
    const t = fishingTiming({ level: 425, lure: 0, raining: false, handlingSeconds: 0, boat: false });
    expect([(100 - t.minWait) / 20, (600 - t.maxWait) / 20]).toEqual([2, 6]);
  });

  it('with Master Angler, Lure comes off the max wait (100 ticks/level) and vanilla Lure is off', () => {
    const t = fishingTiming({ level: 425, lure: 3, raining: false, handlingSeconds: 0, boat: false });
    expect([t.minWait, t.maxWait, t.vanillaLure]).toEqual([60, 180, false]);
    // mean wait 120 ticks + 50 swim-in + 1 roll tick
    expect(t.waitSeconds).toBeCloseTo(171 / 20, 9);
  });

  it('caps: min wait never below 40 ticks, max never below 100 (Lure V at rank 8)', () => {
    const t = fishingTiming({ level: 1000, lure: 5, raining: false, handlingSeconds: 0, boat: false });
    expect([t.minWait, t.maxWait]).toEqual([40, 100]);
  });

  it('without Master Angler, vanilla Lure subtracts from the roll and rerolls non-positive waits', () => {
    const none = fishingTiming({ level: 0, lure: 0, raining: false, handlingSeconds: 0, boat: false });
    expect(none.waitSeconds).toBeCloseTo((1 + 350 + 50) / 20, 9);
    const l3 = fishingTiming({ level: 0, lure: 3, raining: false, handlingSeconds: 0, boat: false });
    expect(l3.vanillaLure).toBe(true);
    // rolls 100..600 minus 300: 300 of 501 rolls are positive (1..300, mean 150.5)
    expect(l3.waitSeconds).toBeCloseTo((501 / 300 + 150.5 + 50) / 20, 9);
  });

  it('a boat takes another 10/30 ticks off, only with Master Angler, never past the floors', () => {
    const base = { lure: 3, raining: false, handlingSeconds: 0 };
    const land = fishingTiming({ ...base, level: 425, boat: false });
    const boat = fishingTiming({ ...base, level: 425, boat: true });
    expect([boat.minWait, boat.maxWait]).toEqual([land.minWait - 10, land.maxWait - 30]);
    expect([boat.minWait, boat.maxWait]).toEqual([50, 150]);
    // No Master Angler at level 0: mcMMO never touches the hook, so the boat changes nothing.
    expect(fishingTiming({ ...base, level: 0, boat: true }).waitSeconds).toBe(fishingTiming({ ...base, level: 0, boat: false }).waitSeconds);
    // Rank 8 + Lure V is already at the 40/100 floors.
    const capped = fishingTiming({ level: 1000, lure: 5, raining: false, handlingSeconds: 0, boat: true });
    expect([capped.minWait, capped.maxWait]).toEqual([40, 100]);
  });

  it('rain makes the timers run 1.25x faster on average; handling time adds per catch', () => {
    const dry = fishingTiming({ level: 425, lure: 3, raining: false, handlingSeconds: 1.5, boat: false });
    const wet = fishingTiming({ level: 425, lure: 3, raining: true, handlingSeconds: 1.5, boat: false });
    expect(wet.waitSeconds).toBeCloseTo((1 + 170 / 1.25) / 20, 9);
    expect(dry.secondsPerCatch).toBeCloseTo(dry.waitSeconds + 1.5, 9);
    expect(wet.catchesPerHour).toBeGreaterThan(dry.catchesPerHour);
    expect(dry.catchesPerHour).toBeCloseTo(3600 / (171 / 20 + 1.5), 9);
  });

  it('more Lure or more level is never slower', () => {
    let prev = Infinity;
    for (const lure of [0, 1, 2, 3, 4, 5]) {
      for (const level of [0, 1, 200, 400, 900]) {
        const s = fishingTiming({ level, lure, raining: false, handlingSeconds: 1, boat: false }).secondsPerCatch;
        expect(Number.isFinite(s)).toBe(true);
      }
      const s = fishingTiming({ level: 400, lure, raining: false, handlingSeconds: 1, boat: false }).secondsPerCatch;
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});
