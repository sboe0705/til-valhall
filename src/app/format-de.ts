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

/**
 * `60 s`, `45 s` – one unit for every duration the plan prescribes.
 *
 * Holds and duration targets sit on the same line and in the same column, so
 * they are read against each other; a `1:00 Min` next to a `5 s` made the two
 * look like different kinds of number. Seconds win because that is the scale a
 * set is held or timed in – minutes stay for the *day* estimate
 * (`estimateMinutes`), which is a different order of magnitude.
 */
export function secondsDe(total: number): string {
  return `${total} s`;
}

/**
 * The per-set spec of a target: `60 s`, `5 s pro Wdh. halten`, or nothing at
 * all for plain repetitions.
 *
 * Rep counts are deliberately not printed: how many repetitions a set is worth
 * is the trainee's call, not the plan's – XP never depended on them either
 * (only on the *share* of the planned sets that is done). `Target.reps` stays
 * in the model because `estimateDuration()` grades the "geschätzt N Min" line
 * against it. A hold is a real prescription and survives, phrased per rep.
 */
export function targetDe(target: Target): string {
  if (isRepTarget(target)) {
    return target.holdSeconds ? `${target.holdSeconds} s pro Wdh. halten` : '';
  }
  return secondsDe(target.seconds);
}

/**
 * The spec line of a block – `60 s pro Seite`, `beide Seiten`,
 * `beide Seiten · 5 s pro Wdh. halten`, or the empty string when there is
 * nothing left to prescribe.
 *
 * Without the set count: every screen that shows this line prints the number of
 * sets right next to it (the day box's `3 Sätze`, Heute's set pills, the draft
 * panel's stepper), so a leading `3 ×` would only say it twice. Callers must
 * therefore expect an empty line and skip it.
 *
 * A duration is per side and reads as one phrase (`60 s pro Seite`). A rep
 * block no longer carries a number the side could attach to, so there it says
 * `beide Seiten` – an instruction rather than a unit.
 */
export function blockDe(
  block: Pick<ExerciseBlock, 'target'>,
  exercise?: Exercise,
): string {
  const spec = targetDe(block.target);
  if (!exercise?.perSide) return spec;
  if (!isRepTarget(block.target)) return `${spec} pro Seite`;
  return ['beide Seiten', spec].filter(Boolean).join(' · ');
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
