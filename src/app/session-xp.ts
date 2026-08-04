/**
 * Session mechanics for the "Heute" screen.
 *
 * Every number here comes out of `ranks.ts` – `blockXp` is the single source of
 * the curve. The only thing this module adds is the *live* view the UI needs:
 * `sessionXp()` returns 0 for anything that is not `done`/`rest`, while the
 * Tagesbeute counter has to tick with every checked set.
 *
 * Pure, immutable, no framework imports.
 */

import type { BlockResult, Id, WorkoutSession } from '@/model/training';
import { DAY_XP, REST_XP, blockXp, maxSets, splitEqually } from '@/model/ranks';

/** Planned set count of a result; sessions persisted before `plannedSets`
 *  existed fall back to the number of set entries. */
export function plannedSetsOf(result: BlockResult): number {
  return result.plannedSets ?? result.sets.length;
}

export function doneSetsOf(result: BlockResult): number {
  return result.sets.filter((s) => s.completed).length;
}

/** How many sets beyond the target have been booked on this block. */
export function extraSetsOf(result: BlockResult): number {
  return Math.max(0, result.sets.length - plannedSetsOf(result));
}

/** Every planned set of every block is checked. */
export function isComplete(session: WorkoutSession): boolean {
  if (session.status === 'rest') return true;
  if (session.results.length === 0) return false;
  return session.results.every((r) => doneSetsOf(r) >= plannedSetsOf(r));
}

/**
 * The day's XP budget split across the session's blocks.
 *
 * A block's base is not derivable from the block itself – it depends on how
 * many blocks share the day – so the UI has to carry it down alongside the
 * result.
 */
export function blockBasesOf(session: WorkoutSession): number[] {
  return splitEqually(DAY_XP, session.results.length);
}

/**
 * XP of a session as it stands right now.
 *
 * The design has no "finish day" button, so there is nothing to book at the
 * end: "finishing pays" sits in the kink of the completion curve at the target,
 * which the running total picks up the moment the last planned set is checked –
 * and gives back when one is unchecked.
 */
export function liveSessionXp(session: WorkoutSession): number {
  if (session.status === 'rest') return REST_XP;

  const bases = blockBasesOf(session);
  return session.results.reduce(
    (sum, r, i) => sum + blockXp(doneSetsOf(r), plannedSetsOf(r), bases[i]),
    0,
  );
}

/** XP of one block as it stands right now. */
export function liveBlockXp(result: BlockResult, base: number): number {
  return blockXp(doneSetsOf(result), plannedSetsOf(result), base);
}

/**
 * Cumulative XP after each set pill, planned sets first, then the extra sets up
 * to `maxSets()`: three planned sets on a base of 40 yield `[6, 16, 40, 44, 46]`.
 */
export function pillTotals(planned: number, base: number): number[] {
  return Array.from({ length: maxSets(planned) }, (_, i) =>
    blockXp(i + 1, planned, base),
  );
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function withResult(
  session: WorkoutSession,
  blockId: Id,
  map: (r: BlockResult) => BlockResult,
): WorkoutSession {
  return {
    ...session,
    results: session.results.map((r) => (r.blockId === blockId ? map(r) : r)),
  };
}

/**
 * Tap on set pill *k* (1-based).
 *
 * Set pills are not checkboxes: tapping the last checked set unchecks it,
 * tapping any other set checks everything up to it. Extra sets exist only as
 * long as they are done – dropping below the target trims them away, otherwise
 * an unchecked overflow set would block `withExtraSet()` forever.
 */
export function setDoneCount(
  session: WorkoutSession,
  blockId: Id,
  k: number,
): WorkoutSession {
  const result = session.results.find((r) => r.blockId === blockId);
  if (!result) return session;

  const current = doneSetsOf(result);
  const target = Math.max(0, current === k ? k - 1 : k);
  if (target === current) return session;

  return withResult(session, blockId, (r) => {
    const planned = plannedSetsOf(r);
    const length = Math.max(planned, target);
    return {
      ...r,
      plannedSets: planned,
      sets: Array.from({ length }, (_, setIndex) => ({
        ...r.sets[setIndex],
        setIndex,
        completed: setIndex < target,
      })),
    };
  });
}

/** Status a session should carry given its current results. */
export function statusFor(session: WorkoutSession): WorkoutSession['status'] {
  if (session.status === 'rest') return 'rest';
  if (isComplete(session)) return 'done';
  return session.results.some((r) => doneSetsOf(r) > 0) ? 'inProgress' : 'planned';
}
