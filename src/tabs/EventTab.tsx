import { SuggestButton } from '../components/SuggestButton';
import { Banners, META, SubNav } from './event/common';
import { MinigameDetail, MinigameList } from './event/Minigames';
import { Overview } from './event/Overview';
import { Shop } from './event/Shop';
import { Tokens } from './event/Tokens';

/** #/event, #/event/tokens, #/event/shop, #/event/minigames, #/event/minigames/<game> */
export function EventTab({ sub, extra }: { sub?: string; extra?: string }) {
  const page = sub === 'tokens' || sub === 'shop' || sub === 'minigames' ? sub : '';
  return (
    <>
      <section class="intro">
        <h1>{META.name}{!META.nameConfirmed && <span class="badge warn title-badge">name not confirmed</span>}</h1>
        <p>
          The seasonal event: minigames that pay event tokens, and a shop to spend them in. Everything here is read from the event plugin's
          code, with the source linked, apart from shop prices, which are read in game.
        </p>
      </section>
      <Banners />
      <SubNav page={page} />
      {page === 'tokens' ? <Tokens />
        : page === 'shop' ? <Shop />
        : page === 'minigames' ? (extra ? <MinigameDetail slug={extra} /> : <MinigameList />)
        : <Overview />}
      <section class="more-card">
        <p>Spotted something different in game, or have shop prices to add?</p>
        <SuggestButton label="Suggest a fix or addition" outline />
      </section>
    </>
  );
}
