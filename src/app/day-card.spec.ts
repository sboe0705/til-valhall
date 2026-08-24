import { describe, expect, it } from 'vitest';

import { initialState } from '@/data/default-plan';
import type { TrainingDay } from '@/model/training';
import { dayCard } from './day-card';

const exercises = initialState.exercises;
const days = initialState.plans['plan-weekly'].days;
const dayOf = (id: string): TrainingDay => days.find((d) => d.id === id)!;

describe('dayCard', () => {
  it('describes a training day the way the Plan screen lists it', () => {
    const card = dayCard(dayOf('day-1'), 1, exercises);

    expect(card.title).toBe('Tag 1 · Rumpf & Trizeps');
    expect(card.meta).toBe('3 Übungen · 9 Sätze');
    expect(card.xpText).toBe('120 XP');
    expect(card.rest).toBe(false);
    expect(card.rows).toEqual([
      { name: 'Seitstütz', target: '3 × 1:00 Min pro Seite', setsText: '3 Sätze' },
      { name: 'Dead Bug', target: '3 × 20 Wdh. (5 s halten)', setsText: '3 Sätze' },
      {
        name: 'Trizepsdrücken',
        target: '3 × 40 Wdh. pro Seite',
        setsText: '3 Sätze',
      },
    ]);
  });

  it('carries the rest day without blocks and at the rest XP', () => {
    const card = dayCard(dayOf('day-rest'), null, exercises);

    expect(card.title).toBe('Ruhetag');
    expect(card.meta).toBe('kein Block · rotiert mit');
    expect(card.xpText).toBe('20 XP');
    expect(card.rest).toBe(true);
    expect(card.rows).toEqual([]);
  });
});
