import { describe, expect, it } from 'vitest';
import eventData from '../data/event.json';
import { copycatTokens, hiddenFraction, manor2Range, manor2Tokens, requiredAccuracy, scoreRangeTokens, secondsPerBlock, type GameMath } from './gameMath';

const M = (eventData as unknown as { gameMath: GameMath }).gameMath;
const sr = M.scoreRange!;
const cc = M.copycat!;
const mn = M.manor2!;

describe.runIf(sr && cc && mn)('game math, against what the guides state', () => {
  it('score range: 2 to 8, Java rounding (.5 rounds up), +1 for a win', () => {
    expect(scoreRangeTokens(sr, 0, 0, 60)).toBe(2);
    expect(scoreRangeTokens(sr, 28, 0, 60)).toBe(5); // SkyWars storyboard: 28 points is 5 Soul Orbs
    expect(scoreRangeTokens(sr, 55, 0, 60)).toBe(8); // 2 + round(5.5) = 8
    expect(scoreRangeTokens(sr, 999, 0, 60, true)).toBe(9);
    expect(scoreRangeTokens(sr, -5, 0, 60)).toBe(2);
  });

  it('Copycat: missing share 25% to 50% by round 10, then flat', () => {
    expect(hiddenFraction(cc, 1)).toBeCloseTo(0.25, 12);
    expect(hiddenFraction(cc, 10)).toBeCloseTo(0.5, 12);
    expect(hiddenFraction(cc, 15)).toBeCloseTo(0.5, 12);
  });

  it('Copycat: 2.5 s per block, about 2.26 s in round 10, just under 2 s in round 20', () => {
    expect(secondsPerBlock(cc, 1)).toBeCloseTo(2.5, 12);
    expect(secondsPerBlock(cc, 10)).toBeCloseTo(2.5 * 1.9 / 2.1, 12);
    expect(secondsPerBlock(cc, 20)).toBeLessThan(2);
    expect(secondsPerBlock(cc, 20)).toBeGreaterThan(1.99);
  });

  it('Copycat: need 30% in round 1, 48% by round 10, 3% a round after, 75% from round 19', () => {
    expect(requiredAccuracy(cc, 1)).toBeCloseTo(0.3, 12);
    expect(requiredAccuracy(cc, 10)).toBeCloseTo(0.48, 12);
    expect(requiredAccuracy(cc, 11)).toBeCloseTo(0.51, 12);
    expect(requiredAccuracy(cc, 18)).toBeCloseTo(0.72, 12);
    expect(requiredAccuracy(cc, 19)).toBeCloseTo(0.75, 12);
    expect(requiredAccuracy(cc, 20)).toBeCloseTo(0.75, 12);
    for (let r = 2; r <= 20; r++) expect(requiredAccuracy(cc, r)).toBeGreaterThanOrEqual(requiredAccuracy(cc, r - 1));
  });

  it('Copycat: Soul Orbs by rounds survived, as the guide lists them', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => copycatTokens(sr, cc, r))).toEqual([2, 3, 4, 4, 5, 6, 7, 7, 8, 8]);
  });

  it('Manor 2: 100 to 700 over a full 5 minutes, never below the 2.5 minute range of 50 to 350', () => {
    expect(manor2Range(mn, 5)).toEqual({ min: 100, max: 700 });
    expect(manor2Range(mn, 2.5)).toEqual({ min: 50, max: 350 });
    expect(manor2Range(mn, 1)).toEqual({ min: 50, max: 350 });
    expect(manor2Tokens(sr, mn, 300, 5)).toBe(4); // the guide's tie example
    expect(manor2Tokens(sr, mn, 350, 2.5)).toBe(8);
    expect(manor2Tokens(sr, mn, 100, 5, true)).toBe(3);
  });
});
