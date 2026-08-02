import type {
  Id,
  PlanSchedule,
  TrainingDay,
  TrainingPlan,
  TrainingState,
  Weekday,
  WeekdayAssignments,
} from './training';
import { orderedDays, nextDay } from './plan-cycle';

/* ------------------------------------------------------------------ */
/* Weekdays                                                            */
/* ------------------------------------------------------------------ */

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/** JS `getDay()` (0 = Sun) → ISO weekday (1 = Mon … 7 = Sun). */
export function isoWeekday(date: Date): Weekday {
  return ((date.getDay() + 6) % 7 + 1) as Weekday;
}

/** Empty assignment – no training on any weekday. */
export function emptyAssignments(): WeekdayAssignments {
  return { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };
}

export const isWeekly = (
  s: PlanSchedule,
): s is Extract<PlanSchedule, { kind: 'weekly' }> => s.kind === 'weekly';

/* ------------------------------------------------------------------ */
/* Resolving date → day                                                */
/* ------------------------------------------------------------------ */

export interface AgendaEntry {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  weekday: Weekday;
  /** `null` = no training scheduled (weekly plan without an assignment). */
  day: TrainingDay | null;
  /** true when `day === null` or `day.restDay`. */
  isRest: boolean;
}

/**
 * Local date as `YYYY-MM-DD`.
 * Deliberately **not** via `toISOString()`: that converts to UTC and, east of
 * Greenwich (e.g. CET/CEST), returns the previous day for local midnight.
 */
export function toIsoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function findDay(plan: TrainingPlan, dayId: Id | null): TrainingDay | null {
  return dayId ? plan.days.find((d) => d.id === dayId) ?? null : null;
}

/**
 * Which day is up on a given date?
 *
 * - Weekly plan: follows directly from the weekday.
 * - Cyclic plan: the cursor determines the next day; the date is irrelevant,
 *   so the cursor's day is returned.
 */
export function dayForDate(
  plan: TrainingPlan,
  date: Date,
  cursorDayId?: Id,
): TrainingDay | null {
  if (isWeekly(plan.schedule)) {
    return findDay(plan, plan.schedule.assignments[isoWeekday(date)]);
  }
  return findDay(plan, cursorDayId ?? orderedDays(plan)[0]?.id ?? null);
}

/** Like `dayForDate`, but straight from the state (cursor included). */
export function dayForDateInState(
  state: TrainingState,
  planId: Id,
  date: Date = new Date(),
): TrainingDay | null {
  const plan = state.plans[planId];
  return dayForDate(plan, date, state.cursors[planId]);
}

/**
 * Calendar preview across `count` days starting at `from` – works for both
 * plan types and makes rest days explicitly visible.
 */
export function agenda(
  plan: TrainingPlan,
  from: Date,
  count: number,
  cursorDayId?: Id,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  let cyclicDay = findDay(plan, cursorDayId ?? orderedDays(plan)[0]?.id ?? null);

  for (let i = 0; i < count; i++) {
    const date = addDays(from, i);
    let day: TrainingDay | null;

    if (isWeekly(plan.schedule)) {
      day = findDay(plan, plan.schedule.assignments[isoWeekday(date)]);
    } else {
      day = cyclicDay;
      // The cycle advances once per calendar day (scheduled rest days included).
      cyclicDay = cyclicDay ? nextDay(plan, cyclicDay.id) : null;
    }

    entries.push({
      date: toIsoDate(date),
      weekday: isoWeekday(date),
      day,
      isRest: day === null || day.restDay === true,
    });
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* Editing                                                             */
/* ------------------------------------------------------------------ */

/** Assign a day to a weekday, or clear it with `null` (immutable). */
export function assignWeekday(
  plan: TrainingPlan,
  weekday: Weekday,
  dayId: Id | null,
): TrainingPlan {
  if (!isWeekly(plan.schedule)) return plan;
  return {
    ...plan,
    schedule: {
      kind: 'weekly',
      assignments: { ...plan.schedule.assignments, [weekday]: dayId },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Switch between cyclic ⇄ weekly; `days` is preserved unchanged. */
export function convertSchedule(
  plan: TrainingPlan,
  kind: PlanSchedule['kind'],
): TrainingPlan {
  if (plan.schedule.kind === kind) return plan;

  if (kind === 'cyclic') {
    return { ...plan, schedule: { kind: 'cyclic' }, updatedAt: new Date().toISOString() };
  }

  // Lay the cycle out from Monday onwards, weekend off.
  const days = orderedDays(plan);
  const assignments = emptyAssignments();
  ([1, 2, 3, 4, 5] as Weekday[]).forEach((wd, i) => {
    assignments[wd] = days[i]?.id ?? null;
  });

  return {
    ...plan,
    schedule: { kind: 'weekly', assignments },
    updatedAt: new Date().toISOString(),
  };
}

/** Sanity check – e.g. for a plan editor. */
export function validatePlan(plan: TrainingPlan): string[] {
  const errors: string[] = [];
  const ids = new Set(plan.days.map((d) => d.id));

  if (plan.days.length === 0) errors.push('The plan contains no days.');

  if (isWeekly(plan.schedule)) {
    for (const wd of WEEKDAYS) {
      const id = plan.schedule.assignments[wd];
      if (id && !ids.has(id)) {
        errors.push(`${WEEKDAY_LABELS[wd]}: unknown day "${id}".`);
      }
    }
    if (WEEKDAYS.every((wd) => (plan.schedule as any).assignments[wd] === null)) {
      errors.push('No weekday has a training day assigned.');
    }
  } else if (plan.days.every((d) => d.restDay)) {
    errors.push('The cycle consists of rest days only.');
  }

  return errors;
}
