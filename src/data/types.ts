export interface JobItem {
  action: string;
  item: string;
  category: string;
  /** Level-1 base values; project with xpAt / moneyAt. */
  moneyBase: number;
  xpBase: number;
  /** The reading the base was derived from. */
  observed: { level: number; money: number; xp: number };
  icon: string | null;
  /** The server lists this item more than once in the same action with different pay. */
  dupe: boolean;
}

export interface Job {
  job: string;
  icon: string;
  defaultRate: number;
  rateNote: string;
  defaultItem?: string;
  confidence: 'confirmed' | 'assumed';
  level: number | null;
  source: string | null;
  items: JobItem[];
}

export interface JobsData {
  mcVersion: string;
  jobs: Job[];
}

export interface Perk {
  level: number;
  kind: 'unlock' | 'reward';
  text: string;
}

/** One glossary section: an event tier, the Astral sets, or collectibles. */
export interface ItemSection {
  key: string;
  kind: 'event' | 'astral' | 'collectible';
  name: string;
  /** The tier as the plugin writes it (MiniMessage), e.g. Lumarine 2026's gradient. */
  mini: string;
  colors: string[];
}

/** A LumaItems custom item (src/data/items.json, from scripts/build-items.mjs). Text fields are MiniMessage. */
export interface GlossaryItem {
  id: string;
  section: string;
  set?: string;
  setName?: string;
  material: string;
  icon: string;
  glint: boolean;
  name: string;
  /** Vanilla enchant lines the tooltip shows under the name (empty when hidden or spoofed). */
  enchants: string[];
  /** Every lore line in order, tier footer included. */
  lore: string[];
  abilities: string[];
  /** Every vanilla enchant, readable, including hidden ones. */
  enchantList: string[];
  enchantsHidden: boolean;
  source: string;
  cls: string | null;
  /** Set when the item varies in game (colour variants, stages); the tooltip shows one of them. */
  note?: string;
  /** Astral pieces: the piece at every upgrade tier, and the config lines the tiers come from. */
  upgrades?: { path: UpgradeStep[]; source: string };
}

export interface ItemsData {
  source: { repo: string; commit: string };
  sections: ItemSection[];
  items: GlossaryItem[];
}

/** One Astral piece at one upgrade tier (tier 1 = as it drops). */
export interface UpgradeStep {
  tier: number;
  material: string;
  enchants: string[];
  /** What this tier changed, e.g. "diamond_sword → netherite_sword", "Mending 0 → 1". */
  changed: string[];
  stats: { armor?: number; toughness?: number; knockbackResistance?: number; attackDamage?: number; attackSpeed?: number; durability?: number } | null;
}

/** A cited line of a mechanics write-up. `src` is "items/x/File.kt:12" or ":12-30", comma-separated. */
export interface WriteupLine {
  text?: string;
  label?: string;
  value?: string;
  src: string;
}

/** Hand-checked mechanics for one item or a family of items (data/writeups/*.json, merged by scripts/check-writeups.mjs). */
export interface Writeup {
  key: string;
  items: string[];
  summary: string;
  use?: WriteupLine[];
  numbers?: WriteupLine[];
  details?: WriteupLine[];
  quirks?: WriteupLine[];
  config?: WriteupLine[];
}

export interface WriteupsData {
  commit: string;
  writeups: Record<string, Writeup>;
  byItem: Record<string, string>;
}
