import { SUGGEST_URL } from '../config';

const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function SuggestButton({ label = 'Suggest an addition', outline = false }: { label?: string; outline?: boolean }) {
  return (
    <a class={outline ? 'suggest outline' : 'suggest'} href={SUGGEST_URL} target="_blank" rel="noopener noreferrer">
      {!outline && <Plus />}
      <span class="long">{label}</span>
      {!outline && <span class="short">Suggest</span>}
    </a>
  );
}
