import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { initialState } from '@/data/default-plan';
import { DEFAULT_XP, perfectXp } from '@/model/ranks';
import { __setNow } from '@/composables/useNow';
import { useRankStore } from './ranks';
import { useTrainingStore } from './training';

/** 2026-08-03 is a Monday – the first day of ISO week 2026-W32. */
const MONDAY = new Date(2026, 7, 3);
const NEXT_MONDAY = new Date(2026, 7, 10);

function setup() {
  setActivePinia(createPinia());
  __setNow(MONDAY);
  const training = useTrainingStore();
  const ranks = useRankStore();
  training.refresh();
  return { training, ranks };
}

/** Check every planned set of every block of today's session. */
function completeToday(training: ReturnType<typeof useTrainingStore>) {
  for (const result of training.todaySession?.results ?? []) {
    training.toggleSet(result.blockId, result.sets.length);
  }
}

describe('seeding', () => {
  beforeEach(() => setup());

  it('clones the seed – defaultPlan and weeklyPlan share day objects', () => {
    const training = useTrainingStore();
    training.shiftDay('day-1', 1);

    expect(initialState.plans['plan-default'].days[0].id).toBe('day-1');
    expect(initialState.plans['plan-default'].days[0].order).toBe(0);
  });

  it('starts on the cursor day with a fresh session', () => {
    const training = useTrainingStore();
    expect(training.todayDay?.id).toBe('day-1');
    expect(training.todaySession?.status).toBe('planned');
    expect(training.todaySession?.results.map((r) => r.plannedSets)).toEqual([3, 3, 3]);
  });

  it('builds the ladders phase-exactly from the cursor', () => {
    const ranks = useRankStore();
    expect(ranks.state?.week.max).toBe(830);
    expect(ranks.state?.week.max).toBe(
      perfectXp(initialState.plans['plan-default'], 'week', MONDAY, DEFAULT_XP, 'day-1'),
    );
  });
});

describe('booking a workout', () => {
  it('books the day bonus implicitly and advances the cursor', () => {
    const { training, ranks } = setup();
    completeToday(training);

    expect(training.todaySession?.status).toBe('done');
    expect(ranks.state?.week.xp).toBe(140);
    expect(ranks.state?.month.xp).toBe(140);
    expect(ranks.state?.year.xp).toBe(140);
    expect(training.cursorDayId).toBe('day-2');
    // The screen keeps showing the day that was worked, not the next one.
    expect(training.todayDay?.id).toBe('day-1');
  });

  it('revokes the bonus and the cursor advance when a set is unchecked', () => {
    const { training, ranks } = setup();
    completeToday(training);

    training.toggleSet('b-1-2', 3);

    expect(ranks.state?.week.xp).toBe(140 - DEFAULT_XP.dayCompleted - 30 + 12);
    expect(training.cursorDayId).toBe('day-1');
    expect(training.todaySession?.status).toBe('inProgress');
  });

  it('credits an extra set once and only up to the ceiling', () => {
    const { training, ranks } = setup();
    completeToday(training);

    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(148);

    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(151);

    // Third extra set – the overflow curve has only two entries.
    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(151);
  });

  it('never books the same XP twice', () => {
    const { training, ranks } = setup();
    completeToday(training);
    completeToday(training);
    completeToday(training);
    expect(ranks.state?.week.xp).toBe(140);
  });
});

describe('period roll-over', () => {
  it('archives the week, keeps the record and is idempotent', () => {
    const { training, ranks } = setup();
    completeToday(training);
    expect(ranks.state?.records.week).toBe('drengr');

    __setNow(NEXT_MONDAY);
    training.refresh();

    expect(ranks.state?.week.xp).toBe(0);
    expect(ranks.state?.week.period).toBe('2026-W33');
    expect(ranks.history).toHaveLength(1);
    expect(ranks.state?.records.week).toBe('drengr');

    const snapshot = JSON.stringify(ranks.state);
    training.refresh();
    expect(JSON.stringify(ranks.state)).toBe(snapshot);
  });
});

describe('plan editing', () => {
  it('converts the schedule and recomputes the reference week', () => {
    const { training } = setup();
    expect(training.perfectWeek).toBe(830);

    training.setScheduleKind('weekly');
    // Mon–Thu carry the four days, Friday and the weekend stay free.
    expect(training.perfectWeek).toBe(470);
    expect(training.activePlan?.schedule.kind).toBe('weekly');
  });

  it('re-resolves an untouched session when the plan moves a different day onto today', () => {
    const { training } = setup();
    training.setScheduleKind('weekly');

    const restId = training.createDay({
      name: 'Bewusste Pause',
      restDay: true,
      blocks: [],
    });
    expect(restId).not.toBeNull();

    // Monday is today – put the rest day first.
    for (let i = 0; i < 4; i++) training.shiftDay(restId!, -1);

    expect(training.todayDay?.id).toBe(restId);
    expect(training.todaySession?.status).toBe('rest');
    expect(useRankStore().state?.week.xp).toBe(DEFAULT_XP.restDay);
  });

  it('leaves a session that has progress in it alone', () => {
    const { training } = setup();
    training.toggleSet('b-1-1', 2);

    training.setScheduleKind('weekly');
    training.createDay({ name: 'Pause', restDay: true, blocks: [] });

    expect(training.todaySession?.dayId).toBe('day-1');
  });

  it('keeps the cursor pointing at a day that still exists', () => {
    const { training } = setup();
    training.deleteDay('day-1');

    expect(training.cursorDayId).toBe('day-2');
    expect(training.days.map((d) => d.order)).toEqual([0, 1, 2]);
  });

  it('refuses to delete the last day', () => {
    const { training } = setup();
    for (const id of ['day-1', 'day-2', 'day-3', 'day-4']) training.deleteDay(id);
    expect(training.days).toHaveLength(1);
  });
});
