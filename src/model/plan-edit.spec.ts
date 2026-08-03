import { describe, expect, it } from 'vitest';

import { defaultPlan, weeklyPlan } from '../data/default-plan';
import type { TrainingPlan } from './training';
import { orderedDays } from './plan-cycle';
import { convertSchedule, isWeekly } from './schedule';
import {
  addDay,
  clampSets,
  dayNumbers,
  defaultTargetFor,
  makeDay,
  moveDay,
  reindexOrders,
  removeDay,
  syncWeekdays,
} from './plan-edit';

const AT = new Date(2026, 7, 1);

/** Deterministic ids – `crypto.randomUUID()` would make assertions unstable. */
function ids() {
  let n = 0;
  return (prefix: string) => `${prefix}-test-${++n}`;
}

const assignmentsOf = (plan: TrainingPlan) =>
  isWeekly(plan.schedule) ? plan.schedule.assignments : null;

describe('ordering', () => {
  it('reindexes to a gapless 0..n-1', () => {
    const days = [
      { id: 'a', name: 'A', order: 5, blocks: [] },
      { id: 'b', name: 'B', order: 2, blocks: [] },
      { id: 'c', name: 'C', order: 9, blocks: [] },
    ];
    expect(reindexOrders(days).map((d) => [d.id, d.order])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
  });

  it('numbers training days positionally and skips rest days', () => {
    expect([...dayNumbers(weeklyPlan)]).toEqual([
      ['day-1', 1],
      ['day-2', 2],
      ['day-3', 3],
      ['day-4', 4],
      ['day-rest', null],
    ]);
  });
});

describe('weekday sync', () => {
  it('is a no-op for cyclic plans', () => {
    expect(syncWeekdays(defaultPlan, AT)).toBe(defaultPlan);
  });

  it('lays the list out from Monday and agrees with convertSchedule below six days', () => {
    const converted = convertSchedule(defaultPlan, 'weekly');
    expect(assignmentsOf(syncWeekdays(converted, AT))).toEqual(assignmentsOf(converted));
  });

  it('fills the weekend once there are more than five days', () => {
    let plan = convertSchedule(defaultPlan, 'weekly');
    for (let i = 0; i < 3; i++) {
      plan = addDay(
        plan,
        makeDay({ name: `Extra ${i}`, restDay: true, blocks: [] }, ids()),
        AT,
      );
    }
    const a = assignmentsOf(plan);
    expect(a?.[6]).not.toBeNull();
    expect(a?.[7]).not.toBeNull();
  });
});

describe('structural edits', () => {
  it('appends a day at the end of the cycle', () => {
    const day = makeDay({ name: 'Nacken', restDay: false, blocks: [] }, ids());
    const plan = addDay(defaultPlan, day, AT);

    expect(plan.days).toHaveLength(5);
    expect(orderedDays(plan).at(-1)?.id).toBe('day-test-1');
    expect(orderedDays(plan).at(-1)?.order).toBe(4);
    expect(defaultPlan.days).toHaveLength(4); // immutable
  });

  it('removes a day, renumbers and drops it from the week', () => {
    const plan = removeDay(weeklyPlan, 'day-2', AT);

    expect(plan.days.map((d) => d.id)).not.toContain('day-2');
    expect(orderedDays(plan).map((d) => d.order)).toEqual([0, 1, 2, 3]);
    expect(Object.values(assignmentsOf(plan) ?? {})).not.toContain('day-2');
  });

  it('refuses to remove the last day and ignores unknown ids', () => {
    const single: TrainingPlan = { ...defaultPlan, days: [defaultPlan.days[0]] };
    expect(removeDay(single, 'day-1', AT)).toBe(single);
    expect(removeDay(defaultPlan, 'day-nope', AT)).toBe(defaultPlan);
  });

  it('moves a day and renumbers the list', () => {
    const plan = moveDay(defaultPlan, 'day-3', -1, AT);
    expect(orderedDays(plan).map((d) => d.id)).toEqual([
      'day-1',
      'day-3',
      'day-2',
      'day-4',
    ]);
    expect([...dayNumbers(plan)]).toEqual([
      ['day-1', 1],
      ['day-3', 2],
      ['day-2', 3],
      ['day-4', 4],
    ]);
  });

  it('clamps at both ends', () => {
    expect(moveDay(defaultPlan, 'day-1', -1, AT)).toBe(defaultPlan);
    expect(moveDay(defaultPlan, 'day-4', 1, AT)).toBe(defaultPlan);
  });

  it('reassigns the week when a weekly plan is reordered', () => {
    const plan = moveDay(weeklyPlan, 'day-rest', -1, AT);
    expect(assignmentsOf(plan)?.[4]).toBe('day-rest');
  });
});

describe('building days', () => {
  it('clamps set counts to 1..6', () => {
    expect([0, 1, 6, 9].map(clampSets)).toEqual([1, 1, 6, 6]);
  });

  it('builds ordered blocks and trims the name', () => {
    const day = makeDay(
      {
        name: '  Rücken  ',
        restDay: false,
        blocks: [
          { exerciseId: 'ex-pull-ups', sets: 9, target: { kind: 'reps', reps: 10 } },
          { exerciseId: 'ex-biceps', sets: 3, target: { kind: 'reps', reps: 30 } },
        ],
      },
      ids(),
    );

    expect(day.name).toBe('Rücken');
    expect(day.restDay).toBeUndefined();
    expect(day.blocks.map((b) => [b.id, b.sets, b.order])).toEqual([
      ['b-test-1', 6, 0],
      ['b-test-2', 3, 1],
    ]);
  });

  it('a rest day carries no blocks', () => {
    const day = makeDay(
      {
        name: 'Pause',
        restDay: true,
        blocks: [
          { exerciseId: 'ex-biceps', sets: 3, target: { kind: 'reps', reps: 30 } },
        ],
      },
      ids(),
    );
    expect(day.restDay).toBe(true);
    expect(day.blocks).toEqual([]);
  });

  it('takes the catalogue target from how the exercise is already trained', () => {
    expect(defaultTargetFor([defaultPlan], 'ex-side-plank')).toEqual({
      kind: 'duration',
      seconds: 60,
    });
    expect(defaultTargetFor([defaultPlan], 'ex-unknown')).toEqual({
      kind: 'reps',
      reps: 10,
    });
  });
});
