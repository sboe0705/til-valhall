/**
 * Rank systems for "Til Valhall".
 *
 * Three parallel ladders fed by one shared XP source:
 *   - week  → estate ladder (Rígsþula), resets on Mondays
 *   - month → Nine Worlds,              resets on the 1st of the month
 *   - year  → Twelve Æsir,              resets on January 1st
 *
 * The thresholds are **relative**: every tier is a share of the perfect period,
 * which is derived from the plan (`perfectXp`). Week and month therefore end
 * exactly on the top tier when training is gapless; the year deliberately
 * leaves room for holidays and illness with `share: 0.9`.
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
import { isWeekly, isoWeekday } from './schedule';
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
   * Share of the perfect period, 0..1. The lowest tier is always 0, the top
   * tier at most 1 – see `assertLadder`.
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
  { key: 'karl', name: 'Karl', gloss: 'Free farmer', share: 0.2 },
  { key: 'hersir', name: 'Hersir', gloss: 'Leader of a war band', share: 0.45 },
  { key: 'jarl', name: 'Jarl', gloss: 'Earl', share: 0.72 },
  { key: 'konungr', name: 'Konungr', gloss: 'King – the perfect week', share: 1 },
];

/** Month – ascent through the Nine Worlds, from primordial cold up to Asgard. */
export const MONTHLY_TIERS: RankTier[] = [
  { key: 'niflheim', name: 'Niflheim', gloss: 'World of mist and ice', share: 0 },
  { key: 'helheim', name: 'Helheim', gloss: 'Realm of Hel', share: 0.1 },
  { key: 'muspelheim', name: 'Muspelheim', gloss: 'World of fire', share: 0.22 },
  { key: 'jotunheim', name: 'Jötunheim', gloss: 'Land of the giants', share: 0.35 },
  {
    key: 'svartalfaheim',
    name: 'Svartálfaheim',
    gloss: 'Realm of the dark elves',
    share: 0.48,
  },
  { key: 'midgard', name: 'Midgard', gloss: 'World of humans', share: 0.61 },
  { key: 'alfheim', name: 'Álfheim', gloss: 'Realm of the light elves', share: 0.74 },
  { key: 'vanaheim', name: 'Vanaheim', gloss: 'Home of the Vanir', share: 0.87 },
  { key: 'asgard', name: 'Asgard', gloss: 'Stronghold of the Æsir', share: 1 },
];

/**
 * Year – twelve Æsir, ascending by prominence (Snorri's Gylfaginning).
 *
 * The top deliberately sits at `share: 0.9` rather than 1: across twelve months
 * holidays, illness and days without a pull-up bar are a certainty. Odin thus
 * demands roughly 90 % consistency instead of perfection – the remaining tiers
 * are scaled proportionally.
 */
export const YEARLY_TIERS: RankTier[] = [
  { key: 'bragi', name: 'Bragi', gloss: 'God of poetry', share: 0 },
  { key: 'forseti', name: 'Forseti', gloss: 'God of justice', share: 0.07 },
  { key: 'ullr', name: 'Ullr', gloss: 'Archer and hunter', share: 0.15 },
  { key: 'vidar', name: 'Vídar', gloss: 'The silent one', share: 0.23 },
  { key: 'vali', name: 'Váli', gloss: 'The avenger', share: 0.32 },
  { key: 'njord', name: 'Njörd', gloss: 'God of the sea', share: 0.4 },
  { key: 'freyr', name: 'Freyr', gloss: 'God of fertility', share: 0.48 },
  { key: 'heimdallr', name: 'Heimdall', gloss: 'Warden of the Bifröst', share: 0.56 },
  { key: 'baldr', name: 'Baldr', gloss: 'The shining one', share: 0.64 },
  { key: 'tyr', name: 'Týr', gloss: 'God of battle', share: 0.72 },
  { key: 'thorr', name: 'Thor', gloss: 'Protector of Midgard', share: 0.81 },
  { key: 'odinn', name: 'Odin', gloss: 'Allfather – lord of Valhalla', share: 0.9 },
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

/**
 * Cumulative share of an exercise's total points after n sets.
 * Strictly increasing, last value always 1.
 *
 * The jump at the end is the actual incentive: the final set is the most
 * valuable one, not the most tedious.
 */
export type SetCurve = number[];

/**
 * Default curve: the third set is worth more than the first two combined,
 * while a two-set day still counts for something.
 */
export const CURVE_MODERATE: SetCurve = [0.15, 0.4, 1];

/**
 * Bonus per set **beyond** the target, as a share of the block base.
 * With three planned sets that means: 4th set +25 %, 5th set +10 %.
 *
 * The length is the hard ceiling – a 6th set deliberately yields nothing.
 * A curve that approaches zero but never ends would be an incentive to
 * overtrain; a visible end point is more honest.
 */
export const OVERFLOW_CURVE: SetCurve = [0.25, 0.1];

export interface XpConfig {
  /**
   * Point base per set. Total points of an exercise = `perSet * block.sets`;
   * the curve only distributes how much of that is unlocked when.
   */
  perSet: number;
  /** Flat bonus for a fully completed training day. */
  dayCompleted: number;
  /** A consciously taken rest day – rewards sticking to the plan. */
  restDay: number;
  curve: SetCurve;
  /**
   * Extra sets beyond the target. Applies to the set base only, not to
   * `dayCompleted` or `restDay`: the day bonus stands for completeness,
   * not for volume.
   */
  overflow: SetCurve;
}

export const DEFAULT_XP: XpConfig = {
  perSet: 10,
  dayCompleted: 50,
  restDay: 20,
  curve: CURVE_MODERATE,
  overflow: OVERFLOW_CURVE,
};

/**
 * Cumulative share after `completed` of `total` sets.
 *
 * If the set count matches the curve length, its values are used directly.
 * Otherwise the normalised position is interpolated linearly – so blocks with
 * 4 or 5 sets work as well.
 */
export function setShare(
  completed: number,
  total: number,
  curve: SetCurve = DEFAULT_XP.curve,
): number {
  if (total <= 0 || completed <= 0) return 0;
  if (completed >= total) return 1;
  if (total === curve.length) return curve[completed - 1];

  // Support points sit at (j + 1) / curve.length; we are looking for p.
  const p = completed / total;
  const x = p * curve.length - 1;
  const lo = Math.floor(x);
  const hi = Math.ceil(x);
  if (lo === hi) return curve[lo];

  const a = lo < 0 ? 0 : curve[lo];
  const b = curve[Math.min(hi, curve.length - 1)];
  return a + (b - a) * (x - lo);
}

/**
 * XP of a single block.
 *
 * Up to the target: total points times the unlocked share of `curve`.
 * Beyond it: a bonus per extra set according to `overflow`, capped by its
 * length. `planned` is the target from the plan, not the number of set entries
 * that actually exist.
 */
export function blockXp(
  completed: number,
  planned: number,
  cfg: XpConfig = DEFAULT_XP,
): number {
  if (planned <= 0) return 0;
  const base = planned * cfg.perSet;

  if (completed <= planned) {
    return Math.round(base * setShare(completed, planned, cfg.curve));
  }

  const extras = Math.min(completed - planned, cfg.overflow.length);
  let bonus = 0;
  for (let i = 0; i < extras; i++) bonus += cfg.overflow[i];
  return Math.round(base * (1 + bonus));
}

/** How many sets beyond the target still yield any XP at all. */
export function maxExtraSets(cfg: XpConfig = DEFAULT_XP): number {
  return cfg.overflow.length;
}

/** Planned set count of a result; without `plannedSets` the actual count wins. */
function plannedSetsOf(result: BlockResult): number {
  return result.plannedSets ?? result.sets.length;
}

/** XP of a completed session. */
export function sessionXp(session: WorkoutSession, cfg: XpConfig = DEFAULT_XP): number {
  if (session.status === 'rest') return cfg.restDay;
  if (session.status !== 'done') return 0;

  let xp = 0;
  let allComplete = session.results.length > 0;

  for (const result of session.results) {
    const planned = plannedSetsOf(result);
    const completed = result.sets.filter((s) => s.completed).length;
    xp += blockXp(completed, planned, cfg);
    if (completed < planned) allComplete = false;
  }

  return xp + (allComplete ? cfg.dayCompleted : 0);
}

/**
 * Append an extra set to a session (immutable).
 * Returns the session unchanged if the target is not yet met or the limit from
 * `overflow` has already been reached.
 */
export function withExtraSet(
  session: WorkoutSession,
  blockId: Id,
  cfg: XpConfig = DEFAULT_XP,
): WorkoutSession {
  const result = session.results.find((r) => r.blockId === blockId);
  if (!result) return session;

  const planned = plannedSetsOf(result);
  if (result.sets.length >= planned + maxExtraSets(cfg)) return session;
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
 * XP of a perfectly completed day – all sets plus the day bonus.
 * **Without** extra sets: 100 % means "plan fulfilled", not "maximum squeezed out".
 */
export function potentialXp(day: TrainingDay, cfg: XpConfig = DEFAULT_XP): number {
  if (day.restDay) return cfg.restDay;
  const sets = day.blocks.reduce((sum, b) => sum + b.sets, 0);
  return sets * cfg.perSet + cfg.dayCompleted;
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
/* The perfect period                                                  */
/* ------------------------------------------------------------------ */

/**
 * Average daily XP of a cyclic plan.
 * The cycle advances once per calendar day, but which days fall into a given
 * week depends on the phase – the mean makes the scale independent of that.
 */
export function dailyAverageXp(plan: TrainingPlan, cfg: XpConfig = DEFAULT_XP): number {
  if (plan.days.length === 0) return 0;
  const sum = plan.days.reduce((acc, d) => acc + potentialXp(d, cfg), 0);
  return sum / plan.days.length;
}

/**
 * Sum across `days` calendar days of a cyclic plan starting at `startDayId`.
 * `null` when no phase is known – then only the daily mean remains.
 */
function cyclicSum(
  plan: TrainingPlan,
  days: number,
  startDayId: Id | undefined,
  value: (day: TrainingDay) => number,
): number | null {
  if (!startDayId || plan.days.length === 0) return null;
  let day = orderedDays(plan).find((d) => d.id === startDayId);
  if (!day) return null;

  let sum = 0;
  for (let i = 0; i < days; i++) {
    sum += value(day);
    day = nextDay(plan, day.id);
  }
  return sum;
}

/**
 * XP of a gaplessly completed period – the reference value for 100 %.
 *
 * Weekly plan: exactly across the calendar days, so that months of differing
 * length and weekends are counted correctly.
 *
 * Cyclic plan: the cycle falls into the period phase-dependently – with a
 * four-day cycle the weekly sum ranges from 800 to 830 depending on the start.
 * If the cursor at the start of the period is known (`startDayId`), the phase
 * is computed exactly; without it the daily mean remains as a plan-independent
 * approximation that can be off by up to ±3 %.
 */
export function perfectXp(
  plan: TrainingPlan,
  scope: RankScope,
  date: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  startDayId?: Id,
): number {
  const { start, days } = periodRange(scope, date);

  if (!isWeekly(plan.schedule)) {
    const exact = cyclicSum(plan, days, startDayId, (d) => potentialXp(d, cfg));
    return exact ?? Math.round(dailyAverageXp(plan, cfg) * days);
  }

  const byId = new Map(plan.days.map((d) => [d.id, d]));
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const dayId = plan.schedule.assignments[isoWeekday(addDays(start, i))];
    const day = dayId ? byId.get(dayId) : undefined;
    if (day) sum += potentialXp(day, cfg);
  }
  return sum;
}

/* ------------------------------------------------------------------ */
/* Overflow control                                                    */
/* ------------------------------------------------------------------ */

/** Set base of a day without bonuses – the quantity `overflow` acts on. */
function setBaseXp(day: TrainingDay, cfg: XpConfig): number {
  if (day.restDay) return 0;
  return day.blocks.reduce((s, b) => s + b.sets, 0) * cfg.perSet;
}

/**
 * Set base of a gapless period – analogous to `perfectXp`, but without the
 * day and rest-day bonuses.
 */
export function perfectSetBase(
  plan: TrainingPlan,
  scope: RankScope,
  date: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  startDayId?: Id,
): number {
  const { start, days } = periodRange(scope, date);

  if (!isWeekly(plan.schedule)) {
    if (plan.days.length === 0) return 0;
    const exact = cyclicSum(plan, days, startDayId, (d) => setBaseXp(d, cfg));
    if (exact !== null) return exact;
    const avg = plan.days.reduce((s, d) => s + setBaseXp(d, cfg), 0) / plan.days.length;
    return Math.round(avg * days);
  }

  const byId = new Map(plan.days.map((d) => [d.id, d]));
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const dayId = plan.schedule.assignments[isoWeekday(addDays(start, i))];
    const day = dayId ? byId.get(dayId) : undefined;
    if (day) sum += setBaseXp(day, cfg);
  }
  return sum;
}

/**
 * The central condition for extra sets: they must **not** be able to make up
 * for a missed training day. Otherwise a consistency mechanic turns into a
 * volume mechanic.
 *
 * Both values are relative to the week **without** the missed day: `limit` is
 * the largest relative bonus on top of it that still fails to compensate the
 * day; `actual` is the bonus `cfg.overflow` produces at most – applied to the
 * set base of the remaining days, because the missed day yields no extra sets
 * either.
 */
export function overflowHeadroom(
  plan: TrainingPlan,
  date: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
): { limit: number; actual: number; safe: boolean } {
  const week = perfectXp(plan, 'week', date, cfg);
  const trainingDays = plan.days.filter((d) => !d.restDay);
  if (trainingDays.length === 0 || week === 0) {
    return { limit: 0, actual: 0, safe: true };
  }

  // Cheapest training day: the one whose absence weighs the least.
  const cheapestDay = trainingDays.reduce((a, b) =>
    potentialXp(a, cfg) <= potentialXp(b, cfg) ? a : b,
  );
  const cheapest = potentialXp(cheapestDay, cfg);
  const rest = week - cheapest;
  if (rest <= 0) return { limit: Infinity, actual: 0, safe: true };

  const totalOverflow = cfg.overflow.reduce((a, b) => a + b, 0);
  const base = perfectSetBase(plan, 'week', date, cfg) - setBaseXp(cheapestDay, cfg);

  const limit = cheapest / rest;
  const actual = (base * totalOverflow) / rest;

  return { limit, actual, safe: actual < limit };
}

/** Throws if the overflow curve could compensate for a missed day. */
export function assertOverflowSafe(
  plan: TrainingPlan,
  date: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
): void {
  const { limit, actual, safe } = overflowHeadroom(plan, date, cfg);
  if (!safe) {
    throw new Error(
      `Extra sets too generous: +${(actual * 100).toFixed(1)} % against a ` +
        `limit of ${(limit * 100).toFixed(1)} %.`,
    );
  }
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
   * Reference value for 100 %, computed from the plan when the period starts.
   * Stored in the state so that a later plan change does not retroactively
   * distort the running period.
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

export function createRankState(
  plan: TrainingPlan,
  now: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  /** Cursor of the cyclic plan - makes `max` phase-accurate. */
  startDayId?: Id,
): RankState {
  const scope = (s: RankScope): ScopeProgress => ({
    period: periodKey(s, now),
    xp: 0,
    max: perfectXp(plan, s, now, cfg, startDayId),
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
 * The new reference value is computed from the plan passed in.
 */
export function rollOver(
  state: RankState,
  plan: TrainingPlan,
  now: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  startDayId?: Id,
): RankState {
  let next = state;

  for (const scope of ['week', 'month', 'year'] as RankScope[]) {
    const key = periodKey(scope, now);
    const current = next[scope];
    if (current.period === key) continue;

    next = {
      ...next,
      [scope]: { period: key, xp: 0, max: perfectXp(plan, scope, now, cfg, startDayId) },
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
export function awardXp(
  state: RankState,
  xp: number,
  plan: TrainingPlan,
  now: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  startDayId?: Id,
): RankState {
  const base = rollOver(state, plan, now, cfg, startDayId);

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
  plan: TrainingPlan,
  now: Date = new Date(),
  cfg: XpConfig = DEFAULT_XP,
  startDayId?: Id,
): RankState {
  return awardXp(state, sessionXp(session, cfg), plan, now, cfg, startDayId);
}

function bestTier(scope: RankScope, previous: Id | null, p: ScopeProgress): Id {
  const tiers = TIERS[scope];
  const reached = tierFor(scope, p.xp, p.max);
  const prevIndex = previous ? tiers.findIndex((t) => t.key === previous) : -1;
  const nextIndex = tiers.findIndex((t) => t.key === reached.key);
  return nextIndex > prevIndex ? reached.key : previous!;
}
