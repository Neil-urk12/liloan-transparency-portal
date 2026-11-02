/** Ignore malformed shared fragments while preserving encoded section links. */
export function scrollToHash(hash: string): void {
  if (!hash) return;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}
