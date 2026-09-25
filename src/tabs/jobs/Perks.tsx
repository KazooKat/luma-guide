import type { Perk } from '../../data/types';

export function Perks({ job, perks, level }: { job: string; perks: Perk[]; level: number }) {
  return (
    <section class="card" aria-label={`${job} perks`}>
      <div class="card-title"><h3>{job} perks</h3></div>
      <ul class="perks">
        {perks.map((p, i) => {
          const done = p.level <= level;
          return (
            <li key={i} class={done ? 'done' : undefined}>
              <span class="lvl">Lv {p.level}</span>
              <span class="text">{p.text}</span>
              <span class="state">{done ? 'Unlocked' : `${p.level - level} level${p.level - level === 1 ? '' : 's'} away`}</span>
            </li>
          );
        })}
      </ul>
      <p class="note">From LumaLibre/JobsAddons (PerksFile.kt).</p>
    </section>
  );
}
