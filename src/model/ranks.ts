/**
 * Rank systems for "Til Valhall".
 *
 * Three parallel ladders fed by one shared XP source:
 *   - week  → estate ladder (Rígsþula), resets on Mondays
 *   - month → Nine Worlds,              resets on the 1st of the month
 *   - year  → Twelve Æsir,              resets on January 1st
 *
 * XP is a **fixed budget**, not a function of volume: a completed training day
 * is always worth `DAY_XP`, split equally across its blocks. The ladders
 * therefore grade against **absolute** maxima (`SCOPE_MAX`) rather than a
 * plan-derived reference value – every day is worth the same, so the scale is
 * plan-independent by construction. `share` stays the source of truth for the
 * ladder shape; `minXp` is resolved against `SCOPE_MAX[scope]`.
 *
 * Pure functions, no framework dependencies – same as `plan-cycle.ts`.
 */

import type {
  BlockResult,
  Id,
  TrainingDay,
  TrainingPlan,
  WorkoutSession,
} from './training';
import { isWeekly } from './schedule';
import { nextDay, orderedDays } from './plan-cycle';

/* ------------------------------------------------------------------ */
/* Ladders                                                             */
/* ------------------------------------------------------------------ */

export type RankScope = 'week' | 'month' | 'year';

export interface RankTier {
  /** Stable key for persistence and assets (icons, badges). */
  key: Id;
  /** Display name, Old Norse. */
  name: string;
  /** Short English explanation for tooltips / detail views. */
  gloss: string;
  /**
   * Share of `SCOPE_MAX`, 0..1. The lowest tier is always 0, the top tier at
   * most 1 – see `assertLadder`.
   */
  share: number;
}

/** A tier resolved against a concrete period. */
export interface ResolvedTier extends RankTier {
  minXp: number;
}

/**
 * Week – the estate ladder from the Rígsþula.
 * Deliberately without `Þræll` (the unfree): demotivating as a starting rank.
 */
export const WEEKLY_TIERS: RankTier[] = [
  { key: 'drengr', name: 'Drengr', gloss: 'Young warrior – the beginning', share: 0 },
  { key: 'karl', name: 'Karl', gloss: 'Free farmer', share: 0.25 },
  { key: 'hersir', name: 'Hersir', gloss: 'Leader of a war band', share: 0.5 },
  { key: 'jarl', name: 'Jarl', gloss: 'Earl', share: 0.75 },
  { key: 'konungr', name: 'Konungr', gloss: 'King – the perfect week', share: 1 },
];

/**
 * Month – ascent through the Nine Worlds, from primordial cold up to Asgard.
 *
 * The top sits at `share: 0.9` (3240 XP = 27 gapless days). Against the nominal
 * 30-day month that is three days of slack, four in a 31-day month and one even
 * in February – enough for a rest day, which costs 100 XP against the ladder.
 */
export const MONTHLY_TIERS: RankTier[] = [
  { key: 'niflheim', name: 'Niflheim', gloss: 'World of mist and ice', share: 0 },
  { key: 'helheim', name: 'Helheim', gloss: 'Realm of Hel', share: 0.11 },
  { key: 'muspelheim', name: 'Muspelheim', gloss: 'World of fire', share: 0.23 },
  { key: 'jotunheim', name: 'Jötunheim', gloss: 'Land of the giants', share: 0.34 },
  {
    key: 'svartalfaheim',
    name: 'Svartálfaheim',
    gloss: 'Realm of the dark elves',
    share: 0.45,
  },
  { key: 'midgard', name: 'Midgard', gloss: 'World of humans', share: 0.56 },
  { key: 'alfheim', name: 'Álfheim', gloss: 'Realm of the light elves', share: 0.68 },
  { key: 'vanaheim', name: 'Vanaheim', gloss: 'Home of the Vanir', share: 0.79 },
  { key: 'asgard', name: 'Asgard', gloss: 'Stronghold of the Æsir', share: 0.9 },
];

/**
 * Year – twelve Æsir, ascending by prominence (Snorri's Gylfaginning).
 *
 * The top deliberately sits at `share: 0.85` rather than 1: across twelve months
 * holidays, illness and days without a pull-up bar are a certainty. Odin thus
 * demands 306 gapless days out of 365 – reached on November 2nd in a gapless
 * year, with 59 days of slack. The remaining tiers are scaled proportionally.
 */
export const YEARLY_TIERS: RankTier[] = [
  { key: 'bragi', name: 'Bragi', gloss: 'God of poetry', share: 0 },
  { key: 'forseti', name: 'Forseti', gloss: 'God of justice', share: 0.08 },
  { key: 'ullr', name: 'Ullr', gloss: 'Archer and hunter', share: 0.15 },
  { key: 'vidar', name: 'Vídar', gloss: 'The silent one', share: 0.23 },
  { key: 'vali', name: 'Váli', gloss: 'The avenger', share: 0.31 },
  { key: 'njord', name: 'Njörd', gloss: 'God of the sea', share: 0.39 },
  { key: 'freyr', name: 'Freyr', gloss: 'God of fertility', share: 0.46 },
  { key: 'heimdallr', name: 'Heimdall', gloss: 'Warden of the Bifröst', share: 0.54 },
  { key: 'baldr', name: 'Baldr', gloss: 'The shining one', share: 0.62 },
  { key: 'tyr', name: 'Týr', gloss: 'God of battle', share: 0.7 },
  { key: 'thorr', name: 'Thor', gloss: 'Protector of Midgard', share: 0.77 },
  { key: 'odinn', name: 'Odin', gloss: 'Allfather – lord of Valhalla', share: 0.85 },
];

export const TIERS: Record<RankScope, RankTier[]> = {
  week: WEEKLY_TIERS,
  month: MONTHLY_TIERS,
  year: YEARLY_TIERS,
};

/**
 * Invariant of the ladders – callable as a test.
 * The top may sit below 1 (then it is reachable before the period ends), but
 * never above: it would be unreachable.
 */
export function assertLadder(tiers: RankTier[]): void {
  const top = tiers[tiers.length - 1].share;
  if (tiers[0].share !== 0) throw new Error('The lowest tier must have share 0.');
  if (top <= 0 || top > 1) throw new Error('The top tier must have share in (0, 1].');
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].share <= tiers[i - 1].share) {
      throw new Error(`share is not monotonic at "${tiers[i].key}".`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Awarding XP                                                         */
/* ------------------------------------------------------------------ */

/** What a completed training day is worth – always, regardless of its volume. */
export const DAY_XP = 120;

/** A consciously taken rest day – rewards sticking to the plan, not activity. */
export const REST_XP = 20;

/** Hard ceiling for extra sets: nothing past 166 % of the target. */
export const MAX_RATIO = 5 / 3;

/**
 * Reference value for 100 % per ladder.
 *
 * `month` and `year` are **nominal**, not calendar-exact: a gapless 31-day month
 * yields 3720 and a gapless 365-day year 43800, both above the reference. That
 * is why `completion` stays clamped at 1.
 */
export const SCOPE_MAX: Record<RankScope, number> = {
  week: 840, //   7 × 120
  month: 3600, //  30 × 120 (nominal month)
  year: 43200, // 360 × 120 (nominal year)
};

/**
 * Share of a block's XP after `completed` of `planned` sets. Capped at 115 %.
 *
 * Two segments anchored on five points, `p = completed / planned`:
 * (⅓, .15) (⅔, .40) (1, 1) (4/3, 1.10) (5/3, 1.15).
 *
 * Both are strictly increasing on their domain (f′ has a negative discriminant,
 * g′(⅔) = 0.075 > 0). The kink at `p = 1` is deliberate – it is the
 * "finishing pays" incentive that used to be carried by a flat day bonus.
 */
export function completionShare(completed: number, planned: number): number {
  if (planned <= 0 || completed <= 0) return 0;
  const p = Math.min(completed / planned, MAX_RATIO);
  // Cubic through (0,0), (⅓,.15), (⅔,.40), (1,1).
  if (p <= 1) return ((1.125 * p - 0.675) * p + 0.55) * p;
  // Quadratic through (1,1), (4/3,1.10), (5/3,1.15).
  const d = p - 1;
  return 1 + (0.375 - 0.225 * d) * d;
}

/**
 * Highest set number that still yields XP: 1→1, 2→3, 3→5, 4→6, 5→8, 6→10.
 *
 * A visible full stop is more honest than a curve that tends towards zero but
 * never ends – the latter would be an incentive to overtrain.
 */
export function maxSets(planned: number): number {
  return Math.floor((planned * 5) / 3);
}

/**
 * Split `total` into `n` integer parts that sum exactly to `total`.
 * Cumulative rounding, so the parts never drift apart from the total
 * (7 → 17,17,17,18,17,17,17). For 1–4 blocks the division is exact anyway.
 */
export function splitEqually(total: number, n: number): number[] {
  if (n <= 0) return [];
  let prev = 0;
  return Array.from({ length: n }, (_, i) => {
    const cum = Math.round((total * (i + 1)) / n);
    const part = cum - prev;
    prev = cum;
    return part;
  });
}

/**
 * The day's budget split equally across its blocks – 1 block 120, 2 blocks 60,
 * 3 blocks 40, 4 blocks 30.
 *
 * Balancing the blocks against each other is the user's job: a 5-set block is
 * deliberately not weighted higher than a 2-set one. A day that feels lopsided
 * gets reshaped, it does not get re-weighted.
 */
export function blockBases(day: TrainingDay, dayXpMax = DAY_XP): number[] {
  return splitEqually(dayXpMax, day.blocks.length);
}

/** XP of one block – integer. `planned` is the target, not the set count. */
export function blockXp(completed: number, planned: number, base: number): number {
  return Math.round(base * completionShare(completed, planned));
}

/**
 * XP of a whole day from plan + results – exactly `DAY_XP` when everything is
 * checked off, for any block count, because `completionShare(n, n) === 1`.
 */
export function dayXp(
  day: TrainingDay,
  results: BlockResult[],
  dayXpMax = DAY_XP,
): number {
  const bases = blockBases(day, dayXpMax);
  return day.blocks.reduce((sum, b, i) => {
    const r = results.find((x) => x.blockId === b.id);
    const done = r ? r.sets.filter((s) => s.completed).length : 0;
    return sum + blockXp(done, b.sets, bases[i]);
  }, 0);
}

/**
 * XP of a completed session – computed from the **session**, not from the plan.
 *
 * That is what keeps the history honest: a later plan edit must not change what
 * a past session was worth. It relies on `BlockResult.plannedSets`, which
 * `createSession()` fills in for every block.
 */
export function sessionXp(session: WorkoutSession): number {
  if (session.status === 'rest') return REST_XP;
  if (session.status !== 'done') return 0;

  const bases = splitEqually(DAY_XP, session.results.length);
  return session.results.reduce((sum, r, i) => {
    const planned = r.plannedSets ?? r.sets.length;
    const done = r.sets.filter((s) => s.completed).length;
    return sum + blockXp(done, planned, bases[i]);
  }, 0);
}

/**
 * Append an extra set to a session (immutable).
 * Returns the session unchanged if the target is not yet met or the ceiling
 * from `maxSets()` has already been reached.
 */
export function withExtraSet(session: WorkoutSession, blockId: Id): WorkoutSession {
  const result = session.results.find((r) => r.blockId === blockId);
  if (!result) return session;

  const planned = result.plannedSets ?? result.sets.length;
  if (result.sets.length >= maxSets(planned)) return session;
  if (result.sets.some((s) => !s.completed)) return session;

  return {
    ...session,
    results: session.results.map((r) =>
      r.blockId === blockId
        ? {
            ...r,
            plannedSets: planned,
            sets: [...r.sets, { setIndex: r.sets.length, completed: true }],
          }
        : r,
    ),
  };
}

/**
 * XP of a perfectly completed day.
 * **Without** extra sets: 100 % means "plan fulfilled", not "maximum squeezed out".
 */
export function potentialXp(day: TrainingDay): number {
  return day.restDay ? REST_XP : DAY_XP;
}

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

/** ISO calendar week, e.g. `2026-W31`. The week starts on Monday. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to the Thursday of the same week – it determines the ISO year.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  );
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** `2026-08`. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `2026`. */
export function yearKey(date: Date): string {
  return String(date.getFullYear());
}

export function periodKey(scope: RankScope, date: Date): string {
  if (scope === 'week') return weekKey(date);
  if (scope === 'month') return monthKey(date);
  return yearKey(date);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** First day and length of the period that `date` falls into. */
export function periodRange(scope: RankScope, date: Date): { start: Date; days: number } {
  if (scope === 'week') {
    return { start: addDays(date, -((date.getDay() + 6) % 7)), days: 7 };
  }
  if (scope === 'month') {
    const y = date.getFullYear();
    const m = date.getMonth();
    return { start: new Date(y, m, 1), days: new Date(y, m + 1, 0).getDate() };
  }
  const y = date.getFullYear();
  const days = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  return { start: new Date(y, 0, 1), days };
}

/* ------------------------------------------------------------------ */
/* What a plan can reach                                               */
/* ------------------------------------------------------------------ */

/**
 * XP a gapless week would yield under this plan – **display only**.
 *
 * Nothing grades against it; the ladders use `SCOPE_MAX`. It exists so the plan
 * editor can show the gap a plan can never close: a weekday plan with weekends
 * off reaches 600 of 840 and therefore cannot become Konungr, which is a
 * property of the plan the user should see rather than discover on a Sunday.
 *
 * Cyclic plans rotate seven days from `startDayId` – the phase only matters
 * when the cycle contains rest days. Weekly plans sum their seven assignments.
 */
export function weeklyPotential(plan: TrainingPlan, startDayId?: Id): number {
  if (isWeekly(plan.schedule)) {
    const byId = new Map(plan.days.map((d) => [d.id, d]));
    let sum = 0;
    for (const wd of [1, 2, 3, 4, 5, 6, 7] as const) {
      const day = plan.schedule.assignments[wd];
      const found = day ? byId.get(day) : undefined;
      if (found) sum += potentialXp(found);
    }
    return sum;
  }

  const ordered = orderedDays(plan);
  if (ordered.length === 0) return 0;

  let day = ordered.find((d) => d.id === startDayId) ?? ordered[0];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += potentialXp(day);
    day = nextDay(plan, day.id);
  }
  return sum;
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/** A running period: which one, how much XP, how much would be perfect. */
export interface ScopeProgress {
  /** Result of `periodKey` – detects expired periods. */
  period: string;
  xp: number;
  /**
   * Reference value for 100 %, frozen when the period starts. Always
   * `SCOPE_MAX[scope]` today, but kept in the state because `history` entries
   * need the value they were graded against – changing the maxima later must
   * not retroactively regrade closed periods.
   */
  max: number;
}

/** Persistable state of all three ladders. */
export interface RankState {
  week: ScopeProgress;
  month: ScopeProgress;
  year: ScopeProgress;
  /** Highest rank ever reached per level – survives the reset. */
  records: Record<RankScope, Id | null>;
  /** Completed periods, for the chronicle. */
  history: Array<{
    scope: RankScope;
    period: string;
    xp: number;
    max: number;
    tier: Id;
  }>;
}

export function createRankState(now: Date = new Date()): RankState {
  const scope = (s: RankScope): ScopeProgress => ({
    period: periodKey(s, now),
    xp: 0,
    max: SCOPE_MAX[s],
  });

  return {
    week: scope('week'),
    month: scope('month'),
    year: scope('year'),
    records: { week: null, month: null, year: null },
    history: [],
  };
}

/** Tiers of a ladder, resolved against a concrete period. */
export function resolveTiers(scope: RankScope, max: number): ResolvedTier[] {
  return TIERS[scope].map((t) => ({ ...t, minXp: Math.round(t.share * max) }));
}

/** Currently reached tier – always defined, since the lowest tier has `share: 0`. */
export function tierFor(scope: RankScope, xp: number, max: number): ResolvedTier {
  const tiers = resolveTiers(scope, max);
  // Without a reference value all thresholds sit at 0 - otherwise you would be at the top instantly.
  if (max <= 0) return tiers[0];
  let current = tiers[0];
  for (const t of tiers) if (xp >= t.minXp) current = t;
  return current;
}

export function nextTier(scope: RankScope, xp: number, max: number): ResolvedTier | null {
  return resolveTiers(scope, max).find((t) => t.minXp > xp) ?? null;
}

export interface TierProgress {
  tier: ResolvedTier;
  next: ResolvedTier | null;
  xp: number;
  max: number;
  /** 0..1 within the current tier; 1 once the top is reached. */
  ratio: number;
  /** XP until the next tier; 0 at the top. */
  remaining: number;
  /** 0..1 across the whole period – the "100 %" display. */
  completion: number;
}

export function tierProgress(scope: RankScope, p: ScopeProgress): TierProgress {
  const { xp, max } = p;
  const tier = tierFor(scope, xp, max);
  const next = nextTier(scope, xp, max);
  const completion = max > 0 ? Math.min(xp / max, 1) : 0;

  if (!next) {
    return { tier, next: null, xp, max, ratio: 1, remaining: 0, completion };
  }

  const span = next.minXp - tier.minXp;
  return {
    tier,
    next,
    xp,
    max,
    ratio: span > 0 ? Math.min((xp - tier.minXp) / span, 1) : 1,
    remaining: next.minXp - xp,
    completion,
  };
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Close out and reset expired periods.
 * Idempotent – safe to call on every app start or day change.
 */
export function rollOver(state: RankState, now: Date = new Date()): RankState {
  let next = state;

  for (const scope of ['week', 'month', 'year'] as RankScope[]) {
    const key = periodKey(scope, now);
    const current = next[scope];
    if (current.period === key) continue;

    next = {
      ...next,
      [scope]: { period: key, xp: 0, max: SCOPE_MAX[scope] },
      history: [
        ...next.history,
        {
          scope,
          period: current.period,
          xp: current.xp,
          max: current.max,
          // Grade the closing period against its own reference value.
          tier: tierFor(scope, current.xp, current.max).key,
        },
      ],
    };
  }

  return next;
}

/** Credit XP; resets expired periods first. */
export function awardXp(state: RankState, xp: number, now: Date = new Date()): RankState {
  const base = rollOver(state, now);

  const week = { ...base.week, xp: base.week.xp + xp };
  const month = { ...base.month, xp: base.month.xp + xp };
  const year = { ...base.year, xp: base.year.xp + xp };

  return {
    ...base,
    week,
    month,
    year,
    records: {
      week: bestTier('week', base.records.week, week),
      month: bestTier('month', base.records.month, month),
      year: bestTier('year', base.records.year, year),
    },
  };
}

/** Close a session and book its XP onto all three ladders. */
export function applySession(
  state: RankState,
  session: WorkoutSession,
  now: Date = new Date(),
): RankState {
  return awardXp(state, sessionXp(session), now);
}

function bestTier(scope: RankScope, previous: Id | null, p: ScopeProgress): Id {
  const tiers = TIERS[scope];
  const reached = tierFor(scope, p.xp, p.max);
  const prevIndex = previous ? tiers.findIndex((t) => t.key === previous) : -1;
  const nextIndex = tiers.findIndex((t) => t.key === reached.key);
  return nextIndex > prevIndex ? reached.key : previous!;
}
