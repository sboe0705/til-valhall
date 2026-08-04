/**
 * Chronicle derivations – what was actually done, per calendar day.
 *
 * Sessions carry their own `dayId`/`dayName` snapshot, so history stays correct
 * across plan edits. Nothing here is stored; everything is derived from
 * `state.sessions` and the plan.
 */

import type { TrainingPlan, WorkoutSession } from '@/model/training';
import { SCOPE_MAX } from '@/model/ranks';
import { isWeekly, isoWeekday, toIsoDate } from '@/model/schedule';
import { doneSetsOf, isComplete, liveSessionXp, plannedSetsOf } from './session-xp';

export type DayStatus = 'done' | 'partial' | 'missed' | 'open' | 'future';

export interface DayEntry {
  /** `YYYY-MM-DD`, local. */
  date: string;
  day: number;
  session: WorkoutSession | null;
  status: DayStatus;
  xp: number;
  doneSets: number;
  totalSets: number;
}

/** Latest session per calendar day, keyed by local ISO date. */
export function sessionsByDate(sessions: WorkoutSession[]): Map<string, WorkoutSession> {
  const byDate = new Map<string, WorkoutSession>();
  for (const session of [...sessions].sort((a, b) =>
    a.startedAt < b.startedAt ? -1 : 1,
  )) {
    byDate.set(toIsoDate(new Date(session.startedAt)), session);
  }
  return byDate;
}

/**
 * Was anything scheduled on that date?
 *
 * Weekly plans answer this from the weekday. A cyclic plan rotates once per
 * calendar day, so every date carries a day – a rest day is still a day.
 */
export function isScheduled(plan: TrainingPlan, date: Date): boolean {
  if (!isWeekly(plan.schedule)) return plan.days.length > 0;
  return plan.schedule.assignments[isoWeekday(date)] !== null;
}

function statusOf(
  plan: TrainingPlan,
  date: Date,
  today: Date,
  session: WorkoutSession | null,
): DayStatus {
  const iso = toIsoDate(date);
  const todayIso = toIsoDate(today);

  if (session) {
    if (session.status === 'rest' || isComplete(session)) return 'done';
    if (session.results.some((r) => doneSetsOf(r) > 0)) return 'partial';
  }
  if (iso > todayIso) return 'future';
  if (iso === todayIso) return 'open';
  return isScheduled(plan, date) ? 'missed' : 'open';
}

function countSets(session: WorkoutSession | null): { done: number; total: number } {
  if (!session) return { done: 0, total: 0 };
  return session.results.reduce(
    (acc, r) => ({ done: acc.done + doneSetsOf(r), total: acc.total + plannedSetsOf(r) }),
    { done: 0, total: 0 },
  );
}

/** One entry per calendar day of the month `month` falls into. */
export function monthEntries(
  month: Date,
  plan: TrainingPlan,
  sessions: WorkoutSession[],
  today: Date = new Date(),
): DayEntry[] {
  const byDate = sessionsByDate(sessions);
  const year = month.getFullYear();
  const m = month.getMonth();
  const length = new Date(year, m + 1, 0).getDate();

  return Array.from({ length }, (_, i) => {
    const date = new Date(year, m, i + 1);
    const iso = toIsoDate(date);
    const session = byDate.get(iso) ?? null;
    const sets = countSets(session);

    return {
      date: iso,
      day: i + 1,
      session,
      status: statusOf(plan, date, today, session),
      xp: session ? liveSessionXp(session) : 0,
      doneSets: sets.done,
      totalSets: sets.total,
    };
  });
}

export interface MonthStats {
  trainedDays: number;
  totalDays: number;
  xp: number;
  /** 0..1 against `SCOPE_MAX.month`, clamped like `TierProgress.completion`. */
  share: number;
}

/**
 * The month against the monthly ladder's reference value.
 *
 * `SCOPE_MAX.month` is nominal (30 × 120), so a gapless 31-day month yields
 * 3720 – hence the clamp, exactly as `tierProgress()` clamps `completion`.
 */
export function monthStats(entries: DayEntry[]): MonthStats {
  const xp = entries.reduce((sum, e) => sum + e.xp, 0);

  return {
    trainedDays: entries.filter((e) => e.status === 'done' || e.status === 'partial')
      .length,
    totalDays: entries.length,
    xp,
    share: Math.min(xp / SCOPE_MAX.month, 1),
  };
}

/** Number of leading blanks before the 1st, Monday-first. */
export function leadingBlanks(month: Date): number {
  return isoWeekday(new Date(month.getFullYear(), month.getMonth(), 1)) - 1;
}

/** `2026-08` – for clamping the month stepper at the current month. */
export function monthCursor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
