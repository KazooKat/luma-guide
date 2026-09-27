// Brewing chains: a water bottle is brewed step by step (Nether Wart -> Awkward, Blaze Powder -> Strength, ...).
// Every step is one brew, and Jobs pays once per brew for the ingredient used (JobsPaymentListener.onBrewEvent).
// The recipe graph and ingredient tiers come from Luma's mcMMO potions.yml (see scripts/build_potions.py).
import potionsData from '../data/potions.json';

interface PotionNode {
  name: string;
  children: Record<string, string>;
}
interface PotionsData {
  source: string;
  start: string;
  tiers: Record<string, number>;
  potions: Record<string, PotionNode>;
}

const DATA = potionsData as PotionsData;
export const POTIONS_SOURCE = DATA.source;
export const WATER = DATA.start;

/** "Glistering Melon Slice" -> "GLISTERING_MELON_SLICE" (Jobs item names are the material in title case). */
export const materialOf = (itemName: string) => itemName.trim().toUpperCase().replace(/[\s-]+/g, '_');
/** "GLISTERING_MELON_SLICE" -> "Glistering Melon Slice" */
export const ingredientName = (material: string) =>
  material.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const potionName = (id: string) => DATA.potions[id]?.name ?? ingredientName(id);

/** Concoctions tier that unlocks an ingredient (1-8), or null if mcMMO never accepts it. */
export const ingredientTier = (material: string): number | null => DATA.tiers[material] ?? null;

/** Ingredients that can go into this potion, and what each one makes. */
export function nextSteps(potionId: string): { material: string; result: string }[] {
  const children = DATA.potions[potionId]?.children ?? {};
  return Object.entries(children).map(([material, result]) => ({ material, result }));
}

export interface ChainStep {
  material: string;
  /** Potion before and after this brew. */
  from: string;
  to: string;
}

/** Walks a chain from a water bottle. Stops at the first ingredient that doesn't fit, and says so. */
export function walkChain(materials: string[]): { steps: ChainStep[]; invalidAt: number | null } {
  const steps: ChainStep[] = [];
  let at = WATER;
  for (let i = 0; i < materials.length; i++) {
    const to = DATA.potions[at]?.children[materials[i]];
    if (!to) return { steps, invalidAt: i };
    steps.push({ material: materials[i], from: at, to });
    at = to;
  }
  return { steps, invalidAt: null };
}

/**
 * Fewest brews from a water bottle that end by brewing `material`, or null if no recipe uses it.
 * Ties go to the recipe listed first upstream (e.g. Blaze Powder straight into water makes Mundane,
 * so it's 1 step; Stone needs an Awkward Potion first, so it's Nether Wart -> Stone).
 */
export function shortestChainTo(material: string): string[] | null {
  const prev = new Map<string, { parent: string; material: string } | null>([[WATER, null]]);
  const queue = [WATER];
  const path = (id: string) => {
    const out: string[] = [];
    for (let p = prev.get(id); p; p = prev.get(p.parent)) out.unshift(p.material);
    return out;
  };
  while (queue.length) {
    const id = queue.shift()!;
    for (const step of nextSteps(id)) {
      if (step.material === material) return [...path(id), material];
      if (!prev.has(step.result)) {
        prev.set(step.result, { parent: id, material: step.material });
        queue.push(step.result);
      }
    }
  }
  return null;
}
