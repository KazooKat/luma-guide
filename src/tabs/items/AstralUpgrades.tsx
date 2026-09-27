import type { GlossaryItem, UpgradeStep, WriteupLine } from '../../data/types';
import { materialName } from '../../lib/itemSearch';
import { sourceLinks } from './Writeup';

// How an upgrade works, from LumaItems @ the pinned commit (commands/UpgradeCommand.kt, guis/AstralUpgradeGui.kt,
// events/GeneralListeners.kt, items/astral/upgrades/AstralSetUpgradeFactory.kt).
const STEPS: WriteupLine[] = [
  { text: 'Type /upgrade to open the Astral Upgrades menu.', src: 'commands/UpgradeCommand.kt:13-15' },
  { text: 'Put the Astral piece in the left slot and an Astral Upgrade Core in the middle slot, then click Confirm.', src: 'guis/AstralUpgradeGui.kt:22, guis/AstralUpgradeGui.kt:36-39' },
  { text: 'One core is used per upgrade and the piece moves to the right slot, one tier higher.', src: 'guis/AstralUpgradeGui.kt:42-45' },
  { text: 'At the last tier the footer changes to "Tier • Astral+".', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:23, items/astral/upgrades/AstralSetUpgradeFactory.kt:57' },
];

const WARNINGS: WriteupLine[] = [
  { text: 'Take the upgraded piece out of the right slot before upgrading another one. The next upgrade is written into that slot and replaces whatever is there.', src: 'guis/AstralUpgradeGui.kt:44' },
  { text: 'Once both slots are filled, any click while the menu is open does the upgrade, even a click in your own inventory, not only Confirm.', src: 'events/GeneralListeners.kt:143-146, guis/AstralUpgradeGui.kt:27-45' },
  { text: 'Anything left in the three slots is given back when you close the menu.', src: 'guis/AstralUpgradeGui.kt:53-56' },
  { text: 'A tier only adds an enchantment the piece could normally carry, or one the tier names for that piece type. So some listed enchants never land (elytra can\'t take Protection, for example). A tier\'s level replaces the old one.', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:85-91' },
  { text: 'Only armor, swords and tools change material. Elytra, shields, crossbows, fishing rods and blaze rods keep theirs and only gain enchants.', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:67-81' },
];

function statText(s: UpgradeStep['stats']) {
  if (!s) return '—';
  const parts: string[] = [];
  if (s.armor !== undefined) parts.push(`${s.armor} armor`);
  if (s.toughness) parts.push(`${s.toughness} toughness`);
  if (s.knockbackResistance) parts.push(`${s.knockbackResistance} knockback res.`);
  if (s.attackDamage !== undefined) parts.push(`${s.attackDamage} attack damage`);
  if (s.attackSpeed !== undefined) parts.push(`${s.attackSpeed} attack speed`);
  if (s.durability) parts.push(`${s.durability} durability`);
  return parts.join(' · ');
}

function Cited({ lines, commit }: { lines: WriteupLine[]; commit: string }) {
  return (
    <ul class="facts plain">
      {lines.map((l) => (
        <li key={l.text}>
          {l.text}{' '}
          <span class="src-links">
            {sourceLinks(l.src, commit).map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${s.label}`} title={`Source: ${s.label}`}>source</a>)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tier-by-tier stats for one Astral piece, plus how upgrading works. */
export function AstralUpgrades({ item, commit }: { item: GlossaryItem; commit: string }) {
  const path = item.upgrades!.path;
  const max = path[path.length - 1].tier;
  return (
    <div class="upgrades">
      <div class="card-title">
        <h3>Upgrading</h3>
        <span>{max - 1} upgrade{max - 1 === 1 ? '' : 's'} · {max - 1} Astral Upgrade Core{max - 1 === 1 ? '' : 's'} to reach tier {max}</span>
      </div>
      <div class="upgrade-table" role="table" aria-label={`Upgrade tiers for this piece`}>
        <div class="upgrade-row head" role="row">
          <span role="columnheader">Tier</span><span role="columnheader">Item and stats</span>
          <span role="columnheader">Enchantments</span><span role="columnheader">What changes</span>
        </div>
        {path.map((t) => (
          <div class="upgrade-row" role="row" key={t.tier}>
            <span role="cell" class="tier-num">{t.tier}{t.tier === max && max > 1 ? '+' : ''}</span>
            <span role="cell"><b>{materialName(t.material)}</b><small>{statText(t.stats)}</small></span>
            <span role="cell" class="small">{t.enchants.join(', ') || '—'}</span>
            <span role="cell" class="small muted">
              {t.tier === 1 ? 'As it drops' : t.changed.length ? t.changed.map((c) => c.replace(/_/g, ' ')).join('; ') : 'Nothing for this piece'}
            </span>
          </div>
        ))}
      </div>
      <div class="pair">
        <div class="writeup-block">
          <h3>How to upgrade</h3>
          <Cited lines={STEPS} commit={commit} />
          <p class="note">Astral Upgrade Cores: see <a href="#/relics">Relics</a> for how to get them.</p>
        </div>
        <div class="writeup-block callout warn">
          <h3>Good to know</h3>
          <Cited lines={WARNINGS} commit={commit} />
        </div>
      </div>
      <p class="note">
        Tiers come from the plugin's default <code>astral.yml</code> (<a href={item.upgrades!.source} target="_blank" rel="noopener noreferrer">AstralYml.kt</a>);
        the server can change them. Stats are vanilla Minecraft 26.2 values for each material, as the game shows them.
      </p>
    </div>
  );
}
