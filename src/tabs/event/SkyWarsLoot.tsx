import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { chanceOfAny, chanceOfPackage, shareOf, type LootPackage, type LootPool } from '../../lib/loot';

const NAMES: Record<string, string> = {
  experience_bottle: "Bottle o' Enchanting",
  cooked_beef: 'Steak',
  totem_of_undying: 'Totem of Undying',
  tnt: 'TNT',
};
const SMALL = new Set(['of', 'and', 'o']);
/** Guaranteed category keys in SkyWarsLoot.java, as a phrase after "Always 1". */
const CATEGORY: Record<string, string> = { blocks: 'stack of blocks', weapon: 'weapon', gear: 'piece of gear' };

/** "diamond_chestplate" -> "Diamond Chestplate" */
export const itemName = (material: string) =>
  NAMES[material] ?? material.split('_').map((w, i) => (i && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');

/** "exposed_copper_chest" -> "Exposed", "copper_chest" -> "Copper" */
export const tierName = (chest: string) => itemName(chest.replace(/_?copper_chest$/, '') || 'copper');

/** 0.118 -> "12%", 0.003 -> "<1%", 0 -> "0%" */
export function lootPct(p: number): string {
  if (p <= 0) return '0%';
  if (p < 0.005) return '<1%';
  if (p > 0.995 && p < 1) return '>99%';
  return `${Math.round(p * 100)}%`;
}

/** "Bow + Arrow ×16" */
export const packageName = (p: LootPackage) => p.items.map((i) => `${itemName(i.material)}${i.count > 1 ? ` ×${i.count}` : ''}`).join(' + ');

/** What players look for in a chest, compared across tiers. Each row is "at least 1 of these in the chest". */
export const HIGHLIGHTS: { label: string; materials: string[] }[] = [
  { label: 'Iron sword or better', materials: ['iron_sword', 'diamond_sword', 'netherite_sword'] },
  { label: 'Diamond sword or better', materials: ['diamond_sword', 'netherite_sword'] },
  { label: 'Iron armor', materials: ['iron_chestplate', 'iron_leggings', 'iron_boots'] },
  { label: 'Diamond armor', materials: ['diamond_chestplate', 'diamond_leggings', 'diamond_boots'] },
  { label: 'Netherite gear', materials: ['netherite_sword', 'netherite_chestplate', 'netherite_leggings', 'netherite_boots'] },
  { label: 'Bow or crossbow', materials: ['bow', 'crossbow'] },
  { label: 'Golden apple', materials: ['golden_apple', 'enchanted_golden_apple'] },
  { label: 'Ender pearl', materials: ['ender_pearl'] },
  { label: 'Lava bucket', materials: ['lava_bucket'] },
  { label: 'TNT', materials: ['tnt'] },
  { label: 'Mace, totem or enchanted apple', materials: ['mace', 'totem_of_undying', 'enchanted_golden_apple'] },
];

const heat = (p: number) => ({ background: `color-mix(in srgb, var(--chart) ${Math.round(p * 65)}%, transparent)` });

function PackageIcons({ p }: { p: LootPackage }) {
  return <span class="loot-icons">{p.items.map((i) => <Icon key={i.material} id={i.material} size={24} />)}</span>;
}

/** The SkyWars "Chest loot" block: a tier comparison, then one tier's full table. `cite` is the page's citation mark. */
export function SkyWarsLoot({ pools, cite }: { pools: LootPool[]; cite: JSX.Element }) {
  const [tier, setTier] = useState(0);
  const rows = HIGHLIGHTS.map((h) => ({ ...h, odds: pools.map((p) => chanceOfAny(p, h.materials)) })).filter((r) => r.odds.some((o) => o > 0));
  const pool = pools[tier];
  const random = [...pool.random].sort((a, b) => chanceOfPackage(pool, b) - chanceOfPackage(pool, a));
  return (
    <div class="wu-block loot">
      <h3>Chest loot{cite}</h3>
      <p class="explain-line">
        The more oxidized the chest, the better the loot. A chest gets 1 pick from each "always" group, then a few random picks, and the same thing can come up twice.
        These are the plugin's default tables, so a map can change them.
      </p>

      <div class="loot-compare" role="table" aria-label="Chance a chest has each kind of loot, by chest tier">
        <div class="loot-row head" role="row">
          <span role="columnheader">Chance a chest has</span>
          {pools.map((p) => (
            <span role="columnheader" class="loot-tier-head" key={p.chest}><Icon id={p.chest} size={28} /><span>{tierName(p.chest)}</span></span>
          ))}
        </div>
        {rows.map((r) => (
          <div class="loot-row" role="row" key={r.label}>
            <span role="rowheader" class="loot-label"><Icon id={r.materials[0]} size={24} /><span>{r.label}</span></span>
            {r.odds.map((o, i) => <span role="cell" class="loot-cell" style={heat(o)} key={i}>{lootPct(o)}</span>)}
          </div>
        ))}
      </div>

      <div class="chips loot-tabs" role="group" aria-label="Chest tier">
        {pools.map((p, i) => (
          <button type="button" class="chip toggle" aria-pressed={i === tier} onClick={() => setTier(i)} key={p.chest}>
            <Icon id={p.chest} size={24} /> {tierName(p.chest)}
          </button>
        ))}
      </div>

      <div class="loot-detail">
        {pool.guaranteed.map((c) => (
          <div class="loot-group" key={c.name}>
            <h4>Always 1 {CATEGORY[c.name] ?? itemName(c.name).toLowerCase()}, one of</h4>
            <ul class="loot-always">
              {[...c.packages].sort((a, b) => b.weight - a.weight).map((p) => (
                <li key={p.key}><PackageIcons p={p} /><span>{packageName(p)}</span><b>{lootPct(shareOf(c.packages, p))}</b></li>
              ))}
            </ul>
          </div>
        ))}
        <div class="loot-group">
          <h4>{pool.guaranteed.length ? 'Plus' : 'Only'} {pool.minRolls} to {pool.maxRolls} random picks from</h4>
          <div class="odds-table" role="table" aria-label={`${tierName(pool.chest)} chest random picks`}>
            <div class="odds-row loot-random head" role="row">
              <span role="columnheader">Item</span><span role="columnheader">Chance a chest has it</span><span role="columnheader" class="r">Chests</span>
            </div>
            {random.map((p) => {
              const c = chanceOfPackage(pool, p);
              return (
                <div class="odds-row loot-random" role="row" key={p.key}>
                  <span role="cell" class="loot-label"><PackageIcons p={p} /><span>{packageName(p)}</span></span>
                  <span role="cell"><span class="odds-bar"><i style={{ width: `${c * 100}%` }} /></span></span>
                  <span role="cell" class="r">{lootPct(c)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
