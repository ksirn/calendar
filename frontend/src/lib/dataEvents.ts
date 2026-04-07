export const DATA_CHANGED_EVENT = 'calendar-data-changed';

export function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function subscribeDataChanged(handler: () => void) {
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}