import { describe, expect, it } from 'vitest';

import { defaultPlan, weeklyPlan } from '@/data/default-plan';
import { createSession } from '@/model/plan-cycle';
import { REST_XP, potentialXp, sessionXp, withExtraSet } from '@/model/ranks';
import {
  blockBasesOf,
  extraSetsOf,
  isComplete,
  liveSessionXp,
  pillTotals,
  plannedSetsOf,
  setDoneCount,
  statusFor,
} from './session-xp';

const AUG = new Date(2026, 7, 2);
const day1 = defaultPlan.days[0]; // 3 blocks × 3 sets → 120 XP, 40 per block
const fresh = () => createSession(defaultPlan, day1, AUG, 'test-session');

/** Check `count` sets on every block of the session. */
function checkAll(count: number) {
  return day1.blocks.reduce((s, b) => setDoneCount(s, b.id, count), fresh());
}

describe('planned sets', () => {
  it('createSession records the target, so a 4th set is not a target of four', () => {
    const session = fresh();
    expect(session.results.map(plannedSetsOf)).toEqual([3, 3, 3]);
    expect(session.results.map(extraSetsOf)).toEqual([0, 0, 0]);
  });
});

describe('block bases', () => {
  it('splits the day across the session’s blocks', () => {
    expect(blockBasesOf(fresh())).toEqual([40, 40, 40]);
  });
});

describe('pillTotals', () => {
  it('three planned sets plus the extra sets up to the ceiling', () => {
    expect(pillTotals(3, 40)).toEqual([6, 16, 40, 44, 46]);
  });

  it('scales with the base and stops where maxSets does', () => {
    expect(pillTotals(3, 120)).toEqual([18, 48, 120, 132, 138]);
    expect(pillTotals(5, 40)).toHaveLength(8);
  });
});

describe('liveSessionXp', () => {
  it('is zero while nothing is checked', () => {
    expect(liveSessionXp(fresh())).toBe(0);
  });

  it('counts partial blocks along the curve', () => {
    // A third of each block: 6 + 6 + 6.
    expect(liveSessionXp(checkAll(1))).toBe(18);
    expect(isComplete(checkAll(1))).toBe(false);
  });

  it('reaches the full day the moment the last planned set is checked', () => {
    const done = checkAll(3);
    expect(isComplete(done)).toBe(true);
    expect(liveSessionXp(done)).toBe(potentialXp(day1));
    expect(liveSessionXp(done)).toBe(120);
  });

  it('agrees with sessionXp once the session is closed', () => {
    const done = { ...checkAll(3), status: 'done' as const };
    expect(liveSessionXp(done)).toBe(sessionXp(done));
  });

  it('a rest day is a flat rate', () => {
    const rest = createSession(weeklyPlan, weeklyPlan.days[4], AUG, 'rest');
    expect(liveSessionXp(rest)).toBe(REST_XP);
  });
});

describe('set pill semantics', () => {
  it('tapping the last checked set unchecks it – never a plain toggle', () => {
    const three = setDoneCount(fresh(), 'b-1-1', 3);
    expect(three.results[0].sets.filter((s) => s.completed)).toHaveLength(3);

    const two = setDoneCount(three, 'b-1-1', 3);
    expect(two.results[0].sets.filter((s) => s.completed)).toHaveLength(2);
  });

  it('tapping any other set checks up to it', () => {
    const one = setDoneCount(setDoneCount(fresh(), 'b-1-1', 3), 'b-1-1', 1);
    expect(one.results[0].sets.map((s) => s.completed)).toEqual([true, false, false]);
  });

  it('gives the XP back when a set is unchecked', () => {
    const done = checkAll(3);
    const undone = setDoneCount(done, 'b-1-2', 3);
    // One block drops from the top of the curve back to two thirds: 40 → 16.
    expect(liveSessionXp(undone)).toBe(120 - 40 + 16);
    expect(isComplete(undone)).toBe(false);
  });

  it('drops an extra set again when the block falls below its target', () => {
    const done = checkAll(3);
    const extra = withExtraSet(done, 'b-1-1');
    expect(extraSetsOf(extra.results[0])).toBe(1);
    expect(liveSessionXp(extra)).toBe(120 + 4);

    // Unchecking back to two sets must not leave an open overflow set behind,
    // which would block withExtraSet() forever.
    const back = setDoneCount(extra, 'b-1-1', 2);
    expect(back.results[0].sets).toHaveLength(3);
    expect(extraSetsOf(back.results[0])).toBe(0);
  });

  it('ignores unknown blocks and no-op taps', () => {
    const session = fresh();
    expect(setDoneCount(session, 'nope', 2)).toBe(session);
    expect(setDoneCount(session, 'b-1-1', 0)).toBe(session);
  });
});

describe('statusFor', () => {
  it('walks planned → inProgress → done', () => {
    expect(statusFor(fresh())).toBe('planned');
    expect(statusFor(checkAll(1))).toBe('inProgress');
    expect(statusFor(checkAll(3))).toBe('done');
  });

  it('leaves rest sessions alone', () => {
    expect(statusFor(createSession(weeklyPlan, weeklyPlan.days[4], AUG, 'r'))).toBe(
      'rest',
    );
  });
});
