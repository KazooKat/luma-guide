import { describe, expect, it } from 'vitest';
import { req, xpAt, moneyAt, xpBase, moneyBase, totalXp, planLevels } from './scaling';

// Observed values are in-game /jobs readings from the research note (2026-09-24).
describe('req(L): XP needed for L -> L+1', () => {
  it.each([
    [23, 52355],
    [38, 235834],
    [39, 254934],
    [40, 275040],
    [48, 475130],
    // /jobs stats readings from the 2026-09-25 data run (not used in the fit)
    [1, 4], [7, 1486], [19, 29533], [30, 116099], [32, 140881],
    [37, 217712], [41, 296175], [46, 418206], [54, 676395],
  ])('L=%i matches observed %i within 1', (L, observed) => {
    expect(Math.abs(req(L) - observed)).toBeLessThanOrEqual(1);
  });

  it.each([
    [1, 4], [10, 4320], [20, 34440], [30, 116100], [50, 537000],
    [60, 927721], [70, 1472941], [80, 2198401], [84, 2544818],
  ])('reference L=%i -> %i', (L, v) => {
    expect(req(L)).toBe(v);
  });

  // The research note says 54,735,986, but that sums the unrounded polynomial; the game uses integers.
  it('total 1 -> 85 is 54,735,982', () => {
    expect(totalXp(1, 85)).toBe(54_735_982);
  });
});

describe('per-action scaling', () => {
  // Cook, baked potato. Money base 2.851 is an exact fit of L38/39/40.
  it.each([[38, 13.4], [39, 13.68], [40, 13.97]])('Cook money L=%i -> $%f', (L, v) => {
    expect(moneyAt(2.851, L)).toBeCloseTo(v, 2);
  });

  it.each([[23, 0.62], [38, 0.95], [39, 0.97], [40, 0.99], [48, 1.17]])(
    'Cook xp L=%i -> %f', (L, v) => {
      expect(Math.round(xpAt(0.1326, L) * 100) / 100).toBe(v);
    });

  it('Farmer L53 reading predicts the confirmed L54 reading', () => {
    const mb = moneyBase(5.21, 53);
    const xb = xpBase(6.1, 53);
    expect(Math.round(moneyAt(mb, 54) * 100) / 100).toBe(5.29);
    expect(Math.round(xpAt(xb, 54) * 100) / 100).toBe(6.21);
  });

  it('base normalization round-trips', () => {
    expect(xpAt(xpBase(4.78, 27), 27)).toBeCloseTo(4.78, 10);
    expect(moneyAt(moneyBase(3.8, 27), 27)).toBeCloseTo(3.8, 10);
  });
});

describe('planLevels: hours to level', () => {
  // Research worked example: Cook potatoes, 14,400/h, xp = 0.0221*(L+5), from 0 XP into 39.
  // The note's milestone table used its alternative linear fit (0.02198758L + 0.11396), which runs
  // <0.3% slower; these expectations use the stated (L+5) model.
  const plan = planLevels({ xpBase: 0.1326, moneyBase: 2.851, from: 39, to: 85, actionsPerHour: 14_400 });

  it.each([[40, 18.2], [50, 259.7], [70, 1150.2], [80, 1853.1], [85, 2280.7]])(
    'reaches %i after ~%i h', (L, h) => {
      const row = plan.rows.find((r) => r.level === L)!;
      expect(row.cumHours).toBeCloseTo(h, 0);
    });

  it('totals: ~52.4M XP, ~32.84M actions, ~$713.1M', () => {
    expect(plan.totalXp / 1e6).toBeCloseTo(52.4, 1);
    expect(plan.totalActions / 1e6).toBeCloseTo(32.84, 2);
    expect(plan.totalMoney / 1e6).toBeCloseTo(713.1, 1);
  });

  it('subtracts XP already earned into the current level', () => {
    const fresh = planLevels({ xpBase: 1, moneyBase: 1, from: 10, to: 11, actionsPerHour: 100 });
    const half = planLevels({ xpBase: 1, moneyBase: 1, from: 10, to: 11, actionsPerHour: 100, xpInto: req(10) / 2 });
    expect(half.totalHours).toBeCloseTo(fresh.totalHours / 2, 6);
  });

  it('returns an empty plan when target <= current', () => {
    const p = planLevels({ xpBase: 1, moneyBase: 1, from: 20, to: 20, actionsPerHour: 100 });
    expect(p.rows).toEqual([]);
    expect(p.totalHours).toBe(0);
  });
});
