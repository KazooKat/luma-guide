import { describe, expect, it } from 'vitest';
import { lex, evaluate, collectVals, Unresolved } from './kotlin-lite.mjs';
import { legacyToMini } from './legacy.mjs';
import { buildTooltip, enchantLine, TIER_FORMAT } from './tooltip.mjs';
import { enchantKey, gearType, tierColors } from './items-util.mjs';

const env = (vals = new Map()) => ({
  lookup(name) {
    const d = vals.get(name)?.[0];
    if (!d) throw new Unresolved(name);
    return evaluate(d.tokens, env(vals));
  },
  enumRef: (ns, m) => (ns === 'Material' ? { material: m } : ns === 'Enchantment' ? { ench: enchantKey(m) } : { ns, m }),
});

describe('kotlin-lite', () => {
  it('evaluates strings with templates, pairs and lists', () => {
    const src = 'val C = "#CDB4DB"\nval x = listOf("<$C>a", "${"b".astralColor()} c", Enchantment.UNBREAKING to 10)';
    const toks = lex(src);
    const vals = collectVals(toks);
    expect(evaluate(vals.get('x')[0].tokens, env(vals))).toEqual(['<#CDB4DB>a', '<#AC87FB>b</#AC87FB> c', { pair: [{ ench: 'unbreaking' }, 10] }]);
  });

  it('drops comments but keeps // inside strings', () => {
    const toks = lex('val u = "https://x.y" // note\n/* block /* nested */ */ val v = 1');
    const vals = collectVals(toks);
    expect(evaluate(vals.get('u')[0].tokens, env(vals))).toBe('https://x.y');
    expect(evaluate(vals.get('v')[0].tokens, env(vals))).toBe(1);
  });

  it('accepts named arguments and records single-expression helpers', () => {
    expect(evaluate(lex('hideEnchants = true'), env())).toBe(true);
    const vals = collectVals(lex('fun c(s: Any) = "<#DD9FC7>$s</#DD9FC7>"'));
    expect(vals.get('c')[0].params).toEqual(['s']);
  });

  it('refuses what it cannot know', () => {
    expect(() => evaluate(lex('colorType.title'), env())).toThrow(Unresolved);
    expect(() => evaluate(lex('String.format("%d", 5)'), env())).toThrow(Unresolved);
  });
});

describe('legacyToMini', () => {
  it('converts hex and named codes; a colour code resets bold', () => {
    expect(legacyToMini('&#AC87FB&lArchael &fWings')).toBe('<#AC87FB><b>Archael </b></#AC87FB><white>Wings</white>');
  });
  it('handles &r and escapes <', () => {
    expect(legacyToMini('&#EEE1D5&m  &r&#EEE1D5a<b')).toBe('<#EEE1D5><st>  </st></#EEE1D5><#EEE1D5>a\\<b</#EEE1D5>');
  });
});

describe('buildTooltip', () => {
  // Kamori's Glasses @ 19587d5 (items/armor/helmet/KamorisGlasses.kt)
  const kamori = {
    name: "<b><gradient:#D8F3DC:#B7E4C7:#95D5B2:#A9DEF9:#CDB4DB>Kamori's Glasses</gradient></b>",
    customEnchants: ['<#CDB4DB>Blessing'],
    lore: ['<#CDB4DB>While worn</#CDB4DB>, nearby', 'plants will passively', 'grow up to half of', 'their full stage.', '',
      'For <#CDB4DB>1 hour</#CDB4DB> each day,', 'plants grow all the', 'way up instead.'],
    taglines: [],
    vanillaEnchants: [['unbreaking', 10], ['protection', 6], ['mending', 1]],
    hideEnchants: false, spoofEnchants: false, addSpace: true,
    tier: '<b><gradient:#1e8abf:#9be4df:#f8898a:#EDB172:#ffe494>Lumarine 2026</gradient></b>',
    legacy: false,
  };

  it("matches ItemFactory's line order for Kamori's Glasses", () => {
    const t = buildTooltip(kamori);
    expect(t.name).toBe(kamori.name);
    expect(t.enchants).toEqual(['<gray>Protection VI', '<gray>Unbreaking X', '<gray>Mending']);
    expect(t.lore).toEqual([
      '<#CDB4DB>Blessing', '', ...kamori.lore,
      '', TIER_FORMAT[1], `<#EEE1D5>Tier •</#EEE1D5> ${kamori.tier}`, TIER_FORMAT[3],
    ]);
  });

  it('writes spoofed enchants as grey lore and hides the real ones', () => {
    const t = buildTooltip({ ...kamori, spoofEnchants: true, vanillaEnchants: [['luck_of_the_sea', 3], ['unbreaking', 12], ['mending', 1]] });
    expect(t.enchants).toEqual([]);
    expect(t.lore.slice(0, 3)).toEqual(['<gray>Luck Of The Sea III', '<gray>Unbreaking XII', '<gray>Mending']);
  });

  it('puts taglines between the custom enchants and lore', () => {
    const t = buildTooltip({ ...kamori, taglines: ['<#fff>"hi"'], lore: ['x'], tier: '' });
    expect(t.lore).toEqual(['<#CDB4DB>Blessing', '', '<#fff>"hi"', '', 'x']);
  });

  it('converts legacy-mode items, tier footer included', () => {
    const t = buildTooltip({ ...kamori, name: '&#AC87FB&lVerdant &fPickaxe', customEnchants: [], lore: [], vanillaEnchants: [], tier: '&#AC87FB&lAstral', legacy: true });
    expect(t.name).toBe('<#AC87FB><b>Verdant </b></#AC87FB><white>Pickaxe</white>');
    expect(t.lore[2]).toBe('<#EEE1D5>Tier • </#EEE1D5><#AC87FB><b>Astral</b></#AC87FB>');
  });
});

describe('vanilla enchant lines', () => {
  it('omits the numeral only for level-1 enchants whose max is 1', () => {
    expect(enchantLine('mending', 1)).toBe('<gray>Mending');
    expect(enchantLine('unbreaking', 1)).toBe('<gray>Unbreaking I');
  });
  it('shows the raw translation key above level X, like vanilla', () => {
    expect(enchantLine('unbreaking', 12)).toBe('<gray>Unbreaking enchantment.level.12');
  });
  it('colours curses red', () => {
    expect(enchantLine('binding_curse', 1)).toBe('<red>Curse of Binding');
  });
});

describe('helpers', () => {
  it('maps materials to ToolType names like the plugin', () => {
    expect(gearType('DIAMOND_PICKAXE')).toBe('Pickaxe');
    expect(gearType('NETHERITE_AXE')).toBe('Axe');
    expect(gearType('FISHING_ROD')).toBe('Fishing Rod');
    expect(gearType('BREEZE_ROD')).toBe('Magical');
    expect(gearType('STICK')).toBe('???');
  });
  it('maps legacy Bukkit enchant names', () => {
    expect(enchantKey('DURABILITY')).toBe('unbreaking');
    expect(() => enchantKey('NOPE')).toThrow();
  });
  it('reads tier gradient stops', () => {
    expect(tierColors('<b><gradient:#1e8abf:#9be4df>L</gradient></b>')).toEqual(['#1E8ABF', '#9BE4DF']);
  });
});
