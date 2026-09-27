import { ENCHANTS } from './enchants.mjs';

const KEYS = new Set(ENCHANTS.map(([k]) => k));
// Bukkit's pre-1.20.5 field names, still accepted as aliases.
const BUKKIT_ALIASES = {
  PROTECTION_ENVIRONMENTAL: 'protection', PROTECTION_FIRE: 'fire_protection', PROTECTION_FALL: 'feather_falling',
  PROTECTION_EXPLOSIONS: 'blast_protection', PROTECTION_PROJECTILE: 'projectile_protection', OXYGEN: 'respiration',
  WATER_WORKER: 'aqua_affinity', DAMAGE_ALL: 'sharpness', DAMAGE_UNDEAD: 'smite', DAMAGE_ARTHROPODS: 'bane_of_arthropods',
  LOOT_BONUS_MOBS: 'looting', SWEEPING_EDGE: 'sweeping_edge', DIG_SPEED: 'efficiency', DURABILITY: 'unbreaking',
  LOOT_BONUS_BLOCKS: 'fortune', ARROW_DAMAGE: 'power', ARROW_KNOCKBACK: 'punch', ARROW_FIRE: 'flame',
  ARROW_INFINITE: 'infinity', LUCK: 'luck_of_the_sea',
};

/** Bukkit `Enchantment.X` field -> vanilla key. */
export function enchantKey(field) {
  const key = BUKKIT_ALIASES[field] ?? field.toLowerCase();
  if (!KEYS.has(key)) throw new Error(`unknown Enchantment.${field}`);
  return key;
}

// dev.lumas.lumaitems.enums.ToolType: first entry whose name the material contains, in declaration order.
const TOOL_TYPES = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'SWORD', 'SPEAR', 'PICKAXE', 'AXE', 'SHOVEL', 'HOE', 'CROSSBOW', 'BOW',
  'TRIDENT', 'SHIELD', 'ELYTRA', 'FISHING_ROD', 'MAGICAL', 'MACE', 'SHEARS'];

/** ToolType.getToolType(material)?.formatEnumerator() ?: "???" */
export function gearType(material) {
  const m = material.toUpperCase();
  const type = ['BLAZE_ROD', 'BREEZE_ROD'].includes(m) ? 'MAGICAL' : TOOL_TYPES.find((t) => m.includes(t));
  if (!type) return '???';
  return type.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Plain text of a tier's MiniMessage, e.g. "Lumarine 2026". */
export function eventName(mini) {
  return mini.replace(/<[^>]*>/g, '').trim();
}

/** Every hex colour in a tier string, in order, de-duplicated when repeated back to back. */
export function tierColors(mini) {
  const out = [];
  for (const m of mini.matchAll(/#[0-9a-fA-F]{6}/g)) {
    const c = m[0].toUpperCase();
    if (out[out.length - 1] !== c) out.push(c);
  }
  return out;
}
