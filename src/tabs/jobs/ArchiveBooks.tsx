import type { Job } from '../../data/types';
import { ARCHIVE_PERCENTS, ARCHIVE_SLOTS, archiveMultiplier } from '../../lib/archives';
import type { JobPrefs } from './prefs';

/** "+15.76%" from a multiplier, trimming trailing zeros. */
export const boostLabel = (m: number) => `+${((m - 1) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

/** Archive of Astralis books held for this job: one picker per slot that counts (main hand, off hand, head via /hat). */
export function ArchiveBooks({ job, prefs, set }: { job: Job; prefs: JobPrefs; set: (p: Partial<JobPrefs>) => void }) {
  const books = ARCHIVE_SLOTS.map((_, i) => (Array.isArray(prefs.archives) ? prefs.archives[i] : 0) ?? 0);
  const m = archiveMultiplier(books);
  const pick = (i: number) => (e: Event) => {
    const next = [...books];
    next[i] = Number((e.currentTarget as HTMLSelectElement).value);
    set({ archives: next });
  };
  return (
    <div class="books">
      <span class="sub-label">{job.job} Archive of Astralis books you hold</span>
      <div class="books-row">
        {ARCHIVE_SLOTS.map((slot, i) => (
          <label class="field" key={slot}>{slot}
            <select value={books[i]} onChange={pick(i)}>
              <option value={0}>None</option>
              {ARCHIVE_PERCENTS.map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </label>
        ))}
      </div>
      <p class="note">
        {m > 1
          ? <>Your books give <b>{boostLabel(m)}</b> {job.job} XP and money. Each book multiplies on its own, and every number below includes them.</>
          : <>Each {job.job} book you hold boosts {job.job} XP and money by its %. Pick yours to include them below.</>}
        {' '}<a href={`#/items/archive-of-astralis-${job.job.toLowerCase()}`}>About the books</a>
      </p>
    </div>
  );
}
