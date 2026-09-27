import { AtlasIcon } from '../../components/AtlasIcon';
import type { GlossaryItem, UpgradeStep, WriteupLine } from '../../data/types';
import { materialName } from '../../lib/itemSearch';
import { plain } from '../../lib/minimessage';
import { makeNotes, Sources } from './Writeup';

// How an upgrade works, from LumaItems @ the pinned commit (commands/UpgradeCommand.kt, guis/AstralUpgradeGui.kt,
// events/GeneralListeners.kt, items/astral/upgrades/AstralSetUpgradeFactory.kt).
const STEPS: WriteupLine[] = [
  { text: 'Type /upgrade to open the Astral Upgrades menu.', src: 'commands/UpgradeCommand.kt:13-15' },
  { text: 'Put the piece in the left slot and an Astral Upgrade Core in the middle slot, then click Confirm.', src: 'guis/AstralUpgradeGui.kt:22, guis/AstralUpgradeGui.kt:36-39' },
  { text: 'One core is used and the piece moves to the right slot, one tier higher.', src: 'guis/AstralUpgradeGui.kt:42-45' },
  { text: 'At the last tier the footer changes to "Tier • Astral+".', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:23, items/astral/upgrades/AstralSetUpgradeFactory.kt:57' },
];

const WARNINGS: WriteupLine[] = [
  { text: 'Take the upgraded piece out of the right slot before upgrading another one. The next upgrade replaces whatever is there.', src: 'guis/AstralUpgradeGui.kt:44' },
  { text: 'Once both slots are filled, any click while the menu is open does the upgrade, even in your own inventory, not only Confirm.', src: 'events/GeneralListeners.kt:143-146, guis/AstralUpgradeGui.kt:27-45' },
  { text: 'Anything left in the three slots is given back when you close the menu.', src: 'guis/AstralUpgradeGui.kt:53-56' },
  { text: 'A tier only adds enchantments the piece could normally carry, or ones it names for that piece type, and its level replaces the old one. So some listed enchants never land (elytra can\'t take Protection, for example).', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:85-91' },
  { text: 'Only armor, swords and tools change material. Elytra, shields, crossbows, fishing rods and blaze rods keep theirs and only gain enchants.', src: 'items/astral/upgrades/AstralSetUpgradeFactory.kt:67-81' },
];

const STAT_LABELS: [keyof NonNullable<UpgradeStep['stats']>, string][] = [
  ['armor', 'Armor'], ['toughness', 'Toughness'], ['knockbackResistance', 'Knockback res.'],
  ['attackDamage', 'Attack damage'], ['attackSpeed', 'Attack speed'], ['durability', 'Durability'],
];

function TierCard({ step, prev, max }: { step: UpgradeStep; prev?: UpgradeStep; max: number }) {
  const last = step.tier === max && max > 1;
  const had = new Set(prev?.enchants ?? []);
  return (
    <div class={last ? 'tier-card last' : 'tier-card'}>
      <div class="tier-card-head">
        <span class="tier-num">Tier {step.tier}</span>
        <span class={last ? 'tier-tag astral' : 'tier-tag'}>{step.tier === 1 ? 'As it drops' : last ? 'Astral+' : '+1 core'}</span>
      </div>
      <div class="tier-item"><AtlasIcon id={step.material.toLowerCase()} size={32} /><b>{materialName(step.material)}</b></div>
      <dl class="tier-stats">
        {STAT_LABELS.filter(([k]) => step.stats?.[k] !== undefined && step.stats[k] !== 0).map(([k, label]) => {
          const v = step.stats![k]!;
          const d = prev ? Math.round((v - (prev.stats?.[k] ?? 0)) * 100) / 100 : 0;
          return (
            <div key={k}>
              <dt>{label}</dt>
              <dd>{v}{d > 0 && <span class="gain"> +{d}</span>}</dd>
            </div>
          );
        })}
      </dl>
      <ul class="tier-enchants" aria-label="Enchantments">
        {step.enchants.map((e) => <li key={e} class={prev && !had.has(e) ? 'new' : undefined}>{e}</li>)}
      </ul>
    </div>
  );
}

function Slot({ icon, label }: { icon: string; label: string }) {
  return (
    <div class="mc-slot">
      <span class="mc-slot-box"><AtlasIcon id={icon} size={40} label={label} /></span>
      <span class="mc-slot-label">{label}</span>
    </div>
  );
}

/** Tier-by-tier stats for one Astral piece, plus how upgrading works. */
export function AstralUpgrades({ item, commit }: { item: GlossaryItem; commit: string }) {
  const path = item.upgrades!.path;
  const max = path[path.length - 1].tier;
  const cores = max - 1;
  const notes = makeNotes('up');
  return (
    <section class="card detail-card" aria-labelledby="upgrading">
      <div class="card-title">
        <h2 id="upgrading" class="detail-h2">Upgrading</h2>
        <span>{cores} Astral Upgrade Core{cores === 1 ? '' : 's'} to reach tier {max}</span>
      </div>
      <div class="tier-cards">
        {path.map((step, i) => <TierCard key={step.tier} step={step} prev={path[i - 1]} max={max} />)}
      </div>
      <div class="upgrade-how">
        <div class="wu-block">
          <h3>How to upgrade</h3>
          <div class="mc-panel" role="img" aria-label={`Upgrade menu: ${plain(item.name)} plus an Astral Upgrade Core gives the tier ${path[1].tier} piece`}>
            <Slot icon={item.icon} label="Your piece" />
            <span class="mc-panel-sign" aria-hidden="true">+</span>
            <Slot icon="amethyst_cluster" label="Upgrade Core" />
            <svg class="mc-panel-sign" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <Slot icon={path[1].material.toLowerCase()} label={`Tier ${path[1].tier}`} />
          </div>
          <ol class="wu-plain-steps">
            {STEPS.map((s) => <li key={s.text}>{s.text}{notes.cite(s.src)}</li>)}
          </ol>
          <p class="note">Where to get Astral Upgrade Cores: see <a href="#/relics">Relics</a>.</p>
        </div>
        <div class="wu-block callout warn">
          <h3>Good to know</h3>
          <ul class="wu-bullets">
            {WARNINGS.map((s) => <li key={s.text}><span>{s.text}{notes.cite(s.src)}</span></li>)}
          </ul>
        </div>
      </div>
      <p class="note">
        Tiers come from the plugin's default <code>astral.yml</code> (<a href={item.upgrades!.source} target="_blank" rel="noopener noreferrer">AstralYml.kt</a>);
        the server can change them. Stats are vanilla Minecraft 26.2 values for each material. Green marks what the tier added.
      </p>
      <Sources notes={notes} commit={commit} />
    </section>
  );
}
