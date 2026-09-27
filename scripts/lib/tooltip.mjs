// Rebuild an item's in-game tooltip from its builder values, following LumaItems ItemFactory.createItem()
// (@ 19587d5, ItemFactory.kt:161-190) and vanilla 26.2 enchantment display. Output is MiniMessage only:
// legacy-mode items (buildNoMiniMessage / the old Astral factory) are converted from `&` codes first.
import { ENCHANTS, CURSES, LEVELS } from './enchants.mjs';
import { legacyToMini } from './legacy.mjs';

const BY_KEY = new Map(ENCHANTS.map(([key, name, max], i) => [key, { name, max, order: i }]));

export const TIER_FORMAT = [
  '',
  '<#EEE1D5><st>       </st>⋆⁺₊⋆ ★ ⋆⁺₊⋆<st>       </st></#EEE1D5>',
  '<#EEE1D5>Tier •</#EEE1D5> %s',
  '<#EEE1D5><st>       </st>⋆⁺₊⋆ ★ ⋆⁺₊⋆<st>       </st></#EEE1D5>',
];
export const LEGACY_TIER_FORMAT = [
  '',
  '&#EEE1D5&m       &r&#EEE1D5⋆⁺₊⋆ ★ ⋆⁺₊⋆&m       ',
  '&#EEE1D5Tier • %s',
  '&#EEE1D5&m       &r&#EEE1D5⋆⁺₊⋆ ★ ⋆⁺₊⋆&m       ',
];

export function enchantInfo(key) {
  const e = BY_KEY.get(key);
  if (!e) throw new Error(`unknown enchantment ${key}`);
  return e;
}

/** Vanilla Enchantment.getFullname: name, then the level unless level 1 of a max-level-1 enchant. */
export function enchantLine(key, level) {
  const e = enchantInfo(key);
  const lvl = level === 1 && e.max === 1 ? '' : ` ${LEVELS[level - 1] ?? `enchantment.level.${level}`}`;
  return `<${CURSES.has(key) ? 'red' : 'gray'}>${e.name}${lvl}`;
}

function roman(n) {
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [w, s] of table) while (n >= w) { out += s; n -= w; }
  return out;
}

/** Util.formatEnchantKey: snake_case -> Title Case Words (so "Luck Of The Sea", unlike vanilla). */
function formatEnchantKey(key) {
  return key.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * item: { name, customEnchants[], lore[], taglines[], vanillaEnchants: [key, level][], hideEnchants, spoofEnchants,
 *         addSpace, tier (raw string, '' for none), legacy }
 * returns { name, enchants: string[], lore: string[] } as MiniMessage.
 */
export function buildTooltip(item) {
  const conv = item.legacy ? legacyToMini : (s) => s;
  const combined = [];
  let hide = item.hideEnchants;
  if (item.spoofEnchants) {
    for (const [key, level] of item.vanillaEnchants) combined.push(`<gray>${formatEnchantKey(key)}${level > 1 ? ` ${roman(level)}` : ''}`);
    hide = true;
  }
  combined.push(...item.customEnchants);
  if ((item.addSpace && item.lore.length) || item.taglines.length) combined.push('');
  if (item.taglines.length) combined.push(...item.taglines, '');
  combined.push(...item.lore);
  if (item.tier) combined.push(...(item.legacy ? LEGACY_TIER_FORMAT : TIER_FORMAT).map((l) => l.replace('%s', item.tier)));

  const enchants = hide
    ? []
    : [...item.vanillaEnchants]
        .sort((a, b) => enchantInfo(a[0]).order - enchantInfo(b[0]).order)
        .map(([key, level]) => enchantLine(key, level));
  return { name: conv(item.name), enchants, lore: combined.map(conv) };
}
