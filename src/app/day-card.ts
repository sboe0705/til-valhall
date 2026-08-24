/**
 * The read-only half of the Plan screen's "day box".
 *
 * `PlanView` owns the editing chrome around it – reorder arrows, the delete
 * button, the open/closed state – while everything the box *says* is derived
 * here: title, meta line, XP and one row per exercise block. The preview under
 * "Tag vollständig" on the Heute screen renders the same shape, so the two
 * cannot drift apart.
 */

import type { Exercise, Id, TrainingDay } from '@/model/training';
import { blocksInOrder } from '@/model/plan-cycle';
import { potentialXp } from '@/model/ranks';
import * as de from './format-de';

export interface DayCardRow {
  name: string;
  target: string;
  setsText: string;
}

export interface DayCard {
  title: string;
  /** `3 Übungen · 9 Sätze`, or the rest day's `kein Block · rotiert mit`. */
  meta: string;
  xpText: string;
  rest: boolean;
  rows: DayCardRow[];
}

/** Day numbers are positional and never stored – pass `null` for a rest day. */
export function dayCard(
  day: TrainingDay,
  number: number | null,
  exercises: Record<Id, Exercise>,
): DayCard {
  const blocks = blocksInOrder(day);
  const sets = blocks.reduce((sum, b) => sum + b.sets, 0);

  return {
    title: de.dayTitle(day, number),
    meta: day.restDay
      ? 'kein Block · rotiert mit'
      : `${blocks.length} Übungen · ${sets} Sätze`,
    xpText: de.xp(potentialXp(day)),
    rest: day.restDay === true,
    rows: blocks.map((block) => {
      const exercise = exercises[block.exerciseId];
      return {
        name: exercise?.name ?? block.exerciseId,
        target: de.blockDe(block, exercise),
        setsText: `${block.sets} Sätze`,
      };
    }),
  };
}
