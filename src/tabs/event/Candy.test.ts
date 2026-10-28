import { describe, expect, it } from 'vitest';
import eventData from '../../data/event.json';
import type { CandyEffect, EventCandy, EventData } from '../../data/types';
import { chancePct, effectText, nothingChance } from './Candy';

const fx = (chance: number, potions: CandyEffect['potions'], message = 'msg'): CandyEffect => ({ chance, message, potions, src: 'x.kt:1' });

describe('candy text', () => {
  it('names potions with their level and length', () => {
    expect(effectText(fx(0.2, [{ type: 'HASTE', seconds: 30, level: 2 }]), false)).toBe('Haste II 30 s');
    expect(effectText(fx(0.2, [{ type: 'FIRE_RESISTANCE', seconds: 30, level: 1 }]), false)).toBe('Fire Resistance 30 s');
    expect(effectText(fx(0.1, [{ type: 'LEVITATION', seconds: 5, level: 1 }, { type: 'SLOW_FALLING', seconds: 15, level: 1 }]), false))
      .toBe('Levitation 5 s + Slow Falling 15 s');
  });

  it('falls back to the chat message when an effect is more than potions', () => {
    expect(effectText(fx(0.06, [], 'Up you go...'), false)).toBe('"Up you go..."');
    expect(effectText(fx(0.06, [{ type: 'SLOW_FALLING', seconds: 8, level: 1 }], 'Up you go...'), true)).toBe('"Up you go..."');
  });

  it('formats chances without float noise', () => {
    expect(chancePct(0.2)).toBe('20%');
    expect(chancePct(0.07)).toBe('7%');
    expect(chancePct(0.125)).toBe('12.5%');
  });

  it('nothing is what the orb and the effects leave over', () => {
    const candy = { soulOrbChance: 0.2 } as EventCandy;
    expect(nothingChance(candy, [fx(0.2, []), fx(0.15, [])])).toBeCloseTo(0.45);
    expect(nothingChance(candy, [fx(0.9, [])])).toBe(0);
  });
});

describe('candy data from the event code', () => {
  const candy = (eventData as unknown as EventData).candy;
  it.runIf(candy)('every candy reads at least 1 effect and leaves a valid chance of nothing', () => {
    for (const c of candy!.items) {
      expect(c.effects.length, c.name).toBeGreaterThan(0);
      const left = 1 - candy!.soulOrbChance - c.effects.reduce((a, e) => a + e.chance, 0);
      expect(left, c.name).toBeGreaterThanOrEqual(-1e-9);
      expect(c.name, c.name).not.toMatch(/[<>]/);
    }
  });
});
