import { AtlasIcon } from '../../components/AtlasIcon';
import { SuggestButton } from '../../components/SuggestButton';
import { fmtInt } from '../../lib/format';
import { plain } from '../../lib/minimessage';
import { BY_ID } from '../items/common';
import type { ShopItem } from '../../data/types';
import { META } from './common';

/**
 * What the shop costs in total. Items with no limit (nametags, particles) can be bought any number of times, so they
 * stay out of the total and are listed in `open` instead. With no limits at all, the total is 1 of everything.
 */
export function shopTotal(items: ShopItem[]) {
  const limited = items.filter((s) => s.limit);
  const open = limited.length ? items.filter((s) => !s.limit).map((s) => s.name) : [];
  const total = (limited.length ? limited : items).reduce((n, s) => n + s.cost * (s.limit ?? 1), 0);
  return { total, limited: limited.length, open };
}

export function Shop() {
  const { items, readOn, where } = META.shop;
  const token = META.token.name ?? 'tokens';

  if (!items.length) {
    return (
      <section class="card empty" aria-label="Shop">
        <div class="card-title"><h3>Event shop</h3></div>
        <p>
          Items and prices go here once the event opens. The shop's prices live in the server's config, which isn't public,
          so they're read in game rather than from the code.
        </p>
        <div><SuggestButton label="Send in shop prices" outline /></div>
      </section>
    );
  }

  const { total, limited, open } = shopTotal(items);
  const openNames = open.length > 1 ? `${open.slice(0, -1).join(', ')} and ${open[open.length - 1]}` : open[0];
  return (
    <section class="card" aria-label="Shop">
      <div class="card-title">
        <h3>Event shop</h3>
        <span>{where ? `${where} · ` : ''}{readOn ? `prices read in game on ${readOn}` : 'prices read in game'}</span>
      </div>
      <div class="odds-table" role="table" aria-label="Shop items">
        <div class="odds-row head shop-row" role="row">
          <span role="columnheader">Item</span><span role="columnheader" class="r">Cost</span><span role="columnheader" class="r">Limit</span>
        </div>
        {items.map((s) => {
          const item = s.itemId ? BY_ID.get(s.itemId) : undefined;
          const name = item ? plain(item.name) : s.name;
          return (
            <div class="odds-row shop-row" role="row" key={s.name}>
              <span role="cell" class="item-name">
                {item ? <AtlasIcon id={item.icon} size={24} glint={item.glint} /> : <span class="atlas-icon" style={{ width: 24, height: 24 }} />}
                <span>
                  <b>{item ? <a href={`#/items/${item.id}`}>{name}</a> : name}</b>
                  {s.note && <small>{s.note}</small>}
                </span>
              </span>
              <span role="cell" class="r mono">{fmtInt(s.cost)}</span>
              <span role="cell" class="r mono muted">{s.limit ?? 'none'}</span>
            </div>
          );
        })}
      </div>
      <p class="note">
        {!limited ? <>1 of everything costs {fmtInt(total)} {token} in total.</>
          : !open.length ? <>Everything, up to each limit, costs {fmtInt(total)} {token} in total.</>
          : <>Everything with a limit, bought up to that limit, costs {fmtInt(total)} {token} in total. {openNames} {open.length > 1 ? 'have' : 'has'} no limit.</>}
      </p>
    </section>
  );
}
