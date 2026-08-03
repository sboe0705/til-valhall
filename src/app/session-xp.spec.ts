import { describe, expect, it } from 'vitest';

import { defaultPlan, weeklyPlan } from '@/data/default-plan';
import { createSession } from '@/model/plan-cycle';
import { DEFAULT_XP, potentialXp, sessionXp, withExtraSet } from '@/model/ranks';
import {
  extraSetsOf,
  isComplete,
  liveSessionXp,
  pillTotals,
  plannedSetsOf,
  setDoneCount,
  statusFor,
} from './session-xp';

const AUG = new Date(2026, 7, 2);
const day1 = defaultPlan.days[0]; // 3 blocks × 3 sets = 140 XP
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

describe('pillTotals', () => {
  it('three planned sets plus the overflow ceiling', () => {
    expect(pillTotals(3)).toEqual([5, 12, 30, 38, 41]);
  });

  it('interpolates for other set counts', () => {
    expect(pillTotals(5).slice(0, 5)).toEqual([5, 10, 18, 32, 50]);
  });
});

describe('liveSessionXp', () => {
  it('is zero while nothing is checked', () => {
    expect(liveSessionXp(fresh())).toBe(0);
  });

  it('counts partial blocks without the day bonus', () => {
    // 5 + 5 + 5, no bonus
    expect(liveSessionXp(checkAll(1))).toBe(15);
    expect(isComplete(checkAll(1))).toBe(false);
  });

  it('books the day bonus implicitly on the last planned set', () => {
    const done = checkAll(3);
    expect(isComplete(done)).toBe(true);
    expect(liveSessionXp(done)).toBe(potentialXp(day1));
    expect(liveSessionXp(done)).toBe(140);
  });

  it('agrees with sessionXp once the session is closed', () => {
    const done = { ...checkAll(3), status: 'done' as const };
    expect(liveSessionXp(done)).toBe(sessionXp(done));
  });

  it('a rest day is a flat rate', () => {
    const rest = createSession(weeklyPlan, weeklyPlan.days[4], AUG, 'rest');
    expect(liveSessionXp(rest)).toBe(DEFAULT_XP.restDay);
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

  it('revokes the day bonus when a set is unchecked', () => {
    const done = checkAll(3);
    const undone = setDoneCount(done, 'b-1-2', 3);
    expect(liveSessionXp(undone)).toBe(140 - DEFAULT_XP.dayCompleted - 30 + 12);
    expect(isComplete(undone)).toBe(false);
  });

  it('drops an extra set again when the block falls below its target', () => {
    const done = checkAll(3);
    const extra = withExtraSet(done, 'b-1-1');
    expect(extraSetsOf(extra.results[0])).toBe(1);
    expect(liveSessionXp(extra)).toBe(140 + 8);

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
