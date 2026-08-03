import type { Exercise, Id, TrainingPlan, TrainingState } from '../model/training';

const now = '2026-01-01T00:00:00.000Z';

/*
 * The `id` values are stable persistence keys (localStorage, session history,
 * rank assets). Display names may change freely, ids may not – renaming one
 * once data has been persisted requires a migration via `schemaVersion`.
 *
 * Display names are German because the UI is; the model itself stays English.
 */
export const defaultExercises: Record<Id, Exercise> = {
  'ex-side-plank': {
    id: 'ex-side-plank',
    name: 'Seitstütz',
    muscleGroups: ['core'],
    perSide: true,
  },
  'ex-dead-bug': {
    id: 'ex-dead-bug',
    name: 'Dead Bug',
    muscleGroups: ['core'],
    perSide: false,
  },
  'ex-triceps': {
    id: 'ex-triceps',
    name: 'Trizepsdrücken',
    muscleGroups: ['arms'],
    perSide: true,
  },
  'ex-push-ups': {
    id: 'ex-push-ups',
    name: 'Liegestütze',
    muscleGroups: ['chest', 'arms'],
    perSide: false,
  },
  'ex-bow-pull': {
    id: 'ex-bow-pull',
    name: 'Bogenzug',
    muscleGroups: ['back', 'shoulders'],
    perSide: true,
  },
  'ex-squats': {
    id: 'ex-squats',
    name: 'Kniebeugen',
    muscleGroups: ['legs'],
    perSide: false,
  },
  'ex-lunges': {
    id: 'ex-lunges',
    name: 'Ausfallschritte',
    muscleGroups: ['legs'],
    perSide: false,
  },
  'ex-pull-ups': {
    id: 'ex-pull-ups',
    name: 'Klimmzüge',
    muscleGroups: ['back', 'arms'],
    perSide: false,
    equipment: ['Klimmzugstange'],
  },
  'ex-biceps': {
    id: 'ex-biceps',
    name: 'Bizepscurl',
    muscleGroups: ['arms'],
    perSide: true,
  },
};

export const defaultPlan: TrainingPlan = {
  id: 'plan-default',
  name: 'Walhall-Zyklus',
  schedule: { kind: 'cyclic' },
  createdAt: now,
  updatedAt: now,
  days: [
    {
      id: 'day-1',
      name: 'Rumpf & Trizeps',
      order: 0,
      blocks: [
        {
          id: 'b-1-1',
          exerciseId: 'ex-side-plank',
          sets: 3,
          order: 0,
          target: { kind: 'duration', seconds: 60 },
        },
        {
          id: 'b-1-2',
          exerciseId: 'ex-dead-bug',
          sets: 3,
          order: 1,
          target: { kind: 'reps', reps: 20, holdSeconds: 5 },
        },
        {
          id: 'b-1-3',
          exerciseId: 'ex-triceps',
          sets: 3,
          order: 2,
          target: { kind: 'reps', reps: 40 },
        },
      ],
    },
    {
      id: 'day-2',
      name: 'Druck & Zug',
      order: 1,
      blocks: [
        {
          id: 'b-2-1',
          exerciseId: 'ex-push-ups',
          sets: 3,
          order: 0,
          target: { kind: 'reps', reps: 20 },
        },
        {
          id: 'b-2-2',
          exerciseId: 'ex-bow-pull',
          sets: 3,
          order: 1,
          target: { kind: 'reps', reps: 25 },
        },
      ],
    },
    {
      id: 'day-3',
      name: 'Beine',
      order: 2,
      blocks: [
        {
          id: 'b-3-1',
          exerciseId: 'ex-squats',
          sets: 3,
          order: 0,
          target: { kind: 'reps', reps: 20, holdSeconds: 5 },
        },
        {
          id: 'b-3-2',
          exerciseId: 'ex-lunges',
          sets: 3,
          order: 1,
          target: { kind: 'reps', reps: 20, holdSeconds: 5 },
        },
      ],
    },
    {
      id: 'day-4',
      name: 'Zug & Bizeps',
      order: 3,
      blocks: [
        {
          id: 'b-4-1',
          exerciseId: 'ex-pull-ups',
          sets: 3,
          order: 0,
          target: { kind: 'reps', reps: 10 },
        },
        {
          id: 'b-4-2',
          exerciseId: 'ex-biceps',
          sets: 3,
          order: 1,
          target: { kind: 'reps', reps: 30 },
        },
      ],
    },
  ],
};

/**
 * The same four days, but weekday based:
 * Mon/Tue/Thu/Fri training, Wednesday as an explicit rest day, Sat/Sun off.
 */
export const weeklyPlan: TrainingPlan = {
  ...defaultPlan,
  id: 'plan-weekly',
  name: 'Wochenplan',
  schedule: {
    kind: 'weekly',
    assignments: {
      1: 'day-1',
      2: 'day-2',
      3: 'day-rest', // deliberately scheduled rest day
      4: 'day-3',
      5: 'day-4',
      6: null, // Saturday off
      7: null, // Sunday off
    },
  },
  days: [
    ...defaultPlan.days,
    { id: 'day-rest', name: 'Ruhetag', order: 4, blocks: [], restDay: true },
  ],
};

export const initialState: TrainingState = {
  schemaVersion: 1,
  exercises: defaultExercises,
  plans: {
    [defaultPlan.id]: defaultPlan,
    [weeklyPlan.id]: weeklyPlan,
  },
  activePlanId: defaultPlan.id,
  sessions: [],
  cursors: { [defaultPlan.id]: 'day-1' },
};
