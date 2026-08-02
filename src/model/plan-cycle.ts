import type {
  BlockResult,
  Exercise,
  ExerciseBlock,
  Id,
  Target,
  TrainingDay,
  TrainingPlan,
  TrainingState,
  WorkoutSession,
} from './training';
import { isRepTarget } from './training';

/** Days in cycle order. */
export function orderedDays(plan: TrainingPlan): TrainingDay[] {
  return [...plan.days].sort((a, b) => a.order - b.order);
}

export function dayIndex(plan: TrainingPlan, dayId: Id): number {
  return orderedDays(plan).findIndex((d) => d.id === dayId);
}

/** Next day in the cycle (wrap-around). */
export function nextDay(plan: TrainingPlan, currentDayId: Id): TrainingDay {
  const days = orderedDays(plan);
  const i = days.findIndex((d) => d.id === currentDayId);
  return days[(i + 1) % days.length];
}

/** Next day that actually has exercises – skips rest days in the cycle. */
export function nextWorkoutDay(plan: TrainingPlan, currentDayId: Id): TrainingDay | null {
  const days = orderedDays(plan);
  let day = nextDay(plan, currentDayId);
  for (let i = 0; i < days.length; i++) {
    if (!day.restDay) return day;
    day = nextDay(plan, day.id);
  }
  return null; // rest days only
}

/** Day at an offset, e.g. `dayAtOffset(plan, cursor, 2)` = the workout after next. */
export function dayAtOffset(
  plan: TrainingPlan,
  fromDayId: Id,
  offset: number,
): TrainingDay {
  const days = orderedDays(plan);
  const i = days.findIndex((d) => d.id === fromDayId);
  const n = days.length;
  return days[(((i + offset) % n) + n) % n];
}

/** Preview of the next n training days. */
export function upcoming(
  plan: TrainingPlan,
  fromDayId: Id,
  count: number,
): TrainingDay[] {
  return Array.from({ length: count }, (_, k) => dayAtOffset(plan, fromDayId, k));
}

/** Advance the cursor after a completed workout (immutable). */
export function advanceCursor(state: TrainingState, planId: Id): TrainingState {
  const plan = state.plans[planId];
  const current = state.cursors[planId] ?? orderedDays(plan)[0].id;
  return {
    ...state,
    cursors: { ...state.cursors, [planId]: nextDay(plan, current).id },
  };
}

/* ------------------------------------------------------------------ */

export function blocksInOrder(day: TrainingDay): ExerciseBlock[] {
  return [...day.blocks].sort((a, b) => a.order - b.order);
}

/** "3 x 20 reps (5 s hold) per side" or "3 x 1:00 min". */
export function formatBlock(block: ExerciseBlock, exercise: Exercise): string {
  const side = exercise.perSide ? ' per side' : '';
  return `${block.sets} x ${formatTarget(block.target)}${side}`;
}

export function formatTarget(target: Target): string {
  if (isRepTarget(target)) {
    const hold = target.holdSeconds ? ` (${target.holdSeconds} s hold)` : '';
    return `${target.reps} reps${hold}`;
  }
  return formatSeconds(target.seconds);
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')} min` : `${s} s`;
}

/** Rough duration estimate of a day in seconds (rest periods included). */
export function estimateDuration(
  day: TrainingDay,
  exercises: Record<Id, Exercise>,
  secondsPerRep = 3,
): number {
  return blocksInOrder(day).reduce((sum, b) => {
    const perSide = exercises[b.exerciseId]?.perSide ? 2 : 1;
    const work = isRepTarget(b.target)
      ? b.target.reps * (secondsPerRep + (b.target.holdSeconds ?? 0))
      : b.target.seconds;
    return sum + b.sets * perSide * (work + (b.restSeconds ?? 45));
  }, 0);
}

/* ------------------------------------------------------------------ */

/** Create an empty session from a day (all sets still open). */
export function createSession(
  plan: TrainingPlan,
  day: TrainingDay,
  now: Date = new Date(),
  id: Id = crypto.randomUUID(),
): WorkoutSession {
  const results: BlockResult[] = blocksInOrder(day).map((b) => ({
    blockId: b.id,
    exerciseId: b.exerciseId,
    sets: Array.from({ length: b.sets }, (_, setIndex) => ({
      setIndex,
      completed: false,
    })),
  }));

  return {
    id,
    planId: plan.id,
    dayId: day.id,
    dayName: day.name,
    status: day.restDay ? 'rest' : 'planned',
    startedAt: now.toISOString(),
    results,
  };
}

/** Progress 0..1 of a running session. */
export function sessionProgress(session: WorkoutSession): number {
  const all = session.results.flatMap((r) => r.sets);
  if (all.length === 0) return 0;
  return all.filter((s) => s.completed).length / all.length;
}

/** Most recent session for a day – handy for "what you managed last time". */
export function lastSessionForDay(
  sessions: WorkoutSession[],
  dayId: Id,
): WorkoutSession | undefined {
  return sessions
    .filter((s) => s.dayId === dayId && s.status === 'done')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
}
