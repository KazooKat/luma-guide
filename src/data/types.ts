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
}

export interface ItemsData {
  source: { repo: string; commit: string };
  sections: ItemSection[];
  items: GlossaryItem[];
}
