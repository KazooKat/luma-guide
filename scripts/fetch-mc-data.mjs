// Fetch the vanilla Minecraft 26.2 facts the Astral upgrade tables need, from misode/mcmeta, into
// scripts/lib/mc-26.2.json (committed, so builds don't need the network):
//   items:    default attribute modifiers + durability for every item an Astral piece can be or become
//   supports: for each enchantment, which of those items it can go on (Enchantment.canEnchantItem uses the
//             enchantment's supported_items, tags resolved recursively)
// Run: node scripts/fetch-mc-data.mjs
import { writeFileSync } from 'node:fs';

const VERSION = '26.2';
const RAW = 'https://raw.githubusercontent.com/misode/mcmeta';
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const GEAR = ['helmet', 'chestplate', 'leggings', 'boots', 'sword', 'pickaxe', 'axe', 'shovel', 'hoe'];
const MATERIALS = ['netherite', 'diamond', 'iron', 'golden', 'copper']; // AstralMaterial
const EXTRA = ['elytra', 'fishing_rod', 'shield', 'crossbow', 'blaze_rod', 'bow', 'trident', 'mace'];
const ITEMS = [...MATERIALS.flatMap((m) => GEAR.map((g) => `${m}_${g}`)), ...EXTRA];

const components = await get(`${RAW}/${VERSION}-summary/item_components/data.min.json`);
const items = {};
for (const id of ITEMS) {
  const c = components[id] ?? components[`minecraft:${id}`];
  if (!c) throw new Error(`no item components for ${id}`);
  const attrs = {};
  for (const m of c['minecraft:attribute_modifiers'] ?? []) {
    if (m.operation !== 'add_value') throw new Error(`${id}: unexpected operation ${m.operation}`);
    attrs[m.type.replace('minecraft:', '')] = m.amount;
  }
  items[id] = { attributes: attrs, durability: c['minecraft:max_damage'] ?? null };
}

const tagCache = new Map();
async function resolveTag(tag) {
  if (tagCache.has(tag)) return tagCache.get(tag);
  const data = await get(`${RAW}/${VERSION}-data-json/data/minecraft/tags/item/${tag}.json`);
  const out = new Set();
  for (const v of data.values) {
    const ref = typeof v === 'string' ? v : v.id;
    if (ref.startsWith('#')) for (const x of await resolveTag(ref.slice(11))) out.add(x);
    else out.add(ref.replace('minecraft:', ''));
  }
  tagCache.set(tag, out);
  return out;
}

const order = (await get(`${RAW}/${VERSION}-data-json/data/minecraft/tags/enchantment/tooltip_order.json`)).values;
const supports = {};
for (const e of order.map((v) => v.replace('minecraft:', ''))) {
  const def = await get(`${RAW}/${VERSION}-data-json/data/minecraft/enchantment/${e}.json`);
  const s = def.supported_items;
  const set = typeof s === 'string' && s.startsWith('#') ? await resolveTag(s.slice(11))
    : new Set((Array.isArray(s) ? s : [s]).map((x) => x.replace('minecraft:', '')));
  supports[e] = ITEMS.filter((i) => set.has(i));
}

writeFileSync(new URL('./lib/mc-26.2.json', import.meta.url), JSON.stringify({ version: VERSION, items, supports }, null, 1) + '\n');
console.log(`wrote ${Object.keys(items).length} items, ${Object.keys(supports).length} enchantments`);
