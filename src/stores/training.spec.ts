import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { initialState } from '@/data/default-plan';
import { DAY_XP, REST_XP, SCOPE_MAX } from '@/model/ranks';
import { toIsoDate } from '@/model/schedule';
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

  it('builds the ladders against the absolute maxima', () => {
    const ranks = useRankStore();
    expect(ranks.state?.week.max).toBe(SCOPE_MAX.week);
    expect(ranks.state?.month.max).toBe(SCOPE_MAX.month);
    expect(ranks.state?.year.max).toBe(SCOPE_MAX.year);
  });
});

describe('booking a workout', () => {
  it('books the full day and advances the cursor', () => {
    const { training, ranks } = setup();
    completeToday(training);

    expect(training.todaySession?.status).toBe('done');
    expect(ranks.state?.week.xp).toBe(DAY_XP);
    expect(ranks.state?.month.xp).toBe(DAY_XP);
    expect(ranks.state?.year.xp).toBe(DAY_XP);
    expect(training.cursorDayId).toBe('day-2');
    // The screen keeps showing the day that was worked, not the next one.
    expect(training.todayDay?.id).toBe('day-1');
  });

  it('gives the XP back and undoes the cursor advance when a set is unchecked', () => {
    const { training, ranks } = setup();
    completeToday(training);

    training.toggleSet('b-1-2', 3);

    // One of the three blocks falls from 40 back to 16.
    expect(ranks.state?.week.xp).toBe(DAY_XP - 40 + 16);
    expect(training.cursorDayId).toBe('day-1');
    expect(training.todaySession?.status).toBe('inProgress');
  });

  it('credits an extra set once and only up to the ceiling', () => {
    const { training, ranks } = setup();
    completeToday(training);

    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(124);

    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(126);

    // Third extra set – maxSets(3) is 5, so there is no sixth pill.
    training.addExtraSet('b-1-1');
    expect(ranks.state?.week.xp).toBe(126);
  });

  it('never books the same XP twice', () => {
    const { training, ranks } = setup();
    completeToday(training);
    completeToday(training);
    completeToday(training);
    expect(ranks.state?.week.xp).toBe(DAY_XP);
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

describe('the next day up', () => {
  it('rotates off today, not off the cursor', () => {
    const { training } = setup();
    expect(training.nextUp?.day.id).toBe('day-2');
    // A cycle day is not tied to a calendar date – it comes up on completion.
    expect(training.nextUp?.date).toBeNull();

    // The cursor moves to day-2, yet the preview keeps pointing past today.
    completeToday(training);
    expect(training.cursorDayId).toBe('day-2');
    expect(training.nextUp?.day.id).toBe('day-2');
  });

  it('wraps around the end of the cycle', () => {
    const { training } = setup();
    for (const id of ['day-1', 'day-2', 'day-3']) training.deleteDay(id);

    expect(training.todayDay?.id).toBe('day-4');
    expect(training.nextUp?.day.id).toBe('day-4');
  });

  it('dates the weekly plan and skips its empty weekdays', () => {
    const { training } = setup();
    training.setScheduleKind('weekly');

    // Monday: the next day sits on Tuesday.
    expect(training.nextUp?.day.id).toBe('day-2');
    expect(training.nextUp?.date && toIsoDate(training.nextUp.date)).toBe('2026-08-04');

    // Thursday is the last assigned weekday – Fri/Sat/Sun are free, so the
    // preview looks ahead to the following Monday.
    __setNow(new Date(2026, 7, 6));
    expect(training.nextUp?.day.id).toBe('day-1');
    expect(training.nextUp?.date && toIsoDate(training.nextUp.date)).toBe('2026-08-10');
  });
});

describe('plan editing', () => {
  it('converts the schedule and recomputes what the plan can reach', () => {
    const { training } = setup();
    // The cycle fills every calendar day, so it can reach the weekly maximum.
    expect(training.perfectWeek).toBe(840);
    expect(training.perfectWeekMax).toBe(SCOPE_MAX.week);

    training.setScheduleKind('weekly');
    // Mon–Thu carry the four days, Friday and the weekend stay free – Konungr
    // is out of reach from here on, which is exactly what the caption shows.
    expect(training.perfectWeek).toBe(480);
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
    expect(useRankStore().state?.week.xp).toBe(REST_XP);
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
