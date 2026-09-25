// Relic odds, derived from LumaLibre/LumaItems @ 19587d5 (RelicCreator, RelicDisassembler, GeneralListeners,
// GrubbyRelicItem, JobsListeners, AstralOrbItem, RelicsYml/AstralYml defaults). Config values are the plugin's
// defaults; the live server's relics.yml / astral.yml may differ.

export const LUMAITEMS_REF = '19587d5';

export type RarityId = 'astral' | 'lunar' | 'nova' | 'pulsar' | 'solar' | 'delta';

export interface Rarity {
  id: RarityId;
  name: string;
  color: string;
  /** Rarity.algorithmWeight — drives enchant count and level. */
  weight: number;
  /** Highest enchant level RelicCreator can roll (forcedMaxEnchantLevel, or weight when unset). */
  maxLevel: number;
  source: string;
  items: string;
  icon: string;
}

export const RARITIES: Rarity[] = [
  { id: 'astral', name: 'Astral', color: '#AC87FB', weight: 14, maxLevel: 14, icon: 'netherite_chestplate',
    source: 'Astral Orbs', items: 'Named Astral sets with fixed stats (not random rolls)' },
  { id: 'lunar', name: 'Lunar', color: '#6255fb', weight: 7, maxLevel: 7, icon: 'diamond_chestplate',
    source: 'Lunar Orbs, and rarely Grubby Relics', items: 'Diamond armor and tools (9 kinds)' },
  { id: 'nova', name: 'Nova', color: '#75c3fb', weight: 2, maxLevel: 2, icon: 'golden_sword',
    source: 'Bosses, and sometimes Grubby Relics', items: 'Copper, gold, chainmail or leather armor; copper, gold, iron or stone tools; bows (37 kinds)' },
  { id: 'pulsar', name: 'Pulsar', color: '#c773fb', weight: 1, maxLevel: 1, icon: 'iron_pickaxe',
    source: 'Hostile mobs, Grubby Relics', items: 'Copper, gold, chainmail or leather armor; copper to iron and wooden tools; bows (39 kinds)' },
  { id: 'solar', name: 'Solar', color: '#EEFB5F', weight: 1, maxLevel: 1, icon: 'chainmail_helmet',
    source: 'Hostile mobs, Grubby Relics', items: 'Chainmail or leather armor; stone or wooden tools; bows (18 kinds)' },
  { id: 'delta', name: 'Delta', color: '#DE509D', weight: 1, maxLevel: 1, icon: 'crossbow',
    source: 'Hostile mobs, Grubby Relics', items: 'Chainmail or leather armor; stone or wooden tools; spears, crossbows (22 kinds)' },
];

/** RelicCreator: numOfEnchants = nextInt(1 + min(w - 3, 1), w); the loop runs 0..numOfEnchants, so count = value + 1. */
export function enchantCountOdds(weight: number): Map<number, number> {
  const from = 1 + Math.min(weight - 3, 1);
  const out = new Map<number, number>();
  const n = weight - from;
  for (let v = from; v < weight; v++) {
    const count = Math.max(0, v + 1);
    out.set(count, (out.get(count) ?? 0) + 1 / n);
  }
  return out;
}

/** Enchant level rule: max >= 5 -> 25% in [5, max], else [3, 4]; otherwise uniform [1, max]. */
export function levelRule(maxLevel: number): string {
  if (maxLevel >= 5) return `Levels 3–4 (75%) or 5–${maxLevel} (25%)`;
  return maxLevel === 1 ? 'Always level I' : `Levels 1–${maxLevel}`;
}

/**
 * The plugin picks weighted rewards by rejection: take a random entry, keep it if its weight >= nextInt(101),
 * otherwise pick again. An entry with weight w is kept with probability (w + 1) / 101, so the final chance is
 * (w + 1) / sum(w + 1). (Weights above 100 are always kept.)
 */
export function rejectionOdds(weights: number[]): number[] {
  const keep = weights.map((w) => Math.min(w + 1, 101));
  const total = keep.reduce((a, b) => a + b, 0);
  return keep.map((k) => k / total);
}

export interface Reward {
  weight: number;
  label: string;
  /** Vanilla item icon; null for server-only rewards (tokens, points, crate boxes). */
  icon: string | null;
  note?: string;
}

/** relics.yml disassembler.commands (defaults). */
export const DISASSEMBLY_REWARDS: Reward[] = [
  { weight: 60, label: '16 Bottles o’ Enchanting', icon: 'experience_bottle' },
  { weight: 50, label: '4 Coal Blocks', icon: 'coal_block' },
  { weight: 48, label: '5 Iron Ingots', icon: 'iron_ingot' },
  { weight: 47, label: 'Repair Token I', icon: null },
  { weight: 45, label: 'Repair Token II', icon: null },
  { weight: 44, label: '4 Relic Shards', icon: 'amethyst_shard' },
  { weight: 43, label: '5 Gold Ingots', icon: 'gold_ingot' },
  { weight: 42, label: '3 Diamonds', icon: 'diamond' },
  { weight: 41, label: 'Common Box', icon: null, note: 'crate box' },
  { weight: 39, label: 'Repair Token III', icon: null },
  { weight: 38, label: '1 Netherite Scrap', icon: 'netherite_scrap' },
  { weight: 29, label: '5 Points', icon: null },
  { weight: 20, label: 'Rare Box', icon: null, note: 'crate box' },
  { weight: 5, label: 'Lunar Core', icon: 'prismarine_shard' },
];
/** Added only when the disassembled relic is Astral. */
export const ASTRAL_EXTRA_REWARD: Reward = { weight: 100, label: 'Astral Core', icon: 'prismarine_shard' };

export function disassemblyOdds(astral: boolean): { reward: Reward; chance: number }[] {
  const rewards = astral ? [...DISASSEMBLY_REWARDS, ASTRAL_EXTRA_REWARD] : DISASSEMBLY_REWARDS;
  const odds = rejectionOdds(rewards.map((r) => r.weight));
  return rewards.map((reward, i) => ({ reward, chance: odds[i] })).sort((a, b) => b.chance - a.chance);
}

/** astral.yml astral-orb-rarities (defaults). Magmatic is listed twice (35 and 0) — see magmaticNote. */
export const ASTRAL_ORB_SETS: { set: string; weight: number }[] = [
  { set: 'Valley', weight: 70 },
  { set: 'Venom', weight: 43 },
  { set: 'Meluka', weight: 42 },
  { set: 'Archael', weight: 38 },
  { set: 'Magmatic', weight: 35 },
  { set: 'Verdant', weight: 25 },
  { set: 'Reforged', weight: 20 },
  { set: 'Kazkan', weight: 11 },
  { set: 'Blitz', weight: 10 },
  { set: 'Harbinger', weight: 8 },
  { set: 'Falter', weight: 3 },
];

/**
 * The default map holds Magmatic twice (weights 35 and 0) as two separate keys, so in-code both count.
 * Returns each set's chance with both Magmatic entries merged into one row.
 */
export function astralOrbOdds(): { set: string; chance: number }[] {
  const weights = [...ASTRAL_ORB_SETS.map((s) => s.weight), 0]; // the extra Magmatic entry
  const odds = rejectionOdds(weights);
  const rows = ASTRAL_ORB_SETS.map((s, i) => ({ set: s.set, chance: odds[i] }));
  rows.find((r) => r.set === 'Magmatic')!.chance += odds[odds.length - 1];
  return rows.sort((a, b) => b.chance - a.chance);
}

/** Magmatic's chance if the server's config ends up with only its weight-0 entry. */
export function magmaticIfZero(): number {
  const weights = ASTRAL_ORB_SETS.map((s) => (s.set === 'Magmatic' ? 0 : s.weight));
  return rejectionOdds(weights)[ASTRAL_ORB_SETS.findIndex((s) => s.set === 'Magmatic')];
}

/** GrubbyRelicItem.GrubbyWeights — a normal cumulative-weight pick. */
export const GRUBBY_WEIGHTS: { rarity: RarityId; weight: number }[] = [
  { rarity: 'pulsar', weight: 200 },
  { rarity: 'solar', weight: 200 },
  { rarity: 'delta', weight: 200 },
  { rarity: 'nova', weight: 10 },
  { rarity: 'lunar', weight: 1 },
];
export const GRUBBY_TOTAL = GRUBBY_WEIGHTS.reduce((a, g) => a + g.weight, 0);

/** JobsListeners: nextInt(20_000) > 2 returns early, so 3 in 20,000 paid job actions (not Hunter). */
export const GRUBBY_PER_ACTION = 3 / 20_000;

/** GeneralListeners.onEntitySpawn: nextInt(101) > 8 returns early, so 9 in 101 hostile mobs spawn with a relic. */
export const MOB_RELIC_SPAWN = 9 / 101;

/**
 * Vanilla (not Luma code): equipment given to a mob drops 8.5% of the time, +1% per Looting level,
 * and only when a player got the kill. Nothing in LumaLibre's public code changes this for relics.
 */
export const VANILLA_EQUIP_DROP = 0.085;
export const LOOTING_PER_LEVEL = 0.01;
export const mobRelicPerKill = (looting: number) => MOB_RELIC_SPAWN * (VANILLA_EQUIP_DROP + LOOTING_PER_LEVEL * looting);
