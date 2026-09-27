// Astral set upgrades, following LumaItems @ 19587d5:
//   configuration/files/AstralYml.kt   astral-upgrades defaults (tier -> material + enchants, optional ToolType list)
//   items/astral/upgrades/AstralSetUpgradeFactory.kt   what an upgrade does to one piece
// Each /upgrade use costs one Astral Upgrade Core (guis/AstralUpgradeGui.kt).
import { readFileSync } from 'node:fs';
import { enchantKey } from './items-util.mjs';
import { enchantInfo, enchantLine } from './tooltip.mjs';

const MC = JSON.parse(readFileSync(new URL('./mc-26.2.json', import.meta.url), 'utf8'));

// ToolType enum order matters: getToolType returns the first name the material contains.
const TOOL_TYPES = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'SWORD', 'SPEAR', 'PICKAXE', 'AXE', 'SHOVEL', 'HOE', 'CROSSBOW', 'BOW',
  'TRIDENT', 'SHIELD', 'ELYTRA', 'FISHING_ROD', 'MAGICAL', 'MACE', 'SHEARS'];
export const toolType = (material) =>
  ['BLAZE_ROD', 'BREEZE_ROD'].includes(material) ? 'MAGICAL' : TOOL_TYPES.find((t) => material.includes(t)) ?? null;
// AstralSetUpgradeFactory.MODIFIABLE_MATERIALS: only these swap material on upgrade.
const MODIFIABLE = new Set(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'SWORD', 'PICKAXE', 'AXE', 'SHOVEL', 'HOE']);

/** Parse the `astral-upgrades` defaults: { setId: [{ tier, material, enchants: [{ key, level, apply }], line }] } */
export function parseUpgrades(src) {
  const lines = src.split('\n');
  const out = {};
  let set = null;
  let tier = null;
  lines.forEach((text, i) => {
    let m;
    if ((m = /buildTiers\("([\w-]+)"\)/.exec(text))) { set = m[1]; out[set] = []; tier = null; }
    else if (set && (m = /\btier\((\d+)\)/.exec(text))) { tier = { tier: Number(m[1]), material: null, enchants: [], line: i + 1 }; out[set].push(tier); }
    else if (tier && (m = /material\(AstralMaterial\.(\w+)\)/.exec(text))) tier.material = m[1];
    else if (tier && (m = /PairedEnchantment\(Enchantment\.(\w+),\s*(\d+)((?:,\s*ToolType\.\w+)*)\)/.exec(text))) {
      tier.enchants.push({ key: enchantKey(m[1]), level: Number(m[2]), apply: [...m[3].matchAll(/ToolType\.(\w+)/g)].map((x) => x[1]) });
    }
  });
  for (const [s, tiers] of Object.entries(out)) {
    if (!tiers.length) throw new Error(`astral-upgrades: ${s} has no tiers`);
    for (const t of tiers) if (!t.material || !t.enchants.length) throw new Error(`astral-upgrades: ${s} tier ${t.tier} incomplete`);
  }
  return out;
}

const canEnchant = (key, material) => (MC.supports[key] ?? []).includes(material.toLowerCase());

/** Vanilla stats of a material, as the game shows them (player base: 1 attack damage, 4 attack speed). */
export function stats(material) {
  const it = MC.items[material.toLowerCase()];
  if (!it) return null;
  const a = it.attributes;
  const round = (n) => Math.round(n * 100) / 100;
  const s = {};
  if (a.armor !== undefined) s.armor = a.armor;
  if (a.armor_toughness) s.toughness = a.armor_toughness;
  if (a.knockback_resistance) s.knockbackResistance = round(a.knockback_resistance * 10);
  if (a.attack_damage !== undefined) s.attackDamage = round(1 + a.attack_damage);
  if (a.attack_speed !== undefined) s.attackSpeed = round(4 + a.attack_speed);
  if (it.durability) s.durability = it.durability;
  return s;
}

/**
 * One piece through every tier. Tier 1 is the piece as it drops. Each later tier applies
 * AstralSetUpgradeFactory.upgradeAstralItem to the result of the previous one.
 */
export function upgradePath(piece, tiers) {
  const type = toolType(piece.material);
  let material = piece.material;
  const enchants = new Map(piece.enchants);
  const snapshot = (tier, changed) => ({
    tier,
    material,
    enchants: [...enchants].sort((a, b) => enchantInfo(a[0]).order - enchantInfo(b[0]).order).map(([k, l]) => enchantLine(k, l).replace(/^<\w+>/, '')),
    changed,
    stats: stats(material),
  });
  const path = [snapshot(1, [])];
  for (const t of [...tiers].sort((a, b) => a.tier - b.tier)) {
    const changed = [];
    if (MODIFIABLE.has(type)) {
      const next = `${t.material}_${material.split('_')[1]}`;
      if (next !== material) changed.push(`${material.toLowerCase()} → ${next.toLowerCase()}`);
      material = next;
    }
    for (const e of t.enchants) {
      // `apply` is checked against the original gear type; otherwise any enchant the (new) item accepts is added.
      const ok = (e.apply.length && e.apply.includes(type)) || canEnchant(e.key, material);
      if (!ok) continue;
      const before = enchants.get(e.key);
      if (before !== e.level) changed.push(`${enchantInfo(e.key).name} ${before ?? 0} → ${e.level}`);
      enchants.set(e.key, e.level);
    }
    path.push(snapshot(t.tier, changed));
  }
  return path;
}
