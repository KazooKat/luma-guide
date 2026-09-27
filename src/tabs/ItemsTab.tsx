import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AtlasIcon } from '../components/AtlasIcon';
import { McTooltip } from '../components/McTooltip';
import { SuggestButton } from '../components/SuggestButton';
import type { GlossaryItem } from '../data/types';
import { indexItem, matches, type SearchField } from '../lib/itemSearch';
import { plain } from '../lib/minimessage';
import { DATA, ITEMS, SECTIONS, sectionGradient, TierChip } from './items/common';
import { ItemDetail } from './items/ItemDetail';

const INDEX = new Map(ITEMS.map((it) => [it.id, indexItem(it, SECTIONS.get(it.section))]));

const FIELDS: [SearchField, string][] = [['all', 'Everything'], ['name', 'Name'], ['event', 'Event'], ['effect', 'Effect'], ['enchant', 'Enchant']];

type Tip = { item: GlossaryItem; x: number; y: number; anchored: boolean };

/** Minecraft-style tooltip that follows the pointer, flipping to stay on screen. */
function HoverTip({ tip }: { tip: Tip | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!tip || !el) { setPos(null); return; }
    const { width, height } = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left = tip.x + 14;
    let top = tip.anchored ? tip.y + 8 : tip.y - 14;
    if (left + width > vw - 8) left = Math.max(8, tip.x - width - 14);
    if (top + height > vh - 8) top = Math.max(8, vh - height - 8);
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [tip?.item.id, tip?.x, tip?.y]);
  if (!tip) return null;
  return (
    <div ref={ref} class="hover-tip" aria-hidden="true" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
      <McTooltip item={tip.item} />
    </div>
  );
}

function ItemTile({ item, onTip }: { item: GlossaryItem; onTip: (t: Tip | null) => void }) {
  const label = plain(item.name);
  return (
    <a
      class="item-tile"
      href={`#/items/${item.id}`}
      aria-label={label}
      onMouseMove={(e) => onTip({ item, x: e.clientX, y: e.clientY, anchored: false })}
      onMouseLeave={() => onTip(null)}
      onFocus={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onTip({ item, x: r.right - 10, y: r.bottom, anchored: true });
      }}
      onBlur={() => onTip(null)}
    >
      <AtlasIcon id={item.icon} size={40} glint={item.glint} />
    </a>
  );
}

function Grid({ items, onTip }: { items: GlossaryItem[]; onTip: (t: Tip | null) => void }) {
  return <div class="item-grid">{items.map((it) => <ItemTile key={it.id} item={it} onTip={onTip} />)}</div>;
}

function Glossary({ focusSet }: { focusSet?: string }) {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<SearchField>('all');
  const [tip, setTip] = useState<Tip | null>(null);

  const shown = useMemo(() => ITEMS.filter((it) => matches(INDEX.get(it.id)!, query, field)), [query, field]);
  const bySection = useMemo(() => {
    const m = new Map<string, GlossaryItem[]>();
    for (const it of shown) m.set(it.section, [...(m.get(it.section) ?? []), it]);
    return m;
  }, [shown]);
  const searching = query.trim() !== '';

  useEffect(() => {
    if (!focusSet) return;
    const el = document.getElementById(`set-${focusSet}`);
    el?.scrollIntoView({ block: 'start' });
  }, [focusSet]);
  useEffect(() => {
    const hide = () => setTip(null);
    addEventListener('scroll', hide, { passive: true });
    return () => removeEventListener('scroll', hide);
  }, []);

  return (
    <>
      <section class="intro">
        <h1>Custom items</h1>
        <p>
          Every LumaItems custom item, grouped by the event it came from. Hover an item to see its in-game tooltip, or open it
          for the details. Read from the plugin's source code.
        </p>
      </section>

      <section class="card search-card" aria-label="Search items">
        <div class="search-row">
          <input
            class="search"
            type="search"
            placeholder="Search by name, event, effect or enchant"
            aria-label="Search items"
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          />
          <span class="small muted" aria-live="polite">
            {searching ? `${shown.length} of ${ITEMS.length} items` : `${ITEMS.length} items`}
          </span>
        </div>
        <div class="chips" role="group" aria-label="Search in">
          {FIELDS.map(([f, label]) => (
            <button key={f} class="chip" aria-pressed={field === f} onClick={() => setField(f)}>{label}</button>
          ))}
        </div>
        {!searching && (
          <nav class="jump" aria-label="Jump to an event">
            {DATA.sections.map((s) => (
              <button key={s.key} class="jump-link" onClick={() => document.getElementById(`sec-${s.key}`)?.scrollIntoView({ block: 'start' })}>
                <i style={{ background: sectionGradient(s) }} />{s.name}
              </button>
            ))}
          </nav>
        )}
      </section>

      {shown.length === 0 && (
        <section class="card empty"><p>No items match “{query}”{field !== 'all' ? ` in ${FIELDS.find(([f]) => f === field)![1].toLowerCase()}` : ''}.</p></section>
      )}

      {DATA.sections.map((s) => {
        const list = bySection.get(s.key);
        if (!list) return null;
        const sets = s.kind === 'astral' ? [...new Set(list.map((i) => i.set!))] : [];
        return (
          <section key={s.key} id={`sec-${s.key}`} class="card item-section" style={{ '--sec': sectionGradient(s) }} aria-label={s.name}>
            <div class="section-head">
              <TierChip section={s} />
              <span class="small muted">{list.length} item{list.length === 1 ? '' : 's'}</span>
              {s.kind === 'astral' && <a class="small" href="#/relics">How to get Astral gear</a>}
            </div>
            {s.kind === 'astral'
              ? sets.map((set) => {
                  const pieces = list.filter((i) => i.set === set);
                  return (
                    <div key={set} id={`set-${set}`} class={`astral-set${focusSet === set ? ' focus' : ''}`}>
                      <h3>
                        {pieces[0].setName}{' '}
                        <span class="small muted">
                          set · {pieces.length} piece{pieces.length === 1 ? '' : 's'}
                          {set !== `${pieces[0].setName!.toLowerCase()}-set` && ` · “${set[0].toUpperCase()}${set.slice(1).replace(/-set$/, '')}” in the orb odds`}
                        </span>
                      </h3>
                      <Grid items={pieces} onTip={setTip} />
                    </div>
                  );
                })
              : <Grid items={list} onTip={setTip} />}
          </section>
        );
      })}

      <section class="more-card">
        <p>Spotted a wrong tooltip, or know how an item works? Tell us and it'll get a write-up.</p>
        <SuggestButton label="Suggest a fix" outline />
      </section>
      <p class="note">
        Source: <a href={`https://github.com/LumaLibre/LumaItems/tree/${DATA.source.commit.slice(0, 7)}`} target="_blank" rel="noopener noreferrer">
          LumaLibre/LumaItems @ {DATA.source.commit.slice(0, 7)}</a> (CC BY-NC-ND 4.0, © LumaMC). Items the plugin ignores, staff and test items are left out.
      </p>
      <HoverTip tip={tip} />
    </>
  );
}

export function ItemsTab({ sub, extra }: { sub?: string; extra?: string }) {
  if (sub && sub !== 'astral') return <ItemDetail id={sub} />;
  return <Glossary focusSet={sub === 'astral' ? extra : undefined} />;
}

