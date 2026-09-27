import { describe, expect, it } from 'vitest';
import jobsData from '../data/jobs.json';
import type { JobsData } from '../data/types';
import { ingredientTier, materialOf, nextSteps, potionName, shortestChainTo, walkChain, WATER } from './brewing';

const alchemist = (jobsData as JobsData).jobs.find((j) => j.job === 'Alchemist')!;
const brewItems = alchemist.items.filter((i) => i.action === 'Brew');

describe('brewing chains (Luma mcMMO potions.yml)', () => {
  it('names potions readably', () => {
    expect(potionName(WATER)).toBe('Water Bottle');
    expect(potionName('POTION_OF_AWKWARD')).toBe('Awkward Potion');
    expect(potionName('SPLASH_POTION_OF_STRENGTH_II')).toBe('Splash Potion of Strength II');
    expect(potionName('LINGERING_POTION_OF_SWIFTNESS_EXTENDED')).toBe('Lingering Potion of Swiftness (long)');
  });

  it('walks a Strength II lingering chain and stops at the first ingredient that does not fit', () => {
    const good = walkChain(['NETHER_WART', 'BLAZE_POWDER', 'GLOWSTONE_DUST', 'GUNPOWDER', 'DRAGON_BREATH']);
    expect(good.invalidAt).toBeNull();
    expect(good.steps.map((s) => s.to)).toEqual([
      'POTION_OF_AWKWARD', 'POTION_OF_STRENGTH', 'POTION_OF_STRENGTH_II', 'SPLASH_POTION_OF_STRENGTH_II', 'LINGERING_POTION_OF_STRENGTH_II',
    ]);
    // Dragon's Breath needs a splash potion first.
    const bad = walkChain(['NETHER_WART', 'BLAZE_POWDER', 'DRAGON_BREATH', 'GUNPOWDER']);
    expect(bad.invalidAt).toBe(2);
    expect(bad.steps).toHaveLength(2);
  });

  it('finds the shortest chain that uses an ingredient', () => {
    expect(shortestChainTo('NETHER_WART')).toEqual(['NETHER_WART']);
    expect(shortestChainTo('BLAZE_POWDER')).toEqual(['BLAZE_POWDER']); // water + blaze = mundane
    expect(shortestChainTo('STONE')).toEqual(['NETHER_WART', 'STONE']);
    expect(shortestChainTo('DRAGON_BREATH')).toEqual(['GUNPOWDER', 'DRAGON_BREATH']);
    expect(shortestChainTo('RED_MUSHROOM')).toBeNull();
  });

  it('every paid Brew item except Red Mushroom is reachable, and every chain it builds is valid', () => {
    const unreachable = brewItems.filter((i) => !shortestChainTo(materialOf(i.item))).map((i) => i.item);
    expect(unreachable).toEqual(['Red Mushroom']); // Jobs pays for it, but no mcMMO recipe uses it
    for (const i of brewItems) {
      const chain = shortestChainTo(materialOf(i.item));
      if (chain) expect(walkChain(chain).invalidAt, i.item).toBeNull();
    }
  });

  it('only offers ingredients mcMMO accepts, with their Concoctions tier', () => {
    for (const s of nextSteps('POTION_OF_AWKWARD')) expect(ingredientTier(s.material), s.material).not.toBeNull();
    expect(ingredientTier('NETHER_WART')).toBe(1);
    expect(ingredientTier('GOLDEN_APPLE')).toBe(8);
    expect(ingredientTier('TALL_GRASS')).toBeNull();
  });
});
