import { describe, expect, it } from 'vitest';
import type { GlossaryItem, ItemSection } from '../data/types';
import { indexItem, matches, materialName } from './itemSearch';

const section: ItemSection = { key: 'LUMARINE_2026', kind: 'event', name: 'Lumarine 2026', mini: '', colors: [] };
const item: GlossaryItem = {
  id: 'kamoris-glasses', section: 'LUMARINE_2026', material: 'NETHERITE_HELMET', icon: 'netherite_helmet', glint: true,
  name: "<b><gradient:#D8F3DC:#CDB4DB>Kamori's Glasses</gradient></b>",
  enchants: ['<gray>Protection VI'],
  lore: ['<#CDB4DB>Blessing', '', '<#CDB4DB>While worn</#CDB4DB>, nearby', 'plants will passively', '', '<#EEE1D5><st>  </st>⋆⁺₊⋆ ★ ⋆⁺₊⋆</#EEE1D5>', '<#EEE1D5>Tier •</#EEE1D5> Lumarine 2026'],
  abilities: ['<#CDB4DB>Blessing'], enchantList: ['Protection VI', 'Unbreaking X', 'Mending'], enchantsHidden: false,
  source: '', cls: 'KamorisGlasses',
};
const idx = indexItem(item, section);

describe('item search', () => {
  it('matches every word, in any order, ignoring case and apostrophe style', () => {
    expect(matches(idx, 'glasses KAMORI’S', 'name')).toBe(true);
    expect(matches(idx, 'kamori boots', 'name')).toBe(false);
  });
  it('searches the event, the lore and the enchants separately', () => {
    expect(matches(idx, 'lumarine', 'event')).toBe(true);
    expect(matches(idx, 'lumarine', 'name')).toBe(false);
    expect(matches(idx, 'plants', 'effect')).toBe(true);
    expect(matches(idx, 'unbreaking', 'enchant')).toBe(true);
    expect(matches(idx, 'blessing', 'enchant')).toBe(true);
  });
  it('leaves the tier footer out of the effect text', () => {
    expect(idx.effect).not.toContain('tier');
  });
  it('searches everything with "all" and treats an empty query as a match', () => {
    expect(matches(idx, 'mending plants', 'all')).toBe(true);
    expect(matches(idx, '   ', 'effect')).toBe(true);
  });
  it('names materials readably', () => {
    expect(materialName('NETHERITE_HELMET')).toBe('Netherite Helmet');
  });
});
