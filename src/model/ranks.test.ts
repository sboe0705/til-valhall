import { describe, expect, it } from 'vitest';

import { defaultPlan, weeklyPlan } from '../data/default-plan';
import type { TrainingDay, TrainingPlan, WorkoutSession } from './training';
import { createSession, nextDay, orderedDays } from './plan-cycle';
import { isoWeekday, toIsoDate } from './schedule';
import {
  DEFAULT_XP,
  MONTHLY_TIERS,
  WEEKLY_TIERS,
  YEARLY_TIERS,
  applySession,
  assertLadder,
  assertOverflowSafe,
  blockXp,
  createRankState,
  overflowHeadroom,
  perfectXp,
  potentialXp,
  resolveTiers,
  rollOver,
  sessionXp,
  tierFor,
  tierProgress,
  weekKey,
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

describe('ladders', () => {
  it.each([
    ['week', WEEKLY_TIERS],
    ['month', MONTHLY_TIERS],
    ['year', YEARLY_TIERS],
  ] as const)('%s is strictly monotonic and starts at 0', (_scope, tiers) => {
    expect(() => assertLadder(tiers)).not.toThrow();
  });

  it('weekly thresholds for a perfect week of the weekly plan', () => {
    expect(
      resolveTiers('week', perfectXp(weeklyPlan, 'week', AUG)).map((t) => t.minXp),
    ).toEqual([0, 98, 221, 353, 490]);
  });

  it('without a reference value the lowest tier stands', () => {
    expect(tierFor('year', 0, 0).key).toBe('bragi');
    expect(tierFor('week', 999, 0).key).toBe('drengr');
    expect(tierProgress('week', { period: 'x', xp: 0, max: 0 }).completion).toBe(0);
  });
});

describe('XP curves', () => {
  it('three-set block including extra sets', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => blockXp(c, 3))).toEqual([
      5, 12, 30, 38, 41, 41, 41,
    ]);
  });

  it('interpolates for differing set counts', () => {
    expect([1, 2, 3, 4, 5].map((c) => blockXp(c, 5))).toEqual([5, 10, 18, 32, 50]);
  });

  it('daily XP of the seed data', () => {
    expect(orderedDays(weeklyPlan).map((d) => potentialXp(d))).toEqual([
      140, 110, 110, 110, 20,
    ]);
  });

  it('a fully completed session equals potentialXp', () => {
    const day = defaultPlan.days[0];
    expect(sessionXp(completed(defaultPlan, day))).toBe(potentialXp(day));
  });

  it('a rest day session counts as a flat rate', () => {
    expect(sessionXp(createSession(weeklyPlan, weeklyPlan.days[4], AUG, 'r'))).toBe(
      DEFAULT_XP.restDay,
    );
  });

  it('extra sets are capped and only possible once the target is met', () => {
    let s = completed(defaultPlan, defaultPlan.days[0]);
    for (let i = 0; i < 5; i++) s = withExtraSet(s, 'b-1-1');
    expect(s.results[0].sets.length).toBe(3 + DEFAULT_XP.overflow.length);
    expect(sessionXp(s)).toBe(potentialXp(defaultPlan.days[0]) + 11);

    const open = createSession(defaultPlan, defaultPlan.days[0], AUG, 'o');
    expect(withExtraSet(open, 'b-1-1')).toBe(open);
  });
});

describe('perfectXp', () => {
  it('weekly plan exactly over calendar days', () => {
    expect(perfectXp(weeklyPlan, 'week', AUG)).toBe(490);
    expect(perfectXp(weeklyPlan, 'month', AUG)).toBe(2100);
    expect(perfectXp(weeklyPlan, 'year', AUG)).toBe(25590);
  });

  it('cyclic plan: exact with a cursor, daily average without one', () => {
    expect(perfectXp(defaultPlan, 'week', AUG, DEFAULT_XP, 'day-1')).toBe(830);
    expect(perfectXp(defaultPlan, 'week', AUG, DEFAULT_XP, 'day-2')).toBe(800);
    expect(perfectXp(defaultPlan, 'week', AUG)).toBe(823);
  });

  it('a gapless week reaches the top tier in every cycle phase', () => {
    for (const start of orderedDays(defaultPlan)) {
      let day = start;
      let xp = 0;
      for (let i = 0; i < 7; i++) {
        xp += potentialXp(day);
        day = nextDay(defaultPlan, day.id);
      }
      const max = perfectXp(defaultPlan, 'week', AUG, DEFAULT_XP, start.id);
      expect(tierFor('week', xp, max).key).toBe('konungr');
    }
  });
});

describe('extra sets must not replace a training day', () => {
  it('the weekly plan is safe with the default curve', () => {
    expect(overflowHeadroom(weeklyPlan, AUG).safe).toBe(true);
    expect(() => assertOverflowSafe(weeklyPlan, AUG)).not.toThrow();
  });

  it('the cyclic plan without a rest day is not', () => {
    expect(overflowHeadroom(defaultPlan, AUG).safe).toBe(false);
    expect(() => assertOverflowSafe(defaultPlan, AUG)).toThrow();
  });

  it('a flatter curve makes the cycle safe as well', () => {
    const cfg = { ...DEFAULT_XP, overflow: [0.15, 0.07] };
    expect(overflowHeadroom(defaultPlan, AUG, cfg).safe).toBe(true);
  });

  it('limit and surcharge refer to the same reference value', () => {
    const { limit, actual } = overflowHeadroom(weeklyPlan, AUG);
    const rest = perfectXp(weeklyPlan, 'week', AUG) - 110; // cheapest training day
    expect(Math.round(limit * rest)).toBe(110);
    expect(Math.round(actual * rest)).toBe(74); // (270 − 60) × 0.35
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
    let ranks = createRankState(weeklyPlan, AUG);
    ranks = applySession(
      ranks,
      completed(defaultPlan, defaultPlan.days[0]),
      weeklyPlan,
      AUG,
    );
    expect(ranks.week.xp).toBe(140);

    const rolled = rollOver(ranks, weeklyPlan, new Date(2026, 7, 10));
    expect(rolled.week.xp).toBe(0);
    expect(rolled.history).toHaveLength(1);
    expect(rolled.records.week).toBe('karl'); // survives the reset
    expect(rollOver(rolled, weeklyPlan, new Date(2026, 7, 10))).toEqual(rolled);
  });
});

describe('year simulation 2026', () => {
  function year(plan: TrainingPlan, skipEvery = 0, cursor?: string) {
    const byId = new Map(plan.days.map((d) => [d.id, d]));
    let cyclic = cursor ? byId.get(cursor)! : orderedDays(plan)[0];
    const max = perfectXp(plan, 'year', new Date(2026, 0, 1), DEFAULT_XP, cursor);
    let xp = 0;
    let odin: string | null = null;
    for (let i = 0; i < 365; i++) {
      const date = new Date(2026, 0, 1 + i);
      let day: TrainingDay | null;
      if (plan.schedule.kind === 'weekly') {
        const id = plan.schedule.assignments[isoWeekday(date)];
        day = id ? (byId.get(id) ?? null) : null;
      } else {
        day = cyclic;
        cyclic = nextDay(plan, cyclic.id);
      }
      // rotating miss – hits every weekday equally often
      const skip =
        skipEvery > 0 && i % skipEvery === Math.floor(i / skipEvery) % skipEvery;
      if (day && !skip) xp += potentialXp(day);
      if (!odin && xp >= Math.round(0.9 * max)) odin = toIsoDate(date);
    }
    return { xp, max, tier: tierFor('year', xp, max).key, odin };
  }

  it('a gapless year lands on Odin – with a buffer until year end', () => {
    const r = year(weeklyPlan);
    expect(r.xp).toBe(25590);
    expect(r.max).toBe(25590);
    expect(r.tier).toBe('odinn');
    expect(r.odin).toBe('2026-11-26');
  });

  it('the cyclic plan also hits exactly 100 % with a cursor', () => {
    const r = year(defaultPlan, 0, 'day-1');
    expect(r.xp).toBe(r.max);
    expect(r.tier).toBe('odinn');
  });

  it('missing roughly every 10th day costs Odin by a hair', () => {
    expect(year(weeklyPlan, 10).tier).toBe('thorr');
  });

  it('missing every 5th day drops back to Týr', () => {
    expect(year(weeklyPlan, 5).tier).toBe('tyr');
  });
});
