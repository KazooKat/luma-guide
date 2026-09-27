import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { McTooltip } from '../../components/McTooltip';
import { SuggestButton } from '../../components/SuggestButton';
import { ASTRAL_ORB_SETS } from '../../lib/relics';
import { materialName } from '../../lib/itemSearch';
import { plain } from '../../lib/minimessage';
import { BY_ID, DATA, ITEMS, SECTIONS, sectionGradient, TierChip } from './common';
import type { WriteupsData } from '../../data/types';
import { AstralUpgrades } from './AstralUpgrades';
import { KamoriWriteup } from './KamoriWriteup';
import { WriteupView } from './Writeup';

/** Items whose write-up is a custom component (live clocks etc.); every other item uses data/writeups. */
const CUSTOM: Record<string, ComponentType> = {
  'kamoris-glasses': KamoriWriteup,
};
/** The write-ups (~350 KB) load only when an item page opens, not with the grid. */
let cache: WriteupsData | null = null;
function useWriteups() {
  const [data, setData] = useState<WriteupsData | null>(cache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (cache) return;
    import('../../data/writeups.json')
      .then((m) => { cache = m.default as WriteupsData; setData(cache); })
      .catch(() => setFailed(true));
  }, []);
  return { data, failed };
}

const ORB_SETS = new Set(ASTRAL_ORB_SETS.map((s) => `${s.set.toLowerCase()}-set`));

export function ItemDetail({ id }: { id: string }) {
  const { data: W, failed } = useWriteups();
  const item = BY_ID.get(id);
  if (!item) {
    return (
      <section class="card">
        <h2>Item not found</h2>
        <p>There's no custom item called “{id}”. <a href="#/items">Back to all items</a></p>
      </section>
    );
  }
  const section = SECTIONS.get(item.section)!;
  const name = plain(item.name);
  const Custom = CUSTOM[item.id];
  const writeup = W?.writeups[W.byItem[item.id]];
  const siblings = ITEMS.filter((i) => i.section === item.section && i.set === item.set);
  const at = siblings.indexOf(item);
  const prev = siblings[at - 1];
  const next = siblings[at + 1];

  return (
    <>
      <nav class="crumbs" aria-label="Item navigation">
        <a href="#/items">← All items</a>
        <span class="spacer" />
        {prev && <a href={`#/items/${prev.id}`}>‹ {plain(prev.name)}</a>}
        {next && <a href={`#/items/${next.id}`}>{plain(next.name)} ›</a>}
      </nav>

      <section class="card item-detail" style={{ '--sec': sectionGradient(section) }} aria-labelledby="item-title">
        <div class="item-card-head">
          <div class="item-frame"><Icon id={item.icon} size={48} /></div>
          <div class="item-title">
            <h2 id="item-title">{name}</h2>
            <div class="stripe" aria-hidden="true"><i style={{ background: sectionGradient(section) }} /></div>
            <p class="small" style={{ color: 'var(--text-2)' }}>
              {materialName(item.material)} · {item.setName ? `${item.setName} set · ` : ''}{section.name}
            </p>
          </div>
        </div>

        <div class="detail-grid">
          <div class="tip-col">
            <span class="sub-label">In-game tooltip</span>
            <div class="tip-scroll"><McTooltip item={item} labelledBy="item-title" /></div>
            {item.note && <p class="note variant-note"><b>Varies in game.</b> {item.note}</p>}
          </div>
          <div class="facts-col">
            <span class="sub-label">At a glance</span>
            <dl class="kv">
              <dt>{section.kind === 'event' ? 'Event' : 'Group'}</dt>
              <dd><TierChip section={section} /></dd>
              <dt>Item</dt>
              <dd>{materialName(item.material)}</dd>
              {item.abilities.length > 0 && (<><dt>Abilities</dt><dd>{item.abilities.map(plain).join(', ')}</dd></>)}
              {item.enchantList.length > 0 && (
                <>
                  <dt>Enchants</dt>
                  <dd>{item.enchantList.join(', ')}{item.enchantsHidden && <span class="muted"> (not shown on the tooltip)</span>}</dd>
                </>
              )}
              {item.set && (
                <>
                  <dt>Set</dt>
                  <dd>
                    <a href={`#/items/astral/${item.set}`}>{item.setName} set</a>
                    {ORB_SETS.has(item.set) ? <> · drops from <a href="#/relics">Astral Orbs</a></> : <span class="muted"> · not in the Astral Orb pool</span>}
                  </dd>
                </>
              )}
              <dt>Source</dt>
              <dd><a href={item.source} target="_blank" rel="noopener noreferrer">{item.source.split('/').pop()}</a></dd>
            </dl>
          </div>
        </div>

        {!Custom && !W ? (
          <p class="note" aria-live="polite">{failed ? "The mechanics didn't load. Check your connection and reload the page." : 'Loading how it works…'}</p>
        ) : Custom || writeup ? (
          <div class="writeup">
            <h3 class="writeup-title">How it works</h3>
            {Custom ? <Custom /> : <WriteupView w={writeup!} commit={W!.commit} />}
          </div>
        ) : (
          <div class="no-writeup">
            <p>
              No hand-checked write-up for {name} yet. The tooltip and facts above are read straight from the plugin's source.
              Write-ups are being added one event at a time.
            </p>
            <SuggestButton label="Tell us how it works" outline />
          </div>
        )}
        {item.upgrades && <div class="writeup"><AstralUpgrades item={item} commit={DATA.source.commit} /></div>}
      </section>
    </>
  );
}
