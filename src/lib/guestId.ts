// Persistent UUID for non-logged-in players. Created lazily on first read.

const KEY = 'quizmint.guestId';

export function getGuestId(): string {
  if (typeof window === 'undefined') throw new Error('getGuestId called on server');
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
