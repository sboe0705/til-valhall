# Til Valhall

TypeScript data model for cyclic/weekday-based training plans plus a Norse-themed
rank system, and the Vue 3 app built on it.

Read this file first; [README.md](README.md) holds the long-form design rationale
(why each decision was made, calibration tables, extension points). Read the README
section that matches your task before changing XP or rank behaviour — the numbers in
it are load-bearing and were tuned deliberately. The UI is a recreation of
[design_handoff_til_valhall/](design_handoff_til_valhall/) — read its README before
changing anything visual; every hex value and size in it is a production value.

## Repository state

Vite 8 · Vue 3.5 · TypeScript 5.9 · Pinia 4 (+ `pinia-plugin-persistedstate`) ·
vue-router 5 · Vitest 4 · Playwright · ESLint 9 + Prettier · `vite-plugin-pwa`.

```
npm run dev          npm run test        npm run type-check
npm run build        npm run test:e2e    npm run lint
```

- The app is **German, dark-only, mobile-first** (design frame 390 × 844). The model
  stays English and framework-free.
- `src/model/**` must not import Vue, Pinia or anything from `src/app`, `src/ui`,
  `src/stores` or `src/views`. The dependency arrow only points one way.
- The design prototype under `design_handoff_til_valhall/` re-implements XP maths so
  the mock could be clickable. **Nothing there is ported** — every figure on screen
  comes from `ranks.ts`. That directory is lint-ignored.

## Layout

```
src/
├── model/                the framework-free core
│   ├── training.ts       types + 2 type guards — the data model proper, no logic
│   ├── plan-cycle.ts     cycle rotation, formatting, duration estimate, session creation
│   ├── schedule.ts       calendar ↔ day resolution, weekdays, agenda, plan validation
│   ├── plan-edit.ts      add/remove/move days, positional numbering, weekday sync
│   └── ranks.ts          XP awards, three rank ladders, period roll-over
├── data/
│   └── default-plan.ts   seed: 4-day cyclic plan + weekly variant + initialState
├── app/                  pure glue on top of the model — still no framework imports
│   ├── session-xp.ts     live XP, set-pill semantics, planned/extra set accounting
│   ├── history.ts        per-day status, month entries and stats for the chronicle
│   └── format-de.ts      the German presentation layer
├── stores/               Pinia — training + ranks, one storage key each
├── composables/useNow.ts the app clock (midnight tick, visibilitychange)
├── ui/                   tokens.css, base.css, tiers.ts (colours, runes, rail labels)
├── components/           shared and screen-specific SFCs
├── views/                Heute · Plan · Chronik · Ränge
└── router/               one route per tab
e2e/                      Playwright smoke test
```

The deliberate deviations from the design handoff are listed in
[README.md](README.md) — read them before "fixing" something that looks off
against the prototype.

Dependency direction is strictly one-way:
`training.ts` ← `plan-cycle.ts` ← `schedule.ts` ← `plan-edit.ts` / `ranks.ts` ←
`default-plan.ts` ← `src/app/**` ← `src/stores/**` ← `src/views/**`.
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

`RankState` is **not** part of `TrainingState` and has no seed value — the rank store
constructs it with `createRankState(plan, now, cfg, cursorDayId)` on first use. The two
slices persist under **two separate keys**: `til-valhall.training` and
`til-valhall.ranks`. Clearing only one leaves the app inconsistent.

The training store adds two app-level maps to `TrainingState` (persisted alongside it,
not part of the model):

- `bookedXp: Record<SessionId, number>` — what a session has already contributed
- `advancedBy: Record<SessionId, DayId>` — the cursor from *before* a completion

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

## App rules

- **XP is booked as a delta.** `awardXp()` only ever adds, but the design re-books on
  every tap including unchecking. The training store computes
  `liveSessionXp(session) − bookedXp[session.id]` and hands *that* to the rank store.
  Negative deltas are what revokes the day bonus; `bestTier()` never regresses, so
  records survive it — and every reset.
- **There is no "finish day" button.** `dayCompleted` is part of `liveSessionXp()`, so
  it appears the moment the last planned set is checked and disappears when one is
  unchecked. The cursor advance follows the same condition and is undone from
  `advancedBy`.
- **Today's day comes from today's session, not from the cursor.** Completing a day
  advances the cursor; resolving the screen from the cursor would make it jump to
  tomorrow's day mid-tap. `dayForDate()` is only consulted when no session exists yet.
- **`liveSessionXp()` exists because `sessionXp()` returns 0 unless the status is
  `done`/`rest`.** Both agree once a session is closed — asserted in
  `session-xp.spec.ts`. Do not fork the curve maths; everything delegates to `blockXp`.
- **Editing the plan re-resolves an *untouched* session for today**
  (`revalidateToday()`), so switching the schedule or reordering days changes what
  "Heute" shows. A session with progress in it is left alone.
- Day numbers, weekday assignment, tier thresholds and `ScopeProgress.max` are
  **derived, never stored** — see `dayNumbers()` and `resolveTiers()`.

## Traps

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
  passed. Pass one in tests. The same goes for `makeDay()` — inject an `IdFactory`.
- `estimateDuration()` doubles rest time for `perSide` exercises, making it an upper
  bound. Known simplification, so the "geschätzt N Min" line is an upper bound too.
- `validatePlan()` has an `as any` cast at
  [schedule.ts:200](src/model/schedule.ts#L200) — narrow it properly if you refactor.
  It is the only ESLint warning in the repo.
- **`syncWeekdays()` lays the day list out from Monday across all seven weekdays**,
  while `convertSchedule()` fills Mon–Fri only. They agree for up to five days; beyond
  that a sixth day would otherwise exist in the list but never be scheduled.
- The seed `weeklyPlan` assigns Wednesday to `day-rest`, which sits *fifth* in the day
  list — so the weekday grid is rendered from `schedule.assignments`, never from list
  position. Any structural edit re-derives the week and normalises that.
- **Inert controls use `aria-disabled`, not `disabled`** (day arrows at the ends,
  "letzter Tag", the clamped `›`, an invalid "Tag anlegen"). Playwright will refuse to
  click them — use `click({ force: true })` when a test asserts that nothing happens.

## Seed data reference

`defaultPlan` (`Walhall-Zyklus`): 4-day cycle — Day 1 has 3 blocks (9 sets), Days 2–4
have 2 blocks (6 sets) each. `weeklyPlan` (`Wochenplan`): same days, Mon/Tue/Thu/Fri
training, Wed an explicit `day-rest`, weekend `null`.

Display names are German (`Seitstütz`, `Rumpf & Trizeps`); **ids, set counts, targets
and `order` are unchanged** from the original English seed, which is why every figure
below still holds.

With `DEFAULT_XP` (`perSet: 10`, `dayCompleted: 50`, `restDay: 20`,
`CURVE_MODERATE = [0.15, 0.4, 1]`, `OVERFLOW_CURVE = [0.25, 0.1]`):

| | value |
|---|---|
| Day 1 / Days 2–4 / rest day | 140 / 110 / 20 XP |
| 3-set block, 1…7 sets done | 5, 12, 30, 38, 41, 41, 41 XP |
| `weeklyPlan` perfect week / Aug / year | 490 / 2,100 / 25,590 |
| `defaultPlan` perfect week (cursor `day-1` / `day-2` / none) | 830 / 800 / 823 |

These figures are asserted in `ranks.test.ts` and again, through the store and the
DOM, in `src/stores/training.spec.ts` and `e2e/smoke.spec.ts`. If a change moves them,
update the tests, the README tables *and* this table together — or explain why the
shift is intended.
