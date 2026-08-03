# Til Valhall

TypeScript data model for cyclic/weekday-based training plans plus a Norse-themed
rank system. **Model only — there is no app yet.**

Read this file first; [README.md](README.md) holds the long-form design rationale
(why each decision was made, calibration tables, extension points). Read the README
section that matches your task before changing XP or rank behaviour — the numbers in
it are load-bearing and were tuned deliberately.

## Repository state

- **No `package.json`, no `tsconfig.json`, no lockfile, no CI.** Nothing can be
  built, type-checked, linted or run today.
- `src/model/ranks.test.ts` is written for **vitest**, but vitest is not installed.
  Do not claim tests pass — they cannot be executed until tooling is added.
- Sources are plain `.ts` with ESM-style extensionless relative imports
  (`from './training'`), targeted at a bundler (Vite).
- Intended consumer per the README: Vue 3 + Pinia (`pinia-plugin-persistedstate`),
  but no framework code exists and the model must stay framework-free.
- Only two commits so far; `main` is the working branch.

## Layout

```
src/
├── model/
│   ├── training.ts     types + 2 type guards — the data model proper, no logic
│   ├── plan-cycle.ts   cycle rotation, formatting, duration estimate, session creation
│   ├── schedule.ts     calendar ↔ day resolution, weekdays, agenda, plan validation
│   ├── ranks.ts        XP awards, three rank ladders, period roll-over
│   └── ranks.test.ts   invariants of the XP/rank mechanics (vitest)
└── data/
    └── default-plan.ts seed: 4-day cyclic plan + weekly variant + initialState
```

Dependency direction is strictly one-way:
`training.ts` ← `plan-cycle.ts` ← `schedule.ts` ← `ranks.ts` ← `default-plan.ts`/tests.
`training.ts` imports nothing. Keep it that way.

## The two state roots

```
TrainingState                          // src/model/training.ts
├── schemaVersion: 1                   // bump + migrate when ids/shape change
├── exercises: Record<Id, Exercise>    // master data (name, muscleGroups, perSide)
├── plans:     Record<Id, TrainingPlan>
│   ├── schedule: PlanSchedule         // {kind:'cyclic'} | {kind:'weekly', assignments}
│   └── days:  TrainingDay[]           // ordered by `order`; rest days are real days
│       └── blocks: ExerciseBlock[]    // exerciseId + sets + Target + order
├── activePlanId: Id | null
├── cursors:   Record<PlanId, DayId>   // cyclic plans only
└── sessions:  WorkoutSession[]        // actuals; results[] → BlockResult → SetResult[]

RankState                              // src/model/ranks.ts — a SEPARATE slice
├── week / month / year: ScopeProgress // { period, xp, max }
├── records:  Record<RankScope, Id|null>  // best tier ever, survives resets
└── history:  { scope, period, xp, max, tier }[]
```

`RankState` is **not** part of `TrainingState` and has no seed value — construct it
with `createRankState(plan, now, cfg, cursorDayId)`. If you add persistence, it needs
its own storage key and its own migration story.

Two discriminated unions drive nearly all branching; always handle both arms:

- `Target` = `{kind:'reps', reps, holdSeconds?}` | `{kind:'duration', seconds}`
  (guards: `isRepTarget`, `isDurationTarget`)
- `PlanSchedule` = `{kind:'cyclic'}` | `{kind:'weekly', assignments}`
  (guard: `isWeekly` in `schedule.ts`)

## Conventions

- **Pure functions, immutable updates.** Every exported function returns new objects
  (`{...state, ...}`); nothing mutates its arguments. No side effects, no I/O, no
  framework imports anywhere under `src/model/`.
- **`Id` is `string`** and every id is a **stable persistence key** (`ex-side-plank`,
  `day-1`, `plan-default`, `RankTier.key` like `konungr`/`odinn`). Display names may
  change freely; ids may not — renaming one after data is persisted needs a
  `schemaVersion` migration. This is why tier keys stay Old Norse and don't track the
  display names.
- **Dates**: ISO-8601 strings in the model (`createdAt`, `startedAt`), `Date` objects
  in function arguments. `now`/`date` is always an optional last-ish parameter
  defaulting to `new Date()` so behaviour stays testable.
- **Ordering** is by an explicit `order` field, never by array position — use
  `orderedDays(plan)` and `blocksInOrder(day)`.
- **Weekdays are ISO**: 1 = Monday … 7 = Sunday. Convert with `isoWeekday(date)`,
  never `Date.getDay()` directly.
- Comments and identifiers are English; comment style is the `/* --- section --- */`
  banner plus JSDoc explaining *why*, not *what*.

## Invariants that must not be broken

- **A gapless period lands on the top tier.** Tier thresholds are relative
  (`RankTier.share`, 0..1) against `perfectXp(plan, scope, …)`, never absolute.
- `assertLadder()`: lowest tier `share === 0`, top tier `share` in `(0, 1]`, strictly
  monotonic. Week and month top out at `1`; the year tops out at `0.9` on purpose
  (holidays/illness budget — Odin at ~90 % consistency).
- **Extra sets must never compensate for a missed training day.** Enforced by
  `overflowHeadroom()` / `assertOverflowSafe()`. `defaultPlan` (cyclic, 7 workout
  days/week) *deliberately fails* this check with `DEFAULT_XP` — that's an
  intentional, documented finding, not a bug to fix. Σ `overflow` ≲ 0.266 is safe
  there.
- `SetCurve` is cumulative, strictly increasing, last value exactly `1`.
  `OVERFLOW_CURVE`'s array **length is a hard ceiling** (nothing past the 5th set);
  do not replace it with an asymptotic tail.
- `ScopeProgress.max` is frozen at period start so a mid-period plan edit can't
  retroactively distort the running period.
- `rollOver()` is idempotent — safe to call on every app start / date change.
- Reps, duration and `perSide` do **not** affect XP; only set counts do. Weighting by
  reps would reward easy high-rep exercises. If differentiation is ever wanted, it
  belongs on `Exercise` (e.g. `intensity?: number` scaling `perSet`), not on reps.

## Traps

- **`createSession()` does not set `plannedSets`.** `BlockResult.plannedSets` is added
  to `training.ts` by a `declare module` augmentation *inside* `ranks.ts`
  ([ranks.ts:37](src/model/ranks.ts#L37)) and is only written by `withExtraSet()`.
  Everything else falls back to `result.sets.length`, so a 4th set is
  indistinguishable from a target of 4 sets until `withExtraSet` has run. If you
  touch this area, prefer moving the field into `training.ts` and populating it in
  `createSession()`.
- **`defaultPlan` and `weeklyPlan` share the same `TrainingDay` objects**
  ([default-plan.ts:190](src/data/default-plan.ts#L190) spreads `defaultPlan.days`).
  Always `structuredClone(initialState)` before mutating.
- **`advanceCursor()` does not check the schedule kind.** Cursors are meaningless for
  weekly plans; only call it for `kind: 'cyclic'` — the caller is responsible.
- **`applySession()` books XP into the period of `now`, not of `session.startedAt`.**
  Pass the session's date explicitly when backfilling workouts.
- **Never use `toISOString()` for calendar dates.** Use `toIsoDate()`, which reads
  local date parts — `toISOString()` shifts to UTC and returns the previous day for
  local midnight east of Greenwich (CET/CEST).
- **`perfectXp` for cyclic plans is phase-dependent.** Without `startDayId` it falls
  back to a daily average that can be off by ±3 % (4-day seed: 800–830 XP/week), and a
  gapless week can then stall at 97.2 % and miss the top tier. Pass
  `state.cursors[plan.id]` through `createRankState`/`rollOver`/`awardXp`/
  `applySession` whenever it is available. Ignored for weekly plans.
- **Two different kinds of "off"**: `assignments[wd] === null` means nothing is
  scheduled that weekday (Sat/Sun); `day.restDay === true` is a deliberate rest day
  that exists as a day, rotates with the cycle, appears in history and earns
  `restDay` XP.
- `agenda()` advances the cyclic rotation once per calendar day, but the real cursor
  only moves on completion — the preview is an "if all goes to plan" projection.
- `weekKey()` is ISO-8601 while `monthKey()`/`yearKey()` are calendar-based, so a date
  can be in `2026-W53` and `2027-01` at once. Intended.
- `createSession()` calls `crypto.randomUUID()` (browser / Node ≥ 19) unless an id is
  passed. Pass one in tests.
- `estimateDuration()` doubles rest time for `perSide` exercises, making it an upper
  bound. Known simplification.
- `validatePlan()` has an `as any` cast at
  [schedule.ts:200](src/model/schedule.ts#L200) — narrow it properly if you refactor.

## Seed data reference

`defaultPlan`: 4-day cycle — Day 1 has 3 blocks (9 sets), Days 2–4 have 2 blocks
(6 sets) each. `weeklyPlan`: same days, Mon/Tue/Thu/Fri training, Wed an explicit
`day-rest`, weekend `null`.

With `DEFAULT_XP` (`perSet: 10`, `dayCompleted: 50`, `restDay: 20`,
`CURVE_MODERATE = [0.15, 0.4, 1]`, `OVERFLOW_CURVE = [0.25, 0.1]`):

| | value |
|---|---|
| Day 1 / Days 2–4 / rest day | 140 / 110 / 20 XP |
| 3-set block, 1…7 sets done | 5, 12, 30, 38, 41, 41, 41 XP |
| `weeklyPlan` perfect week / Aug / year | 490 / 2,100 / 25,590 |
| `defaultPlan` perfect week (cursor `day-1` / `day-2` / none) | 830 / 800 / 823 |

These figures are asserted in `ranks.test.ts`. If a change moves them, update the
test, the README tables *and* this table together — or explain why the shift is
intended.
