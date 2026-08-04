import { describe, expect, it } from 'vitest';

import { defaultPlan, weeklyPlan } from '../data/default-plan';
import type { BlockResult, TrainingDay, TrainingPlan, WorkoutSession } from './training';
import { createSession, orderedDays } from './plan-cycle';
import { convertSchedule, isoWeekday, toIsoDate } from './schedule';
import {
  DAY_XP,
  MONTHLY_TIERS,
  REST_XP,
  SCOPE_MAX,
  WEEKLY_TIERS,
  YEARLY_TIERS,
  applySession,
  assertLadder,
  blockXp,
  createRankState,
  dayXp,
  maxSets,
  potentialXp,
  resolveTiers,
  rollOver,
  sessionXp,
  splitEqually,
  tierFor,
  tierProgress,
  weekKey,
  weeklyPotential,
  withExtraSet,
} from './ranks';

/** 2026-08-01 is a Saturday – its week runs Jul 27 – Aug 2. */
const AUG = new Date(2026, 7, 1);

function completed(plan: TrainingPlan, day: TrainingDay): WorkoutSession {
  const s = createSession(plan, day, AUG, 'test-session');
  return {
    ...s,
    status: 'done',
    results: s.results.map((r) => ({
      ...r,
      sets: r.sets.map((set) => ({ ...set, completed: true })),
    })),
  };
}

/** A day of `sets.length` blocks with the given targets – for layout maths. */
function dayOf(...sets: number[]): TrainingDay {
  return {
    id: 'synthetic',
    name: 'Synthetic',
    order: 0,
    blocks: sets.map((count, order) => ({
      id: `b-${order}`,
      exerciseId: 'ex',
      sets: count,
      target: { kind: 'reps', reps: 10 },
      order,
    })),
  };
}

function resultsFor(day: TrainingDay, upTo: (planned: number) => number): BlockResult[] {
  return day.blocks.map((b) => ({
    blockId: b.id,
    exerciseId: b.exerciseId,
    plannedSets: b.sets,
    sets: Array.from({ length: upTo(b.sets) }, (_, setIndex) => ({
      setIndex,
      completed: true,
    })),
  }));
}

/** Every planned set checked, no extras. */
const completedResults = (day: TrainingDay) => resultsFor(day, (planned) => planned);

/** Every block driven to its `maxSets()` ceiling. */
const maxedResults = (day: TrainingDay) => resultsFor(day, maxSets);

describe('ladders', () => {
  it.each([
    ['week', WEEKLY_TIERS],
    ['month', MONTHLY_TIERS],
    ['year', YEARLY_TIERS],
  ] as const)('%s is strictly monotonic and starts at 0', (_scope, tiers) => {
    expect(() => assertLadder(tiers)).not.toThrow();
  });

  it('resolves against absolute maxima, not against the plan', () => {
    expect(resolveTiers('week', SCOPE_MAX.week).map((t) => t.minXp)).toEqual([
      0, 210, 420, 630, 840,
    ]);
    expect(resolveTiers('month', SCOPE_MAX.month).map((t) => t.minXp)).toEqual([
      0, 396, 828, 1224, 1620, 2016, 2448, 2844, 3240,
    ]);
    expect(resolveTiers('year', SCOPE_MAX.year).map((t) => t.minXp)).toEqual([
      0, 3456, 6480, 9936, 13392, 16848, 19872, 23328, 26784, 30240, 33264, 36720,
    ]);
  });

  it('without a reference value the lowest tier stands', () => {
    expect(tierFor('year', 0, 0).key).toBe('bragi');
    expect(tierFor('week', 999, 0).key).toBe('drengr');
    expect(tierProgress('week', { period: 'x', xp: 0, max: 0 }).completion).toBe(0);
  });
});

describe('the completion curve', () => {
  it('three planned sets on a base of 40 – a three-block day', () => {
    expect([1, 2, 3, 4, 5].map((c) => blockXp(c, 3, 40))).toEqual([6, 16, 40, 44, 46]);
  });

  it('three planned sets on a base of 120 – a single-block day', () => {
    expect([1, 2, 3, 4, 5].map((c) => blockXp(c, 3, 120))).toEqual([
      18, 48, 120, 132, 138,
    ]);
  });

  it('stops hard at 166 % of the target', () => {
    expect([1, 2, 3, 4, 5, 6].map(maxSets)).toEqual([1, 3, 5, 6, 8, 10]);
    // Past the ceiling the share no longer moves – `maxSets` is what enforces it.
    expect(blockXp(6, 3, 40)).toBe(blockXp(5, 3, 40));
  });

  it('splits the day budget without drift', () => {
    expect(splitEqually(DAY_XP, 3)).toEqual([40, 40, 40]);
    expect(splitEqually(DAY_XP, 7).reduce((a, b) => a + b, 0)).toBe(DAY_XP);
    expect(splitEqually(DAY_XP, 0)).toEqual([]);
  });

  it('a completed day is exactly 120, whatever its layout', () => {
    for (const day of orderedDays(defaultPlan)) {
      if (day.restDay) continue;
      expect(dayXp(day, completedResults(day))).toBe(DAY_XP);
    }
    for (const day of [
      dayOf(1),
      dayOf(2, 5),
      dayOf(3, 3, 3, 3),
      dayOf(...Array(7).fill(3)),
    ]) {
      expect(dayXp(day, completedResults(day))).toBe(DAY_XP);
    }
  });

  it('daily XP of the seed data', () => {
    expect(orderedDays(weeklyPlan).map((d) => potentialXp(d))).toEqual([
      120, 120, 120, 120, 20,
    ]);
  });

  it('a fully completed session equals potentialXp', () => {
    const day = defaultPlan.days[0];
    expect(sessionXp(completed(defaultPlan, day))).toBe(potentialXp(day));
  });

  it('a rest day session counts as a flat rate', () => {
    expect(sessionXp(createSession(weeklyPlan, weeklyPlan.days[4], AUG, 'r'))).toBe(
      REST_XP,
    );
  });

  it('extra sets are capped and only possible once the target is met', () => {
    let s = completed(defaultPlan, defaultPlan.days[0]);
    for (let i = 0; i < 5; i++) s = withExtraSet(s, 'b-1-1');
    expect(s.results[0].sets.length).toBe(maxSets(3));
    // One block of three lifted from 40 to 46; the other two stay at 40.
    expect(sessionXp(s)).toBe(DAY_XP + 6);

    const open = createSession(defaultPlan, defaultPlan.days[0], AUG, 'o');
    expect(withExtraSet(open, 'b-1-1')).toBe(open);
  });
});

describe('extra sets must not replace a training day', () => {
  it('the seed plan maxes out at 138 XP a day, so six days stay under a week', () => {
    for (const day of orderedDays(defaultPlan)) {
      expect(dayXp(day, maxedResults(day))).toBe(138);
    }
    expect(6 * 138).toBeLessThan(SCOPE_MAX.week);
  });

  it('a day of four or more blocks ties the week – the documented exception', () => {
    // 30 × 1.15 = 34.5 rounds up per block, so four blocks reach 140 rather
    // than 138. Six such days hit exactly 840 and therefore Konungr. It takes a
    // 4+ block day plus maximal extras on every block for six days running.
    const wide = dayOf(3, 3, 3, 3);
    expect(dayXp(wide, maxedResults(wide))).toBe(140);
    expect(6 * 140).toBe(SCOPE_MAX.week);
  });
});

describe('what a plan can reach in a week', () => {
  it('a cyclic plan without rest days fills every calendar day', () => {
    expect(weeklyPotential(defaultPlan)).toBe(SCOPE_MAX.week);
    for (const day of orderedDays(defaultPlan)) {
      expect(weeklyPotential(defaultPlan, day.id)).toBe(SCOPE_MAX.week);
    }
  });

  it('a weekday plan cannot reach the weekly maximum', () => {
    expect(weeklyPotential(weeklyPlan)).toBe(500); // 4 × 120 + one rest day
    expect(weeklyPotential(convertSchedule(defaultPlan, 'weekly'))).toBe(480); // Mon–Thu
  });
});

describe('periods', () => {
  it('ISO week keys', () => {
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(weekKey(new Date(2026, 7, 1))).toBe('2026-W31');
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53');
  });

  it('toIsoDate uses local date parts', () => {
    expect(toIsoDate(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(isoWeekday(new Date(2026, 7, 3))).toBe(1);
  });

  it('rollOver archives and is idempotent', () => {
    let ranks = createRankState(AUG);
    expect(ranks.week.max).toBe(SCOPE_MAX.week);

    ranks = applySession(ranks, completed(defaultPlan, defaultPlan.days[0]), AUG);
    expect(ranks.week.xp).toBe(DAY_XP);

    const rolled = rollOver(ranks, new Date(2026, 7, 10));
    expect(rolled.week.xp).toBe(0);
    expect(rolled.history).toHaveLength(1);
    expect(rolled.records.week).toBe('drengr'); // survives the reset – 120 < 210
    expect(rollOver(rolled, new Date(2026, 7, 10))).toEqual(rolled);
  });
});

describe('calibration 2026', () => {
  /** With a flat 120 XP a day the year is arithmetic. */
  const afterDays = (days: number) => tierFor('year', days * DAY_XP, SCOPE_MAX.year).key;

  it('Odin lands on November 2nd of a gapless year', () => {
    const odin = YEARLY_TIERS[YEARLY_TIERS.length - 1];
    const needed = Math.round(odin.share * SCOPE_MAX.year) / DAY_XP;
    expect(needed).toBe(306);
    // Day 306 of 2026 – `new Date(2026, 0, n)` is the nth day of the year.
    expect(toIsoDate(new Date(2026, 0, needed))).toBe('2026-11-02');
    expect(afterDays(365)).toBe('odinn');
    expect(afterDays(306)).toBe('odinn');
    expect(afterDays(305)).toBe('thorr'); // 59 days of slack, not one more
  });

  it('the monthly top leaves room for a rest day in every month length', () => {
    const asgard = Math.round(0.9 * SCOPE_MAX.month);
    expect(asgard / DAY_XP).toBe(27);
    // February is the tight one: 28 gapless days still clear it.
    expect(28 * DAY_XP).toBeGreaterThan(asgard);
    // A rest day costs 100 XP against the ladder – affordable monthly …
    expect(30 * DAY_XP - 100).toBeGreaterThan(asgard);
    // … but never weekly: Konungr still demands all seven days.
    expect(7 * DAY_XP - 100).toBeLessThan(SCOPE_MAX.week);
  });

  it('missing every fifth day drops back to Thor', () => {
    expect(afterDays(365 - 73)).toBe('thorr');
  });
});
