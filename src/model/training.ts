/**
 * Data model for a cyclic (periodic) training plan.
 * Pure types + type guards – no framework dependencies.
 */

export type Id = string;

export type MuscleGroup =
  | 'core'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'fullBody';

/** Master data of an exercise – independent of sets/reps. */
export interface Exercise {
  id: Id;
  name: string;
  muscleGroups: MuscleGroup[];
  /** true = the target applies per side of the body (e.g. archer pulls). */
  perSide: boolean;
  description?: string;
  /** e.g. "Pull-up bar", "Resistance band" */
  equipment?: string[];
  archived?: boolean;
}

/**
 * Target per set. A discriminated union so that "20 reps with a 5 s hold"
 * and "hold for 1 minute" stay cleanly distinguishable.
 */
export type Target =
  | { kind: 'reps'; reps: number; holdSeconds?: number }
  | { kind: 'duration'; seconds: number };

/** One line of a training day: exercise + set/rep target. */
export interface ExerciseBlock {
  id: Id;
  exerciseId: Id;
  /** Number of sets (the "3" in 3 x 20). */
  sets: number;
  target: Target;
  /** Position within the day, ascending. */
  order: number;
  restSeconds?: number;
  note?: string;
}

/**
 * A training or rest day.
 * `order` determines the position within a cyclic plan.
 * Rest days are first-class days (with `blocks: []`) so that they rotate
 * along with the cycle and show up in the history.
 */
export interface TrainingDay {
  id: Id;
  name: string;
  order: number;
  blocks: ExerciseBlock[];
  restDay?: boolean;
}

/** Monday = 1 … Sunday = 7 (ISO-8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** `null` = no training scheduled on that weekday. */
export type WeekdayAssignments = Record<Weekday, Id | null>;

/**
 * How days are mapped onto the calendar.
 * - `cyclic`: rotation through `days`, independent of the weekday (cursor driven).
 * - `weekly`: fixed weekday → day mapping, e.g. weekends off.
 */
export type PlanSchedule =
  | { kind: 'cyclic' }
  | { kind: 'weekly'; assignments: WeekdayAssignments };

/** The plan itself: `days` = definition, `schedule` = mapping onto the calendar. */
export interface TrainingPlan {
  id: Id;
  name: string;
  schedule: PlanSchedule;
  days: TrainingDay[];
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/* ------------------------------------------------------------------ */
/* Execution / history                                                 */
/* ------------------------------------------------------------------ */

export interface SetResult {
  /** Zero-based index within the block. */
  setIndex: number;
  completed: boolean;
  /** Actual performance, if it deviated from the target. */
  actualReps?: number;
  actualSeconds?: number;
  /** Optional added weight in kg. */
  weightKg?: number;
}

export interface BlockResult {
  blockId: Id;
  exerciseId: Id;
  sets: SetResult[];
  note?: string;
}

export type SessionStatus =
  | 'planned'
  | 'inProgress'
  | 'done'
  | 'skipped'
  | 'rest';

/** A concrete workout on a given date. */
export interface WorkoutSession {
  id: Id;
  planId: Id;
  dayId: Id;
  /** Snapshot of the day's name – the plan may change later on. */
  dayName: string;
  status: SessionStatus;
  startedAt: string;
  finishedAt?: string;
  results: BlockResult[];
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Persistence root                                                    */
/* ------------------------------------------------------------------ */

/** Everything that gets serialised (localStorage, IndexedDB, backend JSON). */
export interface TrainingState {
  schemaVersion: 1;
  exercises: Record<Id, Exercise>;
  plans: Record<Id, TrainingPlan>;
  activePlanId: Id | null;
  sessions: WorkoutSession[];
  /**
   * Pointer to the day that is up next – only relevant for
   * `schedule.kind === 'cyclic'`. For weekly plans the day follows from the date.
   */
  cursors: Record<Id, Id>;
}

/* ------------------------------------------------------------------ */
/* Type guards                                                         */
/* ------------------------------------------------------------------ */

export const isRepTarget = (
  t: Target,
): t is Extract<Target, { kind: 'reps' }> => t.kind === 'reps';

export const isDurationTarget = (
  t: Target,
): t is Extract<Target, { kind: 'duration' }> => t.kind === 'duration';
