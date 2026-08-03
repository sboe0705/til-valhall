/**
 * Structural editing of a training plan – the operations the plan screen needs.
 *
 * Same rules as the rest of `src/model`: pure functions, immutable updates, no
 * framework imports. Sits after `schedule.ts` in the dependency chain because a
 * structural change has to keep the weekday assignments consistent.
 */

import type {
  ExerciseBlock,
  Id,
  Target,
  TrainingDay,
  TrainingPlan,
  Weekday,
} from './training';
import { orderedDays } from './plan-cycle';
import { emptyAssignments, isWeekly, WEEKDAYS } from './schedule';

/** Injectable so tests get stable ids; defaults to `crypto.randomUUID()`. */
export type IdFactory = (prefix: string) => Id;

const defaultIds: IdFactory = (prefix) => `${prefix}-${crypto.randomUUID()}`;

/* ------------------------------------------------------------------ */
/* Ordering                                                            */
/* ------------------------------------------------------------------ */

/**
 * Rewrite `order` to 0..n-1 along the current sort order.
 * Ordering is by the explicit field, never by array position – but after an
 * insert or a swap the numbers should stay gapless.
 */
export function reindexOrders(days: TrainingDay[]): TrainingDay[] {
  return [...days]
    .sort((a, b) => a.order - b.order)
    .map((day, order) => (day.order === order ? day : { ...day, order }));
}

/**
 * Positional day numbers: walk the cycle and count training days.
 *
 * Deliberately **derived, never stored** – reordering renumbers the list, the
 * rotation chips and the weekday tiles at once. Rest days map to `null`.
 * Historical sessions keep their own `dayName` snapshot and are unaffected.
 */
export function dayNumbers(plan: TrainingPlan): Map<Id, number | null> {
  let n = 0;
  return new Map(orderedDays(plan).map((d) => [d.id, d.restDay ? null : ++n]));
}

/* ------------------------------------------------------------------ */
/* Weekday assignments                                                 */
/* ------------------------------------------------------------------ */

/**
 * Re-derive the weekday assignments from the day list, starting on Monday –
 * day *i* lands on weekday *i*, days beyond the seventh stay unassigned.
 *
 * Called after every structural change of a weekly plan: otherwise a deleted
 * day would linger in `assignments` and a newly added one would never be
 * scheduled. For up to five days this produces exactly what `convertSchedule`
 * does; beyond that it keeps filling the weekend instead of dropping days.
 *
 * No-op for cyclic plans.
 */
export function syncWeekdays(plan: TrainingPlan, now: Date = new Date()): TrainingPlan {
  if (!isWeekly(plan.schedule)) return plan;

  const days = orderedDays(plan);
  const assignments = emptyAssignments();
  WEEKDAYS.forEach((wd: Weekday, i) => {
    assignments[wd] = days[i]?.id ?? null;
  });

  return {
    ...plan,
    schedule: { kind: 'weekly', assignments },
    updatedAt: now.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Building days                                                       */
/* ------------------------------------------------------------------ */

/** What the draft panel collects before a day exists. */
export interface DayDraft {
  name: string;
  restDay: boolean;
  blocks: Array<{ exerciseId: Id; sets: number; target: Target }>;
}

/** Lowest and highest set count a block may be dialled to in the editor. */
export const MIN_SETS = 1;
export const MAX_SETS = 6;

export const clampSets = (sets: number): number =>
  Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(sets)));

/** Turn a draft into a `TrainingDay`. `order` is assigned by `addDay`. */
export function makeDay(draft: DayDraft, ids: IdFactory = defaultIds): TrainingDay {
  const blocks: ExerciseBlock[] = draft.restDay
    ? []
    : draft.blocks.map((b, order) => ({
        id: ids('b'),
        exerciseId: b.exerciseId,
        sets: clampSets(b.sets),
        target: b.target,
        order,
      }));

  return {
    id: ids('day'),
    name: draft.name.trim(),
    order: 0,
    blocks,
    ...(draft.restDay ? { restDay: true } : {}),
  };
}

/**
 * A sensible target for an exercise that is added from the catalogue: whatever
 * the exercise is already trained with somewhere in the existing plans.
 *
 * Keeps the catalogue free of a second source of truth – `Exercise` carries no
 * default target, and inventing one per exercise would duplicate plan data.
 */
export function defaultTargetFor(plans: TrainingPlan[], exerciseId: Id): Target {
  for (const plan of plans) {
    for (const day of orderedDays(plan)) {
      const block = day.blocks.find((b) => b.exerciseId === exerciseId);
      if (block) return block.target;
    }
  }
  return { kind: 'reps', reps: 10 };
}

/* ------------------------------------------------------------------ */
/* Structural edits                                                    */
/* ------------------------------------------------------------------ */

function withDays(plan: TrainingPlan, days: TrainingDay[], now: Date): TrainingPlan {
  return syncWeekdays(
    { ...plan, days: reindexOrders(days), updatedAt: now.toISOString() },
    now,
  );
}

/** Append a day to the end of the cycle. */
export function addDay(
  plan: TrainingPlan,
  day: TrainingDay,
  now: Date = new Date(),
): TrainingPlan {
  const days = orderedDays(plan);
  return withDays(plan, [...days, { ...day, order: days.length }], now);
}

/**
 * Remove a day. Returns the plan unchanged when it is the last one – a plan
 * without days has no reference value and nothing to rotate.
 */
export function removeDay(
  plan: TrainingPlan,
  dayId: Id,
  now: Date = new Date(),
): TrainingPlan {
  if (plan.days.length <= 1) return plan;
  const days = orderedDays(plan).filter((d) => d.id !== dayId);
  if (days.length === plan.days.length) return plan;
  return withDays(plan, days, now);
}

/**
 * Swap a day with its neighbour (`-1` up, `+1` down). Returns the plan
 * unchanged at the ends. Renumbers the days and, for weekly plans, the week.
 */
export function moveDay(
  plan: TrainingPlan,
  dayId: Id,
  direction: -1 | 1,
  now: Date = new Date(),
): TrainingPlan {
  const days = orderedDays(plan);
  const i = days.findIndex((d) => d.id === dayId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= days.length) return plan;

  const swapped = [...days];
  const moved = swapped[i];
  swapped[i] = swapped[j];
  swapped[j] = moved;

  return withDays(
    plan,
    swapped.map((d, order) => ({ ...d, order })),
    now,
  );
}
