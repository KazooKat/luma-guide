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

/** One cited minigame guide (data/event/minigames/*.json), written from the luma-events source. */
export interface MinigameGuide {
  key: string;
  constant: string;
  name: string;
  summary: string;
  /** One short line for the token table, e.g. "3 + 1 per 2 plays, +2 for a win, max 15". */
  tokenLine?: string;
  howToPlay?: WriteupLine[];
  scoring?: WriteupLine[];
  tokens?: WriteupLine[];
  numbers?: WriteupLine[];
  tips?: WriteupLine[];
  quirks?: WriteupLine[];
  config?: WriteupLine[];
  storyboard?: Storyboard;
}

/** One captioned step of a minigame's animation. */
export interface StoryBeat {
  caption: string;
  sub: string;
  src: string;
}

/** The 3-beat animation on a minigame page (what you do, what happens, how it pays). */
export interface Storyboard {
  /** The numbers the scene animates with, so the scene never hard-codes a rule. */
  values: Record<string, number>;
  beats: [StoryBeat, StoryBeat, StoryBeat];
}

export interface EventMinigame {
  key: string;
  constant: string;
  /** The name the plugin shows in chat. */
  name: string;
  aliases: string[];
  src: string;
  formula: { cls: string; args: string; src: string; file: string };
  guide: MinigameGuide | null;
}

export interface ShopItem {
  name: string;
  cost: number;
  /** Glossary id, when the item is in the item list. */
  itemId?: string;
  limit?: number | null;
  note?: string;
}

/** src/data/event.json, built by scripts/build-event.mjs. Every *src is a path:line in luma-events at `commit`. */
export interface EventData {
  commit: string;
  meta: {
    live: boolean;
    name: string;
    nameConfirmed: boolean;
    /** The event the pinned luma-events code was written for. */
    sourceEvent: string;
    dates: { start: string | null; end: string | null };
    token: { name: string | null; itemId: string | null };
    charmItemId: string | null;
    activeGames: string[];
    shop: { readOn: string | null; where: string | null; items: ShopItem[] };
    notes: WriteupLine[];
  };
  tokens: {
    types: { name: string; key: string; src: string }[];
    multiplier: { default: number; src: string; roundingSrc: string };
    cap: { value: number; src: string; messageSrc: string };
  };
  jobs: {
    bound: number; boundSrc: string; rollSrc: string;
    treeFellerFactor: number; treeFellerSrc: string; tntSrc: string;
    tokensPerDrop: number; tokensPerDropSrc: string;
    onByDefault: boolean; onSrc: string;
    list: { job: string; chance: number; src: string }[];
  };
  townInvite: {
    minPlaytimeMinutes: number; maxPlaytimeHours: number; cooldownMinutes: number;
    rewardMin: number; rewardMax: number; onByDefault: boolean; onSrc: string; src: string;
  };
  schedule: {
    autoByDefault: boolean; autoSrc: string;
    cooldownMinutes: number; cooldownSrc: string;
    countdownSeconds: number; countdownSrc: string;
    rotationSrc: string; defaultRotation: string[]; defaultRotationSrc: string;
  };
  commands: { root: string; aliases: string[]; src: string; player: { name: string; usage: string; src: string }[] };
  charm: { itemId: string; src: string; requirementSrc: string };
  minigames: EventMinigame[];
}
