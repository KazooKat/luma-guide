import { McLine } from '../../components/McTooltip';
import data from '../../data/items.json';
import type { ItemsData, ItemSection } from '../../data/types';

export const DATA = data as ItemsData;
export const SECTIONS = new Map(DATA.sections.map((s) => [s.key, s]));
export const ITEMS = DATA.items;
export const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

/** CSS gradient through a section's tier colours (the Astral and collectible tiers are one colour). */
export function sectionGradient(s: ItemSection) {
  const c = s.colors.length > 1 ? s.colors : [s.colors[0], s.colors[0]];
  return `linear-gradient(90deg, ${c.join(', ')})`;
}

/** The tier name drawn the way the game draws it, on a dark chip so it reads in both themes. */
export function TierChip({ section }: { section: ItemSection }) {
  return <span class="tier-chip mc"><McLine mini={section.mini} /></span>;
}
