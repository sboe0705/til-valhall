# Til Valhall

TypeScript data model for cyclic/weekday-based training plans plus a Norse-themed
rank system, and the Vue 3 app built on it.

Read this file first; [README.md](README.md) holds the long-form design rationale
(why each decision was made, calibration tables, extension points). Read the README
section that matches your task before changing XP or rank behaviour — the numbers in
it are load-bearing and were tuned deliberately. The UI is a recreation of
[design_handoff_til_valhall/](design_handoff_til_valhall/) — read its README before
changing anything visual; every hex value and size in it is a production value.

## Git workflow

- **Work on `main` and commit there.** Unless the request names a branch, no feature
  branch and no worktree — the change belongs on `main`.
- **Push only on confirmation.** Committing is yours to do, publishing is not: stop
  after the commit, say what it contains and wait for an explicit go-ahead before
  `git push`. A request that already asks for one ("commit and push", "push it to
  main") *is* that go-ahead — do not ask twice.

## Repository state

Vite 8 · Vue 3.5 · TypeScript 5.9 · Pinia 4 (+ `pinia-plugin-persistedstate`) ·
vue-router 5 · Vitest 4 · Playwright · ESLint 9 + Prettier · `vite-plugin-pwa`.

```
npm run dev          npm run test        npm run type-check
npm run build        npm run test:e2e    npm run lint
```

Two wrappers cover the local loop and are what the `build` / `run` skills under
[.claude/skills/](.claude/skills/) call: `./build.sh` runs lint → test → build in
the CI order, `./dev.sh` starts Vite and forwards its arguments (`./dev.sh --port
4000`).

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
│   ├── day-card.ts       the read-only "day box" Plan and Heute both render
│   ├── history.ts        per-day status, month entries and stats for the chronicle
│   ├── backup.ts         storage keys + localStorage export/import (Impressum)
│   └── format-de.ts      the German presentation layer
├── stores/               Pinia — training + ranks, one storage key each
├── composables/useNow.ts the app clock (midnight tick, visibilitychange)
├── ui/                   tokens.css, base.css, tiers.ts (colours, runes, rail labels, lore)
├── components/           shared and screen-specific SFCs (incl. AppFooter)
├── views/                Heute · Plan · Chronik · Ränge · Impressum
└── router/               one route per tab, plus /impressum
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
constructs it with `createRankState(now)` on first use — no plan, no config, no cursor,
since the maxima are absolute. The two
slices persist under **two separate keys**: `til-valhall.training` and
`til-valhall.ranks` — defined once as `TRAINING_KEY` / `RANKS_KEY` in
`src/app/backup.ts` and imported by the stores as their `persist.key`. Clearing
only one leaves the app inconsistent, which is why `applyBackup()` replaces the
whole `til-valhall.` prefix instead of merging into it.

The training store adds three app-level maps to `TrainingState` (persisted alongside it,
not part of the model):

- `bookedXp: Record<SessionId, number>` — what a session has already contributed
- `advancedBy: Record<SessionId, DayId>` — the cursor from *before* a completion
- `cursorDue: Record<PlanId, IsoDate>` — the calendar day the cursor's day is up on,
  cyclic plans only; `rollCursor()` reads it to close out the days that went by

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

- **A completed training day is worth exactly `DAY_XP` (120), whatever its layout.**
  The budget is split across the blocks with `splitEqually()`, and
  `completionShare(n, n) === 1` exactly — so no clamp is needed at the day level.
  If a day ever stops landing on 120, the curve or the split is broken.
- **Thresholds are absolute.** `RankTier.share` (0..1) resolves against
  `SCOPE_MAX` (840 / 3600 / 43200), never against the plan. `month`/`year` are
  *nominal* (30 / 360 days), so `completion` stays clamped with `Math.min(xp/max, 1)`.
- `assertLadder()`: lowest tier `share === 0`, top tier `share` in `(0, 1]`, strictly
  monotonic. The week tops out at `1`; month `0.9` and year `0.85` are the
  holidays/illness budget — 3 spare days a month, 59 a year.
- **Extra sets must never compensate for a missed training day.** Holds by
  construction: a day maxes at 138 XP, so 6 × 138 = 828 < 840. The one exception is
  a **4+ block day** (base 30, and 30 × 1.15 = 34.5 rounds up → 140, 141 at seven
  blocks), which ties the weekly maximum. That is a known, tested rounding artefact
  — see `ranks.test.ts` — not a bug to "fix" by clamping the day.
- `completionShare()` is strictly increasing on `[0, MAX_RATIO]`, exactly 1 at the
  target, 1.15 at the ceiling. The kink at `p = 1` **is** the "finishing pays"
  incentive; do not smooth it. `maxSets()` is a hard ceiling — do not replace it
  with an asymptotic tail.
- `ScopeProgress.max` is frozen at period start. It always equals `SCOPE_MAX` today,
  but `history` entries need the value they were graded against.
- `rollOver()` is idempotent — safe to call on every app start / date change.
- Reps, duration, `perSide` and **set counts** do not affect XP; only the *share* of
  the planned sets that is done. Weighting by reps or volume would reward easy
  high-rep exercises and turn consistency into volume. If differentiation is ever
  wanted, it belongs on `Exercise` (e.g. `intensity?: number` scaling the block's
  base), not on reps.

## App rules

- **XP is booked as a delta.** `awardXp()` only ever adds, but the design re-books on
  every tap including unchecking. The training store computes
  `liveSessionXp(session) − bookedXp[session.id]` and hands *that* to the rank store.
  Negative deltas are what gives the XP back; `bestTier()` never regresses, so
  records survive it — and every reset.
- **There is no "finish day" button.** The jump to the full 120 XP sits in the kink of
  the completion curve, so it appears the moment the last planned set is checked and
  disappears when one is unchecked. The cursor advance follows `isComplete()` and is
  undone from `advancedBy`.
- **A cycle day ends with its calendar day, finished or not.** Completing it advances
  the cursor there and then; every other day is closed out by `rollCursor()` on the next
  visit, which moves the cycle on by one for each day between `cursorDue[planId]` and
  today. An unfinished day is therefore *missed*, not carried over to the next morning,
  and the cycle rotates exactly once per calendar day — the rotation `agenda()` projects.
  `cursorDue` is stamped with tomorrow on a completion (today is spent) and back to today
  on a rollback; an undated cursor — a fresh state, or one persisted before the map
  existed — is stamped with today, so nothing is ever caught up retroactively. Weekly
  plans are untouched: their day follows from the weekday, and `ensureCursor()` drops the
  date instead of letting it go stale.
- **What follows today is previewed under "Tag vollständig"** — the Plan screen's day
  box, read-only, from `dayCard()` and `DayListItem`'s `readonly` mode. It appears and
  disappears with `isComplete()`, like the finish hint above it. `training.nextUp`
  resolves it: a **cyclic** plan rotates off *today's* day (`nextDay`), never off the
  cursor — that has already advanced by the time the preview shows — and dates it
  *tomorrow*, since the cycle turns with the calendar day. A
  **weekly** plan scans the next seven calendar days and skips the empty weekdays, so
  a finished Friday looks ahead to Monday and carries that date as the caption.
- **A block's base is not derivable from the block.** It depends on how many blocks
  share the day — `blockBasesOf(session)` computes the split, `HeuteView` hands each
  `ExerciseBlockCard` its `base`.
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
- **How often a record was reached is derived too.** `tierReachCount()` counts the
  matching `history` entries *plus the running period*, because that one already
  counts towards `records` — the Bestmarken card shows the number only from 2 up.

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
- **`weeklyPotential()` is display only.** It is the one function left that reads XP
  off a plan, and it feeds the Plan screen's `perfekte Woche: N / 840 XP` caption.
  Nothing grades against it — do not reach for it in the ladders.
- **A plan that leaves calendar days empty cannot reach Konungr.** A weekday plan
  maxes out at 600 of 840 and a rest day costs 100 XP against the ladder. That is
  the accepted price of an absolute weekly maximum, not an oversight.
- **Two different kinds of "off"**: `assignments[wd] === null` means nothing is
  scheduled that weekday (Sat/Sun); `day.restDay === true` is a deliberate rest day
  that exists as a day, rotates with the cycle, appears in history and earns
  `REST_XP`.
- `agenda()` advances the cyclic rotation once per calendar day, and so does the real
  cursor now (on completion, otherwise on the next `rollCursor()`) — the projection is
  the schedule unless the plan is edited in between. Nothing in the app calls it; it is
  there for a calendar view.
- `weekKey()` is ISO-8601 while `monthKey()`/`yearKey()` are calendar-based, so a date
  can be in `2026-W53` and `2027-01` at once. Intended.
- `createSession()` calls `crypto.randomUUID()` (browser / Node ≥ 19) unless an id is
  passed. Pass one in tests. The same goes for `makeDay()` — inject an `IdFactory`.
- `estimateDuration()` doubles rest time for `perSide` exercises, making it an upper
  bound. Known simplification, so the "geschätzt N Min" line is an upper bound too.
- `validatePlan()` has an `as any` cast at
  [schedule.ts:214](src/model/schedule.ts#L214) — narrow it properly if you refactor.
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
- **`__APP_COMMIT__` / `__APP_COMMIT_DATE__`** are the only `define`s in
  `vite.config.ts` (declared in `env.d.ts`, shown by `AppFooter.vue`). They are resolved
  once while the config loads, so `npm run dev` keeps the hash it started with until the
  server restarts, and a checkout without `.git` builds as `dev` — neither is a bug.
- **The backup import writes to `localStorage` and reloads the page** — it never
  pushes state into the stores. Hydration is the only path that brings both slices
  up in the right order with the training store's `afterHydrate` check in place.
  That check is also why `parseBackup()` insists on `schemaVersion === 1`: an
  unvalidated foreign file would trip `resetAll()` and *wipe* the data instead of
  being refused.
- **The palette is the LEGO Viking shields, not the handoff's greys** — see
  deviations 14/15 in the README. Six source tokens (`--vh-shield-gold` /
  `-yellow` / `-blue` / `-red` / `-green` / `-bone`) in `tokens.css`; every
  semantic (`--vh-accent`, `--vh-success`, `--vh-rest`, `--vh-overflow`,
  `--vh-danger`) resolves to one of them and nothing below that block invents a
  hue. The handoff's hard rules still hold: no gradients, no glows, `--vh-600`
  is border-only, `--vh-400` is the dimmest legal text colour.
- **`--vh-quadrant` is chrome, never semantics.** `App.vue` puts the route name
  on `.shell` as `data-screen` and `tokens.css` picks the screen's shield
  quarter from it (Heute gold · Plan blue · Chronik red · Ränge green). Only the
  screen eyebrow (`.vh-eyebrow--quadrant`), the `SectionRule` lead and the tab
  bar read it — XP stays gold on every screen, a rest day stays blue, and an
  eyebrow inside a card stays `--vh-400`.
- **`--vh-page` is black, `--vh-800` is the mid grey, `--vh-900` is a fill
  inside a card.** The page (`html`, `body`, `.shell`) is the only thing that is
  black; cards and the tab bar are the grey, and they carry every colour in the
  app — see deviation 16 in the README. The grey card is what the whole ramp is
  tuned against, so two habits from the handoff are now wrong: `--vh-700` and
  `--vh-600` are *lighter* than the card they sit on, not darker, and
  `--vh-900` is never a page background — it is the sunken step inside a card
  (open set pill, loot track, calendar cell).
- **German tier copy lives in `src/ui/tiers.ts`, not in the model.** `TIER_LORE`
  (the sentence behind the `i` button on each ladder) sits next to `TIER_RUNES` /
  `TIER_SHORT`; `RankTier.gloss` is the model's English one-liner and is rendered
  nowhere. `TierInfoDialog.vue` is the app's only modal — a native `<dialog>`, so
  it escapes the `.shell` overflow without a teleport.
- `/impressum` has no tab, so **no tab shows `router-link-active` while it is open**.
  That is intended; the tab bar's grid is `repeat(4, 1fr)` and the handoff fixes the four
  runes, so do not add a fifth tab.
- **The router's `scrollBehavior` is inert on its own.** `.shell` is a `100dvh` frame with
  `overflow: hidden`, so the window never scrolls; the real scroller is `.shell__scroll`
  and `App.vue` rewinds it on every `route.fullPath` change. Without that, a screen
  entered from the bottom of the previous one opens halfway down.

## Seed data reference

`defaultPlan` (`Walhall-Zyklus`): 4-day cycle — Day 1 has 3 blocks (9 sets), Days 2–4
have 2 blocks (6 sets) each. `weeklyPlan` (`Wochenplan`): same days, Mon/Tue/Thu/Fri
training, Wed an explicit `day-rest`, weekend `null`.

Display names are German (`Seitstütz`, `Rumpf & Trizeps`); **ids, set counts, targets
and `order` are unchanged** from the original English seed, which is why every figure
below still holds.

With `DAY_XP = 120`, `REST_XP = 20`, `MAX_RATIO = 5/3` and
`SCOPE_MAX = { week: 840, month: 3600, year: 43200 }`:

| | value |
|---|---|
| Day 1 / Days 2–4 / rest day | 120 / 120 / 20 XP |
| block base: Day 1 (3 blocks) / Days 2–4 (2 blocks) | 40 / 60 XP |
| 3-set block on base 40, 1…5 sets done | 6, 16, 40, 44, 46 XP |
| 3-set block on base 120 (single-block day) | 18, 48, 120, 132, 138 XP |
| `maxSets()` for 1…6 planned sets | 1, 3, 5, 6, 8, 10 |
| `weeklyPotential`: `defaultPlan` / `weeklyPlan` / `defaultPlan` as weekly | 840 / 500 / 480 |
| days needed for Konungr / Asgard / Odin | 7 / 27 / 306 |

These figures are asserted in `ranks.test.ts` and again, through the store and the
DOM, in `src/stores/training.spec.ts` and `e2e/smoke.spec.ts`. If a change moves them,
update the tests, the README tables *and* this table together — or explain why the
shift is intended.
