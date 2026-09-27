import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASTRAL_ORB_SETS } from '../lib/relics';
import { plain } from '../lib/minimessage';
import atlas from './items-atlas.json';
import data from './items.json';
import type { ItemsData } from './types';

const DATA = data as ItemsData;
const icon = (id: string) => new URL(`../../public/icons/${id}.png`, import.meta.url);

describe('items.json', () => {
  it('has unique ids that are safe in a URL', () => {
    const ids = DATA.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('puts every item in a known section, and every section has items', () => {
    const keys = new Set(DATA.sections.map((s) => s.key));
    for (const it of DATA.items) expect(keys.has(it.section), it.id).toBe(true);
    for (const s of DATA.sections) expect(DATA.items.some((i) => i.section === s.key), s.key).toBe(true);
  });

  it('gives every item a name, a tier footer and an icon that was copied into public/icons', () => {
    for (const it of DATA.items) {
      expect(plain(it.name).trim(), it.id).not.toBe('');
      expect(plain(it.lore[it.lore.length - 2]), it.id).toMatch(/^Tier • /);
      expect(existsSync(icon(it.icon)), `${it.id}: ${it.icon}.png`).toBe(true);
    }
  });

  it('has every item icon in the sprite sheet the Items grid draws from', () => {
    const inAtlas = atlas.icons as Record<string, number>;
    for (const it of DATA.items) expect(inAtlas[it.icon], `${it.id}: ${it.icon}`).toBeTypeOf('number');
    expect(Object.keys(inAtlas).length).toBeLessThanOrEqual(atlas.cols * atlas.rows);
  });

  it('leaves no MiniMessage tags unrendered in any tooltip line', () => {
    for (const it of DATA.items) {
      for (const line of [it.name, ...it.enchants, ...it.lore]) expect(plain(line), it.id).not.toMatch(/<\/?[#a-z!]/i);
    }
  });

  it('has a glossary set for every set in the Astral Orb odds (the Relics page links to them)', () => {
    const sets = new Set(DATA.items.map((i) => i.set).filter(Boolean));
    for (const { set } of ASTRAL_ORB_SETS) expect(sets.has(`${set.toLowerCase()}-set`), set).toBe(true);
  });

  it("keeps Kamori's Glasses at its old deep link, in Lumarine 2026", () => {
    const k = DATA.items.find((i) => i.id === 'kamoris-glasses');
    expect(k?.section).toBe('LUMARINE_2026');
  });
});
