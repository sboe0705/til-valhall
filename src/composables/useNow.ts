import { computed, ref } from 'vue';

import { toIsoDate } from '@/model/schedule';

/**
 * The app's clock, as a module-level singleton so stores and views agree on
 * what "today" is.
 *
 * Re-evaluated when the tab becomes visible again and once just after local
 * midnight – that is what drives the idempotent `rollOver()` on a date change.
 * Dates are compared via `toIsoDate` (local parts), never `toISOString()`.
 */
const now = ref(new Date());

export const todayIso = computed(() => toIsoDate(now.value));

let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleMidnight(): void {
  if (timer) clearTimeout(timer);
  const current = new Date();
  // Two seconds past midnight – a hair of slack against timer drift.
  const next = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() + 1,
    0,
    0,
    2,
  );
  timer = setTimeout(() => {
    now.value = new Date();
    scheduleMidnight();
  }, next.getTime() - current.getTime());
}

if (typeof window !== 'undefined') {
  scheduleMidnight();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) now.value = new Date();
  });
}

export function useNow() {
  return { now, todayIso };
}

/** Test seam – lets specs pin the clock without touching timers. */
export function __setNow(date: Date): void {
  now.value = date;
}
