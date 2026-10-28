import type { Job } from '../../data/types';

/** A pay change staff have announced but nobody has read in game yet (payChange in data/jobs-meta.json). */
export function PayChange({ job }: { job: Job }) {
  const c = job.payChange;
  if (!c) return null;
  return (
    <section class="callout warn pay-change" aria-label={`Announced ${job.job} pay change`}>
      <h3>{job.job} pay changes {c.due}</h3>
      <ul class="facts plain compact">
        {c.lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p class="note">
        Announced by Luma staff on {c.announced}. The numbers on this page are from before the change, and get updated once the new pay is read from <code>/jobs browse</code>.
      </p>
    </section>
  );
}
