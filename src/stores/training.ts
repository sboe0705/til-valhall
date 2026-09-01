import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { initialState } from '@/data/default-plan';
import type {
  Id,
  PlanSchedule,
  TrainingDay,
  TrainingPlan,
  TrainingState,
  WorkoutSession,
} from '@/model/training';
import { advanceCursor, createSession, nextDay, orderedDays } from '@/model/plan-cycle';
import {
  convertSchedule,
  dayForDate,
  daysBetween,
  isWeekly,
  toIsoDate,
  validatePlan,
} from '@/model/schedule';
import { SCOPE_MAX, weeklyPotential, withExtraSet } from '@/model/ranks';
import type { DayDraft } from '@/model/plan-edit';
import { addDay, dayNumbers, makeDay, moveDay, removeDay } from '@/model/plan-edit';
import {
  doneSetsOf,
  isComplete,
  liveSessionXp,
  setDoneCount,
  statusFor,
} from '@/app/session-xp';
import { TRAINING_KEY } from '@/app/backup';
import { useNow } from '@/composables/useNow';
import { useRankStore } from './ranks';

/**
 * `TrainingState` plus three app-level bookkeeping maps.
 *
 * The model's XP API only ever *adds* (`awardXp`), while the design re-books on
 * every tap – including unchecking. `bookedXp` records what a session has
 * already contributed so the store can hand over the delta, and `advancedBy`
 * remembers the cursor from before a completion so the advance can be undone.
 *
 * `cursorDue` dates the cursor of a cyclic plan: the calendar day its day is up
 * on. It is what lets `rollCursor()` close out a day that was never finished.
 */
export const useTrainingStore = defineStore(
  'training',
  () => {
    const { now, todayIso } = useNow();

    // The seed shares `TrainingDay` objects between defaultPlan and weeklyPlan –
    // never hand it out unwrapped.
    const state = ref<TrainingState>(structuredClone(initialState));
    const bookedXp = ref<Record<Id, number>>({});
    const advancedBy = ref<Record<Id, Id>>({});
    const cursorDue = ref<Record<Id, string>>({});

    /* ---------------- derived ---------------- */

    const activePlan = computed<TrainingPlan | null>(() => {
      const id = state.value.activePlanId;
      return id ? (state.value.plans[id] ?? null) : null;
    });

    const plans = computed(() => Object.values(state.value.plans));
    const exercises = computed(() => state.value.exercises);

    /** Cursor of the active plan – meaningless for weekly plans. */
    const cursorDayId = computed<Id | undefined>(() =>
      activePlan.value ? state.value.cursors[activePlan.value.id] : undefined,
    );

    /** Positional day numbers; rest days map to `null`. */
    const numbers = computed(() =>
      activePlan.value ? dayNumbers(activePlan.value) : new Map<Id, number | null>(),
    );

    const days = computed(() => (activePlan.value ? orderedDays(activePlan.value) : []));

    const planErrors = computed(() =>
      activePlan.value ? validatePlan(activePlan.value) : [],
    );

    /**
     * What a gapless week is worth under the *current* plan, against what the
     * weekly ladder asks for. The two differ as soon as a plan leaves calendar
     * days empty – a weekday plan cannot reach Konungr, and the Plan screen
     * says so rather than letting the user find out on a Sunday.
     */
    const perfectWeek = computed(() =>
      activePlan.value ? weeklyPotential(activePlan.value, cursorDayId.value) : 0,
    );

    const perfectWeekMax = SCOPE_MAX.week;

    function sessionOn(iso: string): WorkoutSession | null {
      const planId = state.value.activePlanId;
      return (
        state.value.sessions.find(
          (s) => s.planId === planId && toIsoDate(new Date(s.startedAt)) === iso,
        ) ?? null
      );
    }

    const todaySession = computed(() => sessionOn(todayIso.value));

    /**
     * The day the "Heute" screen is about.
     *
     * A running session wins over the cursor: completing a day advances the
     * cursor, and without this the screen would jump to tomorrow's day the
     * instant the last set is checked.
     */
    const todayDay = computed(() => {
      const plan = activePlan.value;
      if (!plan) return null;
      const session = todaySession.value;
      if (session) return plan.days.find((d) => d.id === session.dayId) ?? null;
      return dayForDate(plan, now.value, cursorDayId.value);
    });

    /**
     * The day that comes after today – what the Heute screen previews once the
     * day is complete.
     *
     * Cyclic plans rotate off *today's* day, not off the cursor: the cursor has
     * already moved on by the time the preview is shown. Since a cycle day ends
     * with its calendar day, that next day is up tomorrow – dated like the
     * weekly preview.
     *
     * Weekly plans skip their empty weekdays: a finished Friday looks ahead to
     * Monday instead of reporting that nothing is planned.
     */
    const nextUp = computed<{ day: TrainingDay; date: Date } | null>(() => {
      const plan = activePlan.value;
      if (!plan || plan.days.length === 0) return null;

      if (!isWeekly(plan.schedule)) {
        const today = todayDay.value;
        return today ? { day: nextDay(plan, today.id), date: dateAt(1) } : null;
      }

      for (let offset = 1; offset <= 7; offset++) {
        const date = dateAt(offset);
        const day = dayForDate(plan, date);
        if (day) return { day, date };
      }
      return null;
    });

    /* ---------------- session flow ---------------- */

    /** `now` shifted by whole days – the calendar, not the clock. */
    function dateAt(offset: number): Date {
      const date = new Date(now.value);
      date.setDate(date.getDate() + offset);
      return date;
    }

    /**
     * Close out the cycle days whose calendar day is over.
     *
     * A cyclic day ends with its date, finished or not – an unfinished day is
     * missed, not carried over to the next morning. `cursorDue` dates the
     * cursor, so every day that has passed since moves the cycle on by one,
     * which is exactly the rotation `agenda()` projects.
     *
     * Idempotent, and a no-op for weekly plans, whose day follows from the
     * weekday. An undated cursor – a fresh state, or one persisted before this
     * bookkeeping existed – is simply stamped with today.
     */
    function rollCursor(): void {
      const plan = activePlan.value;
      if (!plan || isWeekly(plan.schedule) || plan.days.length === 0) return;

      const today = todayIso.value;
      const due = cursorDue.value[plan.id];
      if (due === undefined) {
        cursorDue.value[plan.id] = today;
        return;
      }

      const missed = daysBetween(due, today);
      if (missed <= 0) return;

      state.value = advanceCursor(state.value, plan.id, missed);
      cursorDue.value[plan.id] = today;
    }

    function book(session: WorkoutSession): void {
      const plan = activePlan.value;
      if (!plan) return;
      const ranks = useRankStore();
      const xp = liveSessionXp(session);
      const delta = xp - (bookedXp.value[session.id] ?? 0);
      ranks.award(delta, now.value);
      bookedXp.value[session.id] = xp;
    }

    /** Advance on completion, undo the advance when it is taken back. */
    function syncCursor(session: WorkoutSession): void {
      const plan = activePlan.value;
      // advanceCursor() does not check the schedule kind – the caller must.
      if (!plan || isWeekly(plan.schedule)) return;

      const complete = isComplete(session);
      const previous = advancedBy.value[session.id];

      if (complete && previous === undefined) {
        advancedBy.value[session.id] =
          state.value.cursors[plan.id] ?? orderedDays(plan)[0].id;
        state.value = advanceCursor(state.value, plan.id);
        // Today's day is finished; the one that follows is up tomorrow, so
        // `rollCursor()` must not count today as missed on top of it.
        cursorDue.value[plan.id] = toIsoDate(dateAt(1));
      } else if (!complete && previous !== undefined) {
        state.value = {
          ...state.value,
          cursors: { ...state.value.cursors, [plan.id]: previous },
        };
        cursorDue.value[plan.id] = todayIso.value;
        delete advancedBy.value[session.id];
      }
    }

    function persistSession(next: WorkoutSession): WorkoutSession {
      const status = statusFor(next);
      const stored: WorkoutSession = {
        ...next,
        status,
        finishedAt: isComplete(next)
          ? (next.finishedAt ?? now.value.toISOString())
          : undefined,
      };

      const i = state.value.sessions.findIndex((s) => s.id === stored.id);
      if (i >= 0) state.value.sessions[i] = stored;
      else state.value.sessions.push(stored);

      // Order is free since the ladders no longer read the plan – booking first
      // simply keeps the XP and the cursor in the order the user perceives them.
      book(stored);
      syncCursor(stored);
      return stored;
    }

    /**
     * Find or create today's session. Idempotent – call it on mount and on
     * every date change. Returns `null` when nothing is scheduled (a weekly
     * plan's free weekday).
     */
    function startToday(): WorkoutSession | null {
      const plan = activePlan.value;
      if (!plan) return null;

      rollCursor();

      const existing = todaySession.value;
      if (existing) return existing;

      const day = dayForDate(plan, now.value, cursorDayId.value);
      if (!day) return null;

      return persistSession(createSession(plan, day, now.value));
    }

    /** Give back everything a session booked and drop it from the history. */
    function discardSession(session: WorkoutSession): void {
      const plan = activePlan.value;
      if (!plan) return;

      const booked = bookedXp.value[session.id] ?? 0;
      if (booked !== 0) useRankStore().award(-booked, now.value);
      delete bookedXp.value[session.id];

      const previous = advancedBy.value[session.id];
      if (previous !== undefined && !isWeekly(plan.schedule)) {
        state.value = {
          ...state.value,
          cursors: { ...state.value.cursors, [plan.id]: previous },
        };
        cursorDue.value[plan.id] = todayIso.value;
      }
      delete advancedBy.value[session.id];

      state.value.sessions = state.value.sessions.filter((s) => s.id !== session.id);
    }

    /**
     * After a plan edit: if today's session is still untouched but the plan now
     * puts a different day on today, replace it. A session with progress in it
     * is left alone – the day was already begun under the old plan.
     */
    function revalidateToday(): void {
      const plan = activePlan.value;
      if (!plan) return;

      const session = todaySession.value;
      if (!session) {
        startToday();
        return;
      }
      if (session.results.some((r) => doneSetsOf(r) > 0)) return;

      const day = dayForDate(plan, now.value, cursorDayId.value);
      if (day?.id === session.dayId) return;

      discardSession(session);
      startToday();
    }

    /** Tap on set pill `k` (1-based). */
    function toggleSet(blockId: Id, k: number): void {
      const session = todaySession.value;
      if (!session) return;
      persistSession(setDoneCount(session, blockId, k));
    }

    /** Append one overflow set – refused by the model while the target is open. */
    function addExtraSet(blockId: Id): void {
      const session = todaySession.value;
      if (!session) return;
      persistSession(withExtraSet(session, blockId));
    }

    /* ---------------- plan editing ---------------- */

    function ensureCursor(plan: TrainingPlan): void {
      if (isWeekly(plan.schedule)) {
        // The cursor is meaningless while the plan runs on weekdays – and its
        // date would be stale by the time the plan is switched back.
        delete cursorDue.value[plan.id];
        return;
      }
      if (plan.days.length === 0) return;

      const current = state.value.cursors[plan.id];
      if (!current || !plan.days.some((d) => d.id === current)) {
        state.value.cursors[plan.id] = orderedDays(plan)[0].id;
      }
    }

    function updatePlan(next: TrainingPlan): void {
      state.value = {
        ...state.value,
        plans: { ...state.value.plans, [next.id]: next },
      };
      ensureCursor(next);
      revalidateToday();
    }

    function setScheduleKind(kind: PlanSchedule['kind']): void {
      const plan = activePlan.value;
      if (plan) updatePlan(convertSchedule(plan, kind));
    }

    /** Returns the new day's id so the caller can open it. */
    function createDay(draft: DayDraft): Id | null {
      const plan = activePlan.value;
      if (!plan) return null;
      const day = makeDay(draft);
      updatePlan(addDay(plan, day, now.value));
      return day.id;
    }

    function deleteDay(dayId: Id): void {
      const plan = activePlan.value;
      if (plan) updatePlan(removeDay(plan, dayId, now.value));
    }

    function shiftDay(dayId: Id, direction: -1 | 1): void {
      const plan = activePlan.value;
      if (plan) updatePlan(moveDay(plan, dayId, direction, now.value));
    }

    function setActivePlan(planId: Id): void {
      if (state.value.plans[planId]) state.value.activePlanId = planId;
    }

    /* ---------------- lifecycle ---------------- */

    /** App start and every date change: close out expired periods first. */
    function refresh(): void {
      if (!activePlan.value) return;
      useRankStore().refresh(now.value);
      startToday();
    }

    function resetAll(): void {
      state.value = structuredClone(initialState);
      bookedXp.value = {};
      advancedBy.value = {};
      cursorDue.value = {};
      useRankStore().reset();
    }

    return {
      state,
      bookedXp,
      advancedBy,
      cursorDue,
      activePlan,
      plans,
      exercises,
      cursorDayId,
      numbers,
      days,
      planErrors,
      perfectWeek,
      perfectWeekMax,
      todaySession,
      todayDay,
      nextUp,
      sessionOn,
      startToday,
      toggleSet,
      addExtraSet,
      setScheduleKind,
      createDay,
      deleteDay,
      shiftDay,
      setActivePlan,
      refresh,
      resetAll,
    };
  },
  {
    persist: {
      key: TRAINING_KEY,
      pick: ['state', 'bookedXp', 'advancedBy', 'cursorDue'],
      afterHydrate: (ctx) => {
        // No migration path exists yet – anything from another schema is dropped
        // rather than silently misread.
        const store = ctx.store as unknown as {
          state: TrainingState;
          resetAll: () => void;
        };
        if (store.state?.schemaVersion !== 1) store.resetAll();
      },
    },
  },
);
