import { useMemo, useState } from 'preact/hooks';
import type { Job } from '../../data/types';
import { Icon } from '../../components/Icon';
import { fmt2, fmtMoney } from '../../lib/format';
import { moneyAt, xpAt } from '../../lib/scaling';
import { itemKey } from '../JobsTab';

type Sort = 'money' | 'xp';
const PAGE = 12;

interface Props {
  job: Job;
  level: number;
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function ItemTable({ job, level, selectedKey, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('money');
  const [showAll, setShowAll] = useState(false);

  const actions = useMemo(() => [...new Set(job.items.map((i) => i.action))], [job]);
  // Builder and Miner have block categories; for other jobs the category is just the action.
  const categories = useMemo(() => {
    const cats = [...new Set(job.items.map((i) => i.category))];
    return cats.every((c) => actions.includes(c)) ? [] : cats.sort();
  }, [job, actions]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return job.items
      .filter((i) => (!action || i.action === action) && (!category || i.category === category) && (!q || i.item.toLowerCase().includes(q)))
      .map((i) => ({ i, money: moneyAt(i.moneyBase, level), xp: xpAt(i.xpBase, level) }))
      .sort((a, b) => b[sort] - a[sort] || a.i.item.localeCompare(b.i.item));
  }, [job, level, query, action, category, sort]);

  // Keep the row being planned with visible even when it sits below the cut.
  const visible = useMemo(() => {
    if (showAll) return rows;
    const top = rows.slice(0, PAGE);
    const sel = rows.find((r) => itemKey(r.i) === selectedKey);
    return sel && !top.includes(sel) ? [...top, sel] : top;
  }, [rows, showAll, selectedKey]);
  return (
    <section class="card" aria-label={`What ${job.job} pays`}>
      <div class="card-title">
        <h3>What {job.job} pays</h3>
        <span>per action, at your level ({level})</span>
      </div>
      <div class="table-tools">
        <input class="search" type="search" placeholder={`Search ${job.items.length} items`} aria-label="Search items"
          value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
        {categories.length > 0 && (
          <label class="field" style={{ gridAutoFlow: 'column', alignItems: 'center' }}>
            <select aria-label="Category" value={category ?? ''} onChange={(e) => setCategory((e.currentTarget as HTMLSelectElement).value || null)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>
      {actions.length > 1 && (
        <div class="chips" role="group" aria-label="Action">
          <button class="chip" aria-pressed={action === null} onClick={() => setAction(null)}>All</button>
          {actions.map((a) => (
            <button key={a} class="chip" aria-pressed={action === a} onClick={() => setAction(a)}>{a}</button>
          ))}
        </div>
      )}
      <div class="item-list">
        <div class="item-head">
          <span>Item</span>
          <button class="r" onClick={() => setSort('money')} aria-label="Sort by money">Money{sort === 'money' ? ' ↓' : ''}</button>
          <button class="r" onClick={() => setSort('xp')} aria-label="Sort by XP">XP{sort === 'xp' ? ' ↓' : ''}</button>
        </div>
        {visible.map(({ i, money, xp }) => {
          const key = itemKey(i);
          return (
            <button key={key} class="item-row" aria-pressed={key === selectedKey} onClick={() => onSelect(key)}>
              <span class="item-name">
                <Icon id={i.icon} size={28} lazy />
                <span>
                  <b>{i.item}</b>
                  <small>{i.action}{i.dupe && <span class="flag"> · listed twice</span>}</small>
                </span>
              </span>
              <span class="r mono">{fmtMoney(money)}</span>
              <span class="r mono">{fmt2(xp)}</span>
            </button>
          );
        })}
        {rows.length === 0 && <p class="note" style={{ padding: '8px 12px' }}>No items match.</p>}
      </div>
      <p class="note">
        {rows.length > visible.length ? (
          <>Showing {visible.length} of {rows.length}. <button class="link-btn" onClick={() => setShowAll(true)}>Show all</button></>
        ) : (
          <>Showing {rows.length} of {job.items.length}. Pick a row to plan with it.</>
        )}
      </p>
    </section>
  );
}
