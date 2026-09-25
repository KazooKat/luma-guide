import { useRoute } from './lib/route';
import { Icon } from './components/Icon';
import { SuggestButton } from './components/SuggestButton';
import { JobsTab } from './tabs/JobsTab';
import { ItemsTab } from './tabs/ItemsTab';
import { DATA_DATE } from './config';

export function App() {
  const [section = 'jobs', sub] = useRoute();
  const tab = section === 'items' ? 'items' : 'jobs';
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
        </nav>
        <div class="spacer" />
        <SuggestButton />
      </header>
      <main>{tab === 'jobs' ? <JobsTab jobSlug={sub} /> : <ItemsTab />}</main>
      <footer class="site">
        <span>Fan-made guide, not affiliated with LumaMC. Minecraft icons © Mojang.</span>
        <span>Job pay read from /jobs browse on {DATA_DATE}.</span>
      </footer>
    </>
  );
}
