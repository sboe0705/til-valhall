/**
 * German presentation layer.
 *
 * The model formats in English (`formatBlock`, `formatSeconds`) and stays that
 * way – it is the framework-free core, not a view. Everything the screens print
 * lives here, so a second language would only need a sibling of this module.
 */

import type {
  Exercise,
  ExerciseBlock,
  Id,
  MuscleGroup,
  Target,
  TrainingDay,
  Weekday,
} from '@/model/training';
import type { RankScope } from '@/model/ranks';
import { isRepTarget } from '@/model/training';
import { estimateDuration } from '@/model/plan-cycle';

export const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** ISO order: index 0 = Monday. */
export const WEEKDAYS_DE = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

export const WEEKDAYS_SHORT_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export const MUSCLE_DE: Record<MuscleGroup, string> = {
  core: 'Rumpf',
  chest: 'Brust',
  back: 'Rücken',
  shoulders: 'Schultern',
  arms: 'Arme',
  legs: 'Beine',
  fullBody: 'Ganzkörper',
};

export const weekdayLabel = (wd: Weekday): string => WEEKDAYS_DE[wd - 1];
export const weekdayShort = (wd: Weekday): string => WEEKDAYS_SHORT_DE[wd - 1];
export const monthLabel = (date: Date): string =>
  `${MONTHS_DE[date.getMonth()]} ${date.getFullYear()}`;

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** `Sonntag, 2. August` */
export function dateLong(date: Date): string {
  const wd = WEEKDAYS_DE[(date.getDay() + 6) % 7];
  return `${wd}, ${date.getDate()}. ${MONTHS_DE[date.getMonth()]}`;
}

/** `Di, 14. Juli` */
export function dateShort(date: Date): string {
  const wd = WEEKDAYS_SHORT_DE[(date.getDay() + 6) % 7];
  return `${wd}, ${date.getDate()}. ${MONTHS_DE[date.getMonth()]}`;
}

/** `12. Juli` */
export function dayAndMonth(date: Date): string {
  return `${date.getDate()}. ${MONTHS_DE[date.getMonth()]}`;
}

/**
 * A closed period, as stored in `RankState.history`:
 * `2026-W30` → `KW 30 · 2026`, `2026-07` → `Juli 2026`, `2025` → `Jahr 2025`.
 */
export function periodLabel(scope: RankScope, period: string): string {
  if (scope === 'week') {
    const [year, week] = period.split('-W');
    return week ? `KW ${Number(week)} · ${year}` : period;
  }
  if (scope === 'month') {
    const [year, month] = period.split('-');
    const index = Number(month) - 1;
    return MONTHS_DE[index] ? `${MONTHS_DE[index]} ${year}` : period;
  }
  return `Jahr ${period}`;
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** `3190` → `3.190` */
export function thousands(value: number): string {
  return Math.round(value).toLocaleString('de-DE');
}

export const xp = (value: number): string => `${thousands(value)} XP`;

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/* ------------------------------------------------------------------ */
/* Plan content                                                        */
/* ------------------------------------------------------------------ */

/** `1:00 Min`, `45 s` */
export function secondsDe(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s} s`;
}

/** `20 Wdh.`, `20 Wdh. (5 s halten)`, `1:00 Min` */
export function targetDe(target: Target): string {
  if (isRepTarget(target)) {
    const hold = target.holdSeconds ? ` (${target.holdSeconds} s halten)` : '';
    return `${target.reps} Wdh.${hold}`;
  }
  return secondsDe(target.seconds);
}

/** `3 × 20 Wdh. pro Seite`, `3 × 1:00 Min` */
export function blockDe(block: ExerciseBlock, exercise?: Exercise): string {
  const side = exercise?.perSide ? ' pro Seite' : '';
  return `${block.sets} × ${targetDe(block.target)}${side}`;
}

/** `Rücken · Arme` */
export function musclesDe(exercise?: Exercise): string {
  return (exercise?.muscleGroups ?? []).map((m) => MUSCLE_DE[m]).join(' · ');
}

/** Upper-bound estimate in whole minutes – `estimateDuration` doubles the rest
 *  time of `perSide` exercises on purpose. */
export function estimateMinutes(
  day: TrainingDay,
  exercises: Record<Id, Exercise>,
): number {
  return Math.round(estimateDuration(day, exercises) / 60);
}

/** `Tag 2 · Druck`, or `Ruhetag` – day numbers are positional, never stored. */
export function dayTitle(day: TrainingDay, number: number | null): string {
  if (day.restDay) return day.name || 'Ruhetag';
  return number === null ? day.name : `Tag ${number} · ${day.name}`;
}
