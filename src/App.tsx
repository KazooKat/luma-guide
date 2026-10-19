import { useEffect, useState } from 'preact/hooks';
import { useRoute } from './lib/route';
import { Icon } from './components/Icon';
import { SuggestButton } from './components/SuggestButton';
import { ThemeToggle } from './components/ThemeToggle';
import { JobsTab } from './tabs/JobsTab';
import { RelicsTab } from './tabs/RelicsTab';
import { DATA_DATE } from './config';
// Just the nav switch (written by npm run event); the event data itself loads with the tab.
import eventLive from './data/event-live.json';

type ItemsTabType = typeof import('./tabs/ItemsTab').ItemsTab;
type EventTabType = typeof import('./tabs/EventTab').EventTab;

/** The item glossary (and its ~360 KB of item data) loads only when the Items tab is opened. */
function LazyItems(props: Parameters<ItemsTabType>[0]) {
  const [Tab, setTab] = useState<ItemsTabType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import('./tabs/ItemsTab').then((m) => setTab(() => m.ItemsTab)).catch(() => setFailed(true));
  }, []);
  if (failed) return <section class="card"><p>The item list didn't load. Check your connection and reload the page.</p></section>;
  return Tab ? <Tab {...props} /> : <p class="note" aria-live="polite">Loading items…</p>;
}

/** The event section loads only when opened. While data/event/event.json has live: false it is reachable by link only. */
function LazyEvent(props: Parameters<EventTabType>[0]) {
  const [Tab, setTab] = useState<EventTabType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import('./tabs/EventTab').then((m) => setTab(() => m.EventTab)).catch(() => setFailed(true));
  }, []);
  if (failed) return <section class="card"><p>The event page didn't load. Check your connection and reload the page.</p></section>;
  return Tab ? <Tab {...props} /> : <p class="note" aria-live="polite">Loading the event…</p>;
}

export function App() {
  const [section = 'jobs', sub, extra] = useRoute();
  const tab = section === 'items' || section === 'relics' || section === 'event' ? section : 'jobs';
  return (
    <>
      <header class="topbar">
        <a class="brand" href="#/jobs">
          <Icon id="amethyst_shard" size={28} />
          <b>Luma Guide</b>
          <small>for play.lumamc.net</small>
        </a>
        <nav class="tabs" aria-label="Sections">
          <a class="tab" href="#/jobs" aria-current={tab === 'jobs' ? 'page' : undefined}>Jobs</a>
          <a class="tab" href="#/items" aria-current={tab === 'items' ? 'page' : undefined}>Items</a>
          <a class="tab" href="#/relics" aria-current={tab === 'relics' ? 'page' : undefined}>Relics</a>
          {eventLive.listed && <a class="tab" href="#/event" aria-current={tab === 'event' ? 'page' : undefined}>{eventLive.name}</a>}
        </nav>
        <div class="spacer" />
        <ThemeToggle />
        <SuggestButton />
      </header>
      <main>
        {tab === 'jobs' ? <JobsTab jobSlug={sub} />
          : tab === 'relics' ? <RelicsTab />
          : tab === 'event' ? <LazyEvent sub={sub} extra={extra} />
          : <LazyItems sub={sub} extra={extra} />}
      </main>
      <footer class="site">
        <span>Fan-made guide, not affiliated with LumaMC. Minecraft icons © Mojang.</span>
        <span>Job pay last read from /jobs browse on {DATA_DATE}.</span>
      </footer>
    </>
  );
}
