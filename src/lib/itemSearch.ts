import type { GlossaryItem, ItemSection } from '../data/types';
import { plain } from './minimessage';

export type SearchField = 'all' | 'name' | 'event' | 'effect' | 'enchant';

export interface ItemIndex {
  name: string;
  event: string;
  effect: string;
  enchant: string;
}

export const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").toLowerCase();

const isFooter = (line: string) => line.includes('⋆⁺₊⋆') || line.startsWith('Tier •');

/** Searchable text per field. Effect = the lore (tier footer left out); enchant = abilities + vanilla enchants. */
export function indexItem(item: GlossaryItem, section: ItemSection | undefined): ItemIndex {
  const lore = item.lore.map(plain).filter((l) => l && !isFooter(l));
  return {
    name: norm(plain(item.name)),
    event: norm([section?.name, item.setName, item.setName && `${item.setName} set`].filter(Boolean).join(' · ')),
    effect: norm(lore.join(' ')),
    enchant: norm([...item.abilities.map(plain), ...item.enchantList].join(' · ')),
  };
}

/** Every word of the query must appear in the chosen field (or anywhere, for 'all'). */
export function matches(idx: ItemIndex, query: string, field: SearchField): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = field === 'all' ? `${idx.name} ${idx.event} ${idx.effect} ${idx.enchant}` : idx[field];
  return words.every((w) => hay.includes(w));
}

/** NETHERITE_HELMET -> "Netherite Helmet" */
export function materialName(material: string): string {
  return material.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
