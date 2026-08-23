import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { RankScope, RankState, TierProgress } from '@/model/ranks';
import {
  awardXp,
  createRankState,
  resolveTiers,
  rollOver,
  tierProgress,
  tierReachCount,
} from '@/model/ranks';
import { RANKS_KEY } from '@/app/backup';

/**
 * The three ladders – a separate slice with its own storage key, exactly as the
 * model splits it. `RankState` has no seed value; it is constructed on first use.
 *
 * The plan does not enter into it: the maxima are absolute (`SCOPE_MAX`), so
 * nothing here needs to know which plan is active or where its cursor stands.
 */
export const useRankStore = defineStore(
  'ranks',
  () => {
    const state = ref<RankState | null>(null);

    /** Construct the ladders on first use – `max` is frozen at period start. */
    function ensure(now: Date): RankState {
      if (!state.value) state.value = createRankState(now);
      return state.value;
    }

    /**
     * Close out expired periods. Idempotent – safe on every app start and on
     * every date change.
     */
    function refresh(now: Date): void {
      state.value = rollOver(ensure(now), now);
    }

    /**
     * Credit a delta to all three ladders. Negative deltas are the mechanism
     * behind "unchecking a set gives its XP back"; records only ever ratchet
     * upwards, so they survive it – and every reset.
     */
    function award(delta: number, now: Date): void {
      const base = ensure(now);
      if (delta === 0) {
        refresh(now);
        return;
      }
      state.value = awardXp(base, delta, now);
    }

    /** Wipe the ladders – used when the training data is reset. */
    function reset(): void {
      state.value = null;
    }

    const progress = computed<Record<RankScope, TierProgress> | null>(() => {
      const s = state.value;
      if (!s) return null;
      return {
        week: tierProgress('week', s.week),
        month: tierProgress('month', s.month),
        year: tierProgress('year', s.year),
      };
    });

    const tiersFor = (scope: RankScope) =>
      state.value ? resolveTiers(scope, state.value[scope].max) : [];

    /** Newest first – the "Abgeschlossene Perioden" list. */
    const history = computed(() => [...(state.value?.history ?? [])].reverse());

    const records = computed(
      () => state.value?.records ?? { week: null, month: null, year: null },
    );

    /**
     * How often the record of a scope has been reached – 0 without a record.
     * Weekly records repeat often enough that the bare title would hide it.
     */
    const recordCount = (scope: RankScope): number => {
      const s = state.value;
      const key = s?.records[scope];
      return s && key ? tierReachCount(s, scope, key) : 0;
    };

    return {
      state,
      progress,
      history,
      records,
      ensure,
      refresh,
      award,
      reset,
      tiersFor,
      recordCount,
    };
  },
  {
    persist: {
      key: RANKS_KEY,
      pick: ['state'],
    },
  },
);
