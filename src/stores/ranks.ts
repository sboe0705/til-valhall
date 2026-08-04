import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { Id, TrainingPlan } from '@/model/training';
import type { RankScope, RankState, TierProgress } from '@/model/ranks';
import {
  DEFAULT_XP,
  awardXp,
  createRankState,
  resolveTiers,
  rollOver,
  tierProgress,
} from '@/model/ranks';
import { RANKS_KEY } from '@/app/backup';

/**
 * The three ladders – a separate slice with its own storage key, exactly as the
 * model splits it. `RankState` has no seed value; it is constructed from the
 * plan on first use.
 *
 * Every call passes the plan's cursor through so `perfectXp` is phase-exact for
 * cyclic plans (830 XP for the seed week, not the 823 XP daily-average
 * approximation).
 */
export const useRankStore = defineStore(
  'ranks',
  () => {
    const state = ref<RankState | null>(null);

    /** Construct the ladders on first use – `max` is frozen at period start. */
    function ensure(plan: TrainingPlan, now: Date, cursorDayId?: Id): RankState {
      if (!state.value) {
        state.value = createRankState(plan, now, DEFAULT_XP, cursorDayId);
      }
      return state.value;
    }

    /**
     * Close out expired periods. Idempotent – safe on every app start and on
     * every date change.
     */
    function refresh(plan: TrainingPlan, now: Date, cursorDayId?: Id): void {
      state.value = rollOver(
        ensure(plan, now, cursorDayId),
        plan,
        now,
        DEFAULT_XP,
        cursorDayId,
      );
    }

    /**
     * Credit a delta to all three ladders. Negative deltas are the mechanism
     * behind "unchecking a set revokes the day bonus"; records only ever
     * ratchet upwards, so they survive it – and every reset.
     */
    function award(delta: number, plan: TrainingPlan, now: Date, cursorDayId?: Id): void {
      const base = ensure(plan, now, cursorDayId);
      if (delta === 0) {
        refresh(plan, now, cursorDayId);
        return;
      }
      state.value = awardXp(base, delta, plan, now, DEFAULT_XP, cursorDayId);
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

    return { state, progress, history, records, ensure, refresh, award, reset, tiersFor };
  },
  {
    persist: {
      key: RANKS_KEY,
      pick: ['state'],
    },
  },
);
