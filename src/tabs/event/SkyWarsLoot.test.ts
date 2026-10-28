import { describe, expect, it } from 'vitest';
import eventData from '../../data/event.json';
import type { EventData } from '../../data/types';
import { HIGHLIGHTS, itemName, lootPct, packageName, tierName } from './SkyWarsLoot';

const LOOT = (eventData as unknown as EventData).skywarsLoot;

describe('SkyWars loot labels', () => {
  it('names items, tiers and packages', () => {
    expect(itemName('diamond_chestplate')).toBe('Diamond Chestplate');
    expect(itemName('totem_of_undying')).toBe('Totem of Undying');
    expect(itemName('experience_bottle')).toBe("Bottle o' Enchanting");
    expect(itemName('tnt')).toBe('TNT');
    expect(tierName('copper_chest')).toBe('Copper');
    expect(tierName('oxidized_copper_chest')).toBe('Oxidized');
    expect(packageName({ key: 'bow', weight: 1, src: 'x:1', items: [{ material: 'bow', count: 1 }, { material: 'arrow', count: 16 }] })).toBe('Bow + Arrow ×16');
  });

  it('rounds chances without claiming certainty', () => {
    expect(lootPct(0)).toBe('0%');
    expect(lootPct(0.003)).toBe('<1%');
    expect(lootPct(0.118)).toBe('12%');
    expect(lootPct(0.997)).toBe('>99%');
    expect(lootPct(1)).toBe('100%');
  });

  it.runIf(LOOT)('every highlight material is in some loot table (catches typos that would show 0%)', () => {
    const all = new Set(LOOT!.pools.flatMap((p) => [...p.random, ...p.guaranteed.flatMap((c) => c.packages)]).flatMap((k) => k.items.map((i) => i.material)));
    for (const h of HIGHLIGHTS) for (const m of h.materials) expect(all.has(m), `${h.label}: ${m}`).toBe(true);
  });

  it.runIf(LOOT)('tiers run from plain copper to oxidized', () => {
    expect(LOOT!.pools.map((p) => tierName(p.chest))).toEqual(['Copper', 'Exposed', 'Weathered', 'Oxidized']);
  });
});
