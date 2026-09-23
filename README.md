# Til Valhall

Data model for training plans in TypeScript, framework-neutral, plus the Vue 3
app built on it. Two plan types are supported:

- **cyclic** – Day 1 → 2 → 3 → 4 → 1 → …, independent of the calendar
- **weekday based** – fixed weekday → day mapping, e.g. weekend off

On top of that a rank system with Norse theming: every completed training day is
worth a fixed 120 XP, and three parallel ladders (week / month / year) are fed
from them.

```
src/
├── model/                # the framework-free core
│   ├── training.ts       # types + type guards (the data model proper)
│   ├── plan-cycle.ts     # rotation, formatting, session creation
│   ├── schedule.ts       # calendar resolution, weekdays, validation
│   ├── plan-edit.ts      # add/remove/move days, positional numbering
│   └── ranks.ts          # XP awards, rank ladders, period resets
├── data/
│   └── default-plan.ts   # seed: 4-day cycle + weekly plan variant
├── app/                  # pure glue: live session XP, chronicle, German formatting
├── stores/               # Pinia: training + ranks
├── ui/ components/ views/ router/ composables/
e2e/                      # Playwright smoke test
```

```
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest – model, glue and stores
npm run test:e2e     # Playwright – the four screens end to end
npm run build        # type-check + production bundle (installable PWA)
```

The UI is a recreation of the developer handoff in
[design_handoff_til_valhall/](design_handoff_til_valhall/): German, dark-only,
mobile-first, four screens (Heute · Plan · Chronik · Ränge) plus an Impressum the
handoff does not have. The prototype in that folder re-implements the XP maths so
the mock could be clickable; none of that is ported — every figure on screen comes
from `ranks.ts`.

## Structure

```
TrainingState
├── exercises: Record<Id, Exercise>     exercise master data (name, muscle groups, perSide)
├── plans:     Record<Id, TrainingPlan>
│   ├── schedule: PlanSchedule          'cyclic' | 'weekly' + weekday mapping
│   └── days:  TrainingDay[]            incl. rest days (restDay: true)
│       └── blocks: ExerciseBlock[]     exercise + sets + target (Target)
├── cursors:   Record<PlanId, DayId>    cyclic plans only
└── sessions:  WorkoutSession[]         history: what was actually done, and when

RankState                               separate slice, fed from completed sessions
├── week / month / year: ScopeProgress  period + XP total + max (the 100 % reference)
├── records:  Record<RankScope, Id>     highest rank ever reached – survives the reset
└── history:  completed periods         chronicle for looking back
```

### Why this split

| Decision | Rationale |
|---|---|
| `Exercise` separate from `ExerciseBlock` | Renaming an exercise takes effect everywhere; the same exercise can appear on several days with different targets. |
| `Target` as a discriminated union | "20 reps with a 5 s hold" and "hold for 1 minute" are different things. The compiler forces the UI to handle both cases. |
| `perSide` on the `Exercise`, not on the block | It is a property of the exercise itself (a bow pull is always one-sided). |
| `schedule` as a discriminated union instead of a flag | The weekday mapping only exists for `kind: 'weekly'` – no dead fields, and the compiler forces both cases in the UI. |
| `days` independent of `schedule` | The same day content works in both modes; `convertSchedule()` switches over without losing training content. |
| Cycle via `cursors`, not via calendar dates | A cyclic plan is periodic, not tied to weekdays: the cursor says which day is up, and nothing in the model derives it from the date. The app dates that cursor and moves it on once per calendar day (see "An unfinished day" below), but a different rule – carry the day over, skip only workdays – would be a change to the store alone. For a weekly plan the day follows directly from the date, which is why the cursor is ignored there. |
| Two kinds of "off": `null` assignment and `restDay` | `null` = nothing is scheduled on that weekday at all (Sat/Sun). `restDay` = a deliberately planned rest day that exists as a day, rotates with the cycle and shows up in the history. |
| `sessions` separate from the plan | Plan = target, session = actual. Plan changes do not distort the history (`dayName` is a snapshot). |
| `Record<Id, …>` instead of arrays for master data | O(1) lookup and simple immutable updates in the store. |
| `schemaVersion` in the state | Migration path for localStorage as soon as the model changes. |
| `RankState` separate from `TrainingState` | The rank system is a reward layer, not training data. It can be reset or replaced without touching the history. |
| Three ladders from **one** XP source | A checked-off set counts once and fills week, month and year simultaneously – so the mechanics cannot contradict each other. |
| `records` survives the reset | A hard reset on January 1st would otherwise devalue a whole year of work. The counter restarts, the title earned remains. |
| The record *count* is derived, not stored | `tierReachCount()` reads it off `history` plus the running period, so it needs no extra field and stays correct after an import. It counts the running period too, because that one already set the record – a Konungr week is worth 1 the moment it is reached, not 2 once Monday archives it. |
| A fixed 120 XP per training day, split across its blocks | Volume is a means, not the goal. A day with two blocks and a day with four are worth the same, so the scale never depends on how a plan is cut – and balancing the blocks against each other stays the user's job, not the app's. |
| Thresholds as `share` of an absolute maximum | `share` keeps the ladder shape readable and drives the percentage display; `SCOPE_MAX` makes the scale plan-independent by construction, because every day is worth the same. The price is explicit: a plan that leaves calendar days empty cannot reach the weekly top. |
| `ScopeProgress.max` in the state | Always `SCOPE_MAX` today, but `history` entries need the value they were graded against – changing a maximum later must not retroactively regrade closed periods. |
| `maxSets()` as a hard ceiling instead of a tail curve | A curve that tends towards zero but never ends rewards arbitrary extra volume. The full stop at 166 % of the target is a design statement, not a rounding artefact. |
| One continuous curve instead of per-set sample points | Sample points need interpolation for every set count the table does not cover. Five anchors and two polynomials work for any target, and the kink at the target is the "finishing pays" incentive itself. |
| No streak mechanic | A deliberate decision: streaks punish individual misses disproportionately and create pressure instead of motivation. |

## Typical flow

```ts
import { initialState, defaultPlan } from './data/default-plan';
import { createSession, advanceCursor, upcoming, formatBlock } from './model/plan-cycle';

let state = initialState;

// Determine the day that is up next
const plan = state.plans[state.activePlanId!];
const dayId = state.cursors[plan.id];
const today = plan.days.find(d => d.id === dayId)!;

// Start the workout
const session = createSession(plan, today);
state = { ...state, sessions: [...state.sessions, session] };

// … check off sets (session.results[i].sets[j].completed = true) …

// Finish and advance the cycle
state = advanceCursor(state, plan.id);

// Preview (starts at the current cursor day)
upcoming(plan, state.cursors[plan.id], 3).map(d => d.name); // ["Day 2", "Day 3", "Day 4"]
```

Rendering a single row:

```ts
formatBlock(today.blocks[0], state.exercises['ex-side-plank']); // "3 x 1:00 min per side"
formatBlock(today.blocks[2], state.exercises['ex-triceps']);    // "3 x 40 reps per side"
```

## Weekday based plans

```ts
import { weeklyPlan } from './data/default-plan';
import { agenda, assignWeekday, convertSchedule, dayForDate, isoWeekday } from './model/schedule';

// What is up today? (null = no training)
dayForDate(weeklyPlan, new Date());

// Week preview – rest days included
agenda(weeklyPlan, new Date(2026, 7, 3), 7);
// [{ date: '2026-08-03', weekday: 1, day: {name:'Day 1',…}, isRest: false },
//  …
//  { date: '2026-08-08', weekday: 6, day: null,            isRest: true  }]

// Editor: assign Day 2 to Saturday, then clear it again
let plan = assignWeekday(weeklyPlan, 6, 'day-2');
plan = assignWeekday(plan, 6, null);

// Switch plan type (days are preserved)
const asWeekly = convertSchedule(defaultPlan, 'weekly');
// lays the days out in order starting on Monday; with four days that means
// Mon–Thu, leaving Fri/Sat/Sun free. No explicit rest day is created.
```

`agenda()` works for both plan types and is therefore the only function a
calendar view needs. For cyclic plans the rotation advances per calendar day,
which is what the app does with the real cursor too – on completion, otherwise
the next time it is opened – so the preview is the schedule rather than a guess.
`advanceCursor(state, planId, steps)` takes those steps in one go: one for the
day that was finished, several for the days that simply went by.
`nextWorkoutDay()` skips rest days when you only want the next real workout.
`validatePlan()` returns error messages for a plan editor (unknown day ids,
completely empty week).

`toIsoDate()` deliberately formats from the **local** date parts instead of via
`toISOString()`: the latter converts to UTC and, east of Greenwich (e.g.
CET/CEST), returns the previous day for local midnight – `date` and `weekday` of
an `AgendaEntry` would then be off by one against each other.

## Rank system

Three parallel ladders over the same XP source, each with its own reset:

| Level | Reset | System | Tiers |
|---|---|---|---|
| `week` | Mondays (ISO) | Estate ladder of the Rígsþula | Drengr → Karl → Hersir → Jarl → Konungr (top at 100 %) |
| `month` | 1st of the month | The Nine Worlds | Niflheim → … → Midgard → … → Asgard (top at 90 %) |
| `year` | January 1st | Twelve Æsir by prominence | Bragi → … → Thor → Odin (top at 85 %) |

### Absolute thresholds

The tiers are stored as a `share` (0..1) – that keeps the ladder shape readable
and drives the percentage display – but resolved against a **fixed** maximum per
ladder:

```ts
SCOPE_MAX = { week: 840, month: 3600, year: 43200 };   //   7 / 30 / 360 × 120 XP

resolveTiers('week', SCOPE_MAX.week);
// Drengr 0 | Karl 210 | Hersir 420 | Jarl 630 | Konungr 840
```

The scale is plan-independent by construction: every training day is worth the
same 120 XP, so nothing about the ladder needs to know how a plan is cut. There
is no phase to get right, no reference value to recompute on a plan edit, and no
way for a plan change to shift a running period's thresholds.

The trade-off is real and deliberate: **a plan that leaves calendar days empty
cannot reach the weekly top.** A Mon–Fri plan with weekends off maxes out at
600 of 840 XP, which is Jarl, not Konungr. Konungr means the perfect week and
demands all seven days – even a single rest day (120 → 20 XP) puts it out of
reach. The Plan screen therefore prints what the current plan can reach next to
what the ladder asks for (`weeklyPotential()`, display only – nothing grades
against it).

`month` and `year` are **nominal** reference values, not calendar-exact: a
gapless 31-day month yields 3720 and a gapless 365-day year 43800, both above
the reference. `completion` is therefore clamped with `Math.min(xp / max, 1)`.
The slack this leaves at the top is what makes the monthly and yearly ladders
livable – see [Calibration](#calibration).

`ScopeProgress.max` stays in the state even though it is always `SCOPE_MAX`
today: `history` entries need the value they were graded against, so a future
change to the maxima does not retroactively regrade closed periods.

The invariant (lowest tier `share: 0`, top tier `share` in `(0, 1]`, strictly
monotonic) is checked by `assertLadder()` – see `ranks.test.ts`.

### Awarding XP

A completed training day is worth `DAY_XP = 120`, always. That budget is split
equally across the blocks of the day – 1 block 120, 2 blocks 60, 3 blocks 40,
4 blocks 30 (`splitEqually()` rounds cumulatively, so the parts always sum to
exactly 120). A planned rest day is worth `REST_XP = 20`.

Balancing the blocks against each other is the user's responsibility. The app
makes no attempt to weight a 5-set block higher than a 2-set one; if a day feels
lopsided, the day gets reshaped.

Within a block the XP follows one continuous curve over `p = completed / planned`,
anchored on five points:

| `p` | 1/3 | 2/3 | 1 | 4/3 | 5/3 |
|---|---|---|---|---|---|
| share | 0.15 | 0.40 | **1.00** | 1.10 | 1.15 |

```ts
f(p) = 1.125p³ − 0.675p² + 0.55p          // up to the target
g(d) = 1 + 0.375d − 0.225d², d = p − 1    // beyond it
```

Both are strictly increasing on their domain (f′ has a negative discriminant,
g′(⅔) = 0.075 > 0). The **kink at `p = 1` is deliberate**: it is the "finishing
pays" incentive, and it is why there is no separate day bonus any more. A 3-set
block on a base of 40 XP therefore yields 6 / 16 / 40 / 44 / 46 – the last
planned set is worth more than the first two combined.

Because `completionShare(n, n)` is exactly 1, a fully completed day lands on
exactly 120 for any layout; no clamping is needed at the day level.

**Repetitions** do not enter the XP calculation: `3 x 10 pull-ups` and
`3 x 30 biceps per side` are worth exactly as much, as is `3 x 1:00 min per side`
side plank – what counts is the share of the planned sets that is done.
`perSide` does not double the XP either: it describes how a set is executed, not
how many sets there are.
Weighting by repetitions would reward the easy high-rep exercises and devalue
the hard ones. If differentiation is wanted after all, the factor belongs on the
`Exercise` (e.g. `intensity?: number` scaling the block's base), not on the
repetition count.

### Extra sets beyond the target

Anyone who does a fourth set after the three planned ones should get something
for it – but not arbitrarily much. The same curve covers it: **+15 % at most**,
with a hard stop at 166 % of the target.

```ts
maxSets(planned);   // 1→1, 2→3, 3→5, 4→6, 5→8, 6→10
```

`maxSets()` is a **hard ceiling**, not an asymptote: a curve that tends towards
zero but never ends would be an incentive to overtrain; a visible full stop is
more honest. A 3-set block on a base of 40 therefore yields 6 / 16 / 40 / 44 / 46
and nothing beyond – the same reach the old two-entry overflow curve had, so the
feel of the seed plan is unchanged.

The one-line proof that this cannot turn a consistency mechanic into a volume
mechanic: a day maxes out at 138 XP, so six maxed days give 828 – less than the
840 a perfect week asks for. **Extra sets can never make up for a missed day.**

There is one documented exception, and it is a rounding artefact rather than a
design decision: on a day of **four or more blocks** the per-block base is 30, and
30 × 1.15 = 34.5 rounds up, so such a day reaches 140 rather than 138 (141 with
seven blocks). Six of those tie – or just clear – the weekly maximum. Reaching it
takes a 4+ block day plus maximal extra sets on every one of its blocks for six
days running, at which point the user has done considerably more work than the
missed day was worth. Both bounds are pinned in `ranks.test.ts`.

`withExtraSet(session, blockId)` appends a set and refuses while the target is
still open or the ceiling has been reached. It relies on `BlockResult.plannedSets`
– without that value a fourth set could not be told apart from a target of
"4 sets" – which `createSession()` fills in for every block.

### Flow

```ts
import {
  applySession, createRankState, rollOver, tierProgress, withExtraSet,
} from './model/ranks';

// No plan, no config, no cursor – the maxima are absolute.
let ranks = createRankState(new Date());

// On app start / day change: close expired periods. Idempotent, so repeatable.
ranks = rollOver(ranks, new Date());

// Optional: extra set once the target has been met.
session = withExtraSet(session, blockId);

// After finishing a workout: book the XP onto all three ladders.
ranks = applySession(ranks, session);

// Display
const w = tierProgress('week', ranks.week);
`${w.tier.name} – ${w.remaining} XP to go until ${w.next?.name}`; // "Karl – 123 XP to go until Hersir"
w.ratio;       // 0..1 within the tier → progress bar
w.completion;  // 0..1 across the whole period → the "100 %" display
```

`applySession()` books the XP into the period of `now`, not into the period of
`session.startedAt`. If you log workouts retroactively, pass the session's date
through.

### Calibration

With a flat 120 XP a day the ladders reduce to arithmetic – what matters is how
many days each top tier costs, and how many are left over:

| Scope | top tier | top XP | days needed | slack |
|---|---|---|---|---|
| Week | Konungr | 840 | 7 | 0 |
| Month (28 d) | Asgard | 3,240 | 27 | 1 day |
| Month (30 d) | Asgard | 3,240 | 27 | 3 days |
| Month (31 d) | Asgard | 3,240 | 27 | 4 days |
| Year (365 d) | Odin | 36,720 | 306 | 59 days |

Odin becomes reachable on **November 2nd** of a gapless year. February works
too: 28 gapless days give 3,360 > 3,240. A rest day costs 100 XP against the
ladder, which fits inside the monthly and yearly slack but not the weekly one –
Konungr means the perfect week and still demands all seven days.

Individual daily XP for checking the maths: every training day 120, rest day 20.
Within Day 1 (three blocks) each block carries 40 of those; on Days 2–4 (two
blocks) each carries 60.

### Headroom at the top

The week ends at `share: 1` – gapless training lands exactly on Konungr, and
nothing less will do. The month ends at **`0.9`** and the year at **`0.85`**:
over twelve months holidays, illness and days without a pull-up bar are certain
to happen, and a single missed day in January should not make Odin
arithmetically impossible for eleven months. The slack table above is what those
two numbers buy – 59 spare days a year, three to four a month.

`assertLadder()` permits a top tier in `(0, 1]`; above 1 it would be
unreachable. Should the weekly ladder feel too harsh (it is the only one with no
slack at all, so a single rest day caps the week at Jarl), Konungr can be moved
below 1 with the same one-line change.

## Vue 3 / Pinia

Two stores mirror the model's split, each with its own storage key
(`til-valhall.training`, `til-valhall.ranks`) via `pinia-plugin-persistedstate`.
`useTrainingStore` seeds with `structuredClone(initialState)` — mandatory,
because `defaultPlan` and `weeklyPlan` share the objects in `days`.

**XP is booked as a delta.** `awardXp()` only ever adds, while the design
re-books on every tap of a set pill, including unchecking. The store therefore
keeps `bookedXp[sessionId]` and hands over the difference:

```ts
const xp = liveSessionXp(session);              // src/app/session-xp.ts
const delta = xp - (bookedXp[session.id] ?? 0);
ranks.award(delta, now);
bookedXp[session.id] = xp;
```

A negative delta is what gives the XP back when a set is unchecked;
`bestTier()` never regresses, so `records` survives it — and every reset.

**There is no "finish day" action.** The jump to the full 120 XP sits in the
completion curve, so it appears the moment the last planned set is checked and
disappears when one is unchecked. The cursor advance follows `isComplete()` and
is undone from `advancedBy[sessionId]`, which stores the cursor value from
before the completion.

**An unfinished day is missed, not postponed.** A cycle day used to sit on
"Heute" until every planned set stood, so a Monday left half-done came up again
on Tuesday. It now ends with its calendar day: `cursorDue[planId]` dates the
cursor – tomorrow once the day is completed, today otherwise – and `rollCursor()`
advances the cycle by one for every day that has passed since, on app start and
on every date change. The session that was left behind keeps the XP it earned
and stays in the chronicle as `partial`; the new day starts from zero. Weekly
plans never had the problem: their day follows from the weekday, so
`ensureCursor()` drops the date there instead of letting it go stale. `liveSessionXp()` exists because `sessionXp()` returns 0
unless the status is `done`/`rest`; both agree once the session is closed.

A block's base depends on how many blocks share the day, so it is not derivable
from the block alone: `blockBasesOf(session)` computes it once per screen and
`HeuteView` hands each `ExerciseBlockCard` its `base`.

`rollOver()` runs on app start and on every date change, driven by
`composables/useNow.ts` (a midnight timer plus `visibilitychange`).

### Backup: export and import

Nothing leaves the device, which also means nothing survives a cleared browser
profile. `src/app/backup.ts` closes that gap; the two links sit in the Impressum,
right under the paragraph that names the storage keys.

The file is an envelope with both slices unwrapped into real JSON, indented so it
stays readable and diffable:

```json
{
  "app": "til-valhall",
  "format": 1,
  "exportedAt": "2026-08-04T09:12:03.418Z",
  "data": {
    "til-valhall.training": { "state": { "schemaVersion": 1, … }, "bookedXp": { … } },
    "til-valhall.ranks": { "state": { … } }
  }
}
```

Four decisions worth keeping:

- **The prefix is scanned, not a key list.** `collectBackup()` walks every
  `til-valhall.*` key, so a third slice would be backed up without a code change.
  `TRAINING_KEY` / `RANKS_KEY` now live in `backup.ts` and the stores import them
  as their `persist.key` — one source of truth.
- **`parseBackup()` validates before anything is written**, down to
  `state.schemaVersion === 1`. This is not belt-and-braces: the training store's
  `afterHydrate` silently calls `resetAll()` on an unknown `schemaVersion`, so an
  unchecked import of a foreign file would *delete* the data instead of failing.
- **`applyBackup()` replaces the prefix, it does not merge into it.** A leftover
  key the file does not know about would pair a restored training state with
  stale ranks — the same inconsistency as clearing only one of the two keys.
- **The import writes to `localStorage` and reloads.** Hydration through the
  persistence plugin is the only path that brings both slices up in the right
  order with the `afterHydrate` check in place; filling the stores by hand would
  bypass it. Hence also the inline confirmation before the overwrite — the action
  is destructive and immediate.

## Deviations from the design handoff

All deliberate; where the handoff and the model disagree, the model wins — as
the handoff itself prescribes.

1. **The weekday grid is rendered from `schedule.assignments`**, not from list
   position. The seed `weeklyPlan` puts its rest day on Wednesday while the day
   sits fifth in the list, and position would draw that wrong. Structural edits
   re-derive the week with `syncWeekdays()`.
2. **Month and year ladder shares come from `ranks.ts`**
   (`0.11 / 0.23 / 0.34 / …`, `0.08 / 0.15 / 0.23 / …`), not from the handoff's
   proposal — its own open question defers to the model.
3. **The Plan screen's "perfekte Woche: N / 840 XP" shows what the current plan
   can reach against what the weekly ladder asks for.** The handoff has a single
   figure; two are needed now that the maximum is absolute, because a plan that
   leaves calendar days empty can never close the gap — and that is a property
   of the plan the user should see, not discover on a Sunday.
4. **"geschätzt N Min" comes from `estimateDuration()`** and is an upper bound,
   so it is not the constant the mock shows.
5. **The rest-day and nothing-scheduled variants of "Heute" were not designed.**
   They reuse the existing tokens: the rest-day copy with rune `ᛁ` in
   `--vh-rest` and its 20 XP booked once, or a quieter "kein Tag belegt" card.
6. **The header shows `plan.name`**, which does not change with the schedule
   kind — the model has one name per plan, and the schedule switch converts the
   active plan rather than swapping to another one.
7. **Fonts are self-hosted** (`@fontsource`, latin + latin-ext + runic subsets)
   instead of a Google Fonts request, so the installed PWA works offline.
8. The phone shell, status bar and wordmark around the frame are mock chrome and
   are not implemented, as the handoff states.
9. **The checked set pill is stronger than the handoff's.** Its `#14231A` fill
   with a 1px border read as a hairline against the card, so the fill is raised
   to `#1A2F21` (`#2F2114` for the overflow variant, a gentler lift because
   `--vh-overflow` is a mid-tone and a brighter fill would cost contrast) and the
   border becomes a 2px ring via an inset shadow. The `✓` grows from 15px/500 to
   18px/600, and the XP line below it loses the `.72` dim, which is what carries
   it over 4.5:1 at 9px. Hover is scoped to the open pill.
10. **The build stamp and the Impressum are net-new.** The handoff specifies four
    screens and no about or legal surface, but a publicly reachable German site
    needs one. `AppFooter.vue` closes the Heute content with
    `v<commit> · <date> · Impressum` in `--vh-mono` / `--vh-400`; it scrolls with
    the screen rather than becoming a fifth band above the tab bar. The link opens
    `/impressum`, a plain `.vh-screen` of `SectionRule` + `.vh-card` blocks — a
    legal page is a page, not a popup, even though point 11 has since added a
    modal pattern — and deliberately not a
    fifth tab, since the tab bar is a `repeat(4, 1fr)` grid. The version itself
    comes from `git log -1` at config load, injected as `__APP_COMMIT__` /
    `__APP_COMMIT_DATE__`, falling back to `dev` without a `.git` directory.
11. **The rank lore dialog is net-new.** An 18px `i` button sits behind the current
    rank on each `LadderCard` and opens `TierInfoDialog.vue` with one sentence of
    mythological background — the ladders name 26 tiers the handoff never explains.
    The texts live in `TIER_LORE` in `src/ui/tiers.ts`, next to the runes and rail
    abbreviations, because they are German presentation copy; `RankTier.gloss`
    stays the model's English one-liner and is still rendered nowhere. The dialog
    is a native `<dialog>` with `showModal()`, which puts it in the top layer and
    therefore outside the `.shell` frame (`100dvh`, `overflow: hidden`) without a
    teleport, and brings Esc and focus containment for free. It closes on Esc, on
    the backdrop and on "Schließen"; the button's circle stays 18px while an
    `::after` inset of `-7px` gives it a 32px hit area, so the tier name does not
    shift for it.
12. **The next day's preview on "Heute" is net-new.** The handoff ends the screen
    at the finish hint; once every planned set stands, the Plan screen's day box
    now follows it read-only, so the reward for finishing is immediately followed
    by what it unlocked. Both screens build the box from `dayCard()` in
    `src/app/day-card.ts` and render it through `DayListItem`, whose `readonly`
    mode drops the reorder column, the caret and the delete button — the preview
    has nothing to edit. Which day it is comes from `training.nextUp`: a cyclic
    plan rotates off *today's* day rather than the cursor, which has already moved
    on by then, and is dated tomorrow, because the cycle turns with the calendar
    day; a weekly plan scans the next seven days and skips the free
    weekdays, so a finished Friday looks ahead to Monday and shows that date as
    the section caption.
13. **"Abgeschlossene Perioden" sits above "Bestmarken".** The handoff puts the
    three record cards first, but they only ever move a step at a time and read
    the same for weeks on end, while the closed-period list is what actually
    changes — so the list takes the position right under the ladders and the
    records close the screen. Nothing else about either block changes.
14. **The tab bar shows shields, not runes.** Each tab carries one of the four
    LEGO Viking shield prints as a 26px SVG (`src/assets/shields/`): Heute the
    red-and-blue chain shield, Plan the blue-and-stone triquetra shield, Chronik
    the yellow-and-red rune ring, Ränge the green-and-gold scrollwork. The prints
    are the icon, so they are not tinted with the accent: inactive tabs dim them
    to `.45` opacity and 60% saturation, the active tab shows them in full. The
    labels are silver instead of gold, matching the shield rims: `--vh-400` at
    rest, `--vh-200` on hover, `--vh-050` when active. The 16×2 underline pill
    is dropped — the full-colour shield and the bright label already mark the
    active tab.

## Extension points

- **Progression**: add `progression?: { every: number; deltaReps: number }` to `ExerciseBlock` and apply it in `advanceCursor`.
- **Weights**: `SetResult.weightKg` is already provided for; for targets, extend `Target` with `{ kind: 'weight' }`.
- **Multiple plans**: `plans` is already a record – switching `activePlanId` is enough.
- **Multi-week plans (A/B weeks)**: extend `PlanSchedule` with `{ kind: 'weeklyRotation'; weeks: WeekdayAssignments[] }`; `agenda()` is the only place that needs adapting.
- **Holidays / exceptions**: add `TrainingPlan.overrides?: Record<IsoDate, Id | null>` and check it in `dayForDate()` before the weekday rule.
- **Monthly goals**: a separate type next to the ranks, e.g. `{ id, month, kind: 'sessions' | 'xp' | 'exercise', target }`; the evaluation can build on `sessions` and `RankState.month`.
- **Rank assets**: `RankTier.key` is meant as a stable key for icons and badges – display names may change without breaking persistence or file names.
- **More ladders**: extend `RankScope` and `TIERS`; `rollOver()` and `awardXp()` already iterate over all scopes.
- **Backend**: `TrainingState` is plain JSON and can serve as an API payload 1:1.

## Known simplifications

- `estimateDuration()` also doubles the rest time for `perSide` exercises. Day 1
  therefore comes out at 37 min – more of an upper bound. If you want to count
  the rest only once per set, pull `restSeconds` out of the `perSide` factor.
- `weekKey()` follows ISO-8601, `monthKey()`/`yearKey()` follow the calendar. At
  the turn of the year a session can therefore fall into week `2026-W53` and
  month `2027-01` at the same time – that is intended.

## Notes

`Seitstütz`, `Trizepsdrücken`, `Bogenzug` and `Bizepscurl` are stored with
`perSide: true` in the seed data – the side plank because the minute applies per
side, the biceps curl because both arms are trained separately with a resistance
band. The flag only affects the display and the duration estimate – the XP
calculation counts sets, not sides, so the rank figures are unaffected.

All `id` values (`ex-side-plank`, `day-1`, `plan-default`, …) are stable
persistence keys for localStorage, the session history and rank assets. Display
names may change freely, ids may not: renaming one once data has been persisted
requires a migration via `schemaVersion`. The same holds for `RankTier.key`,
which is why the tier keys stay Old Norse (`konungr`, `asgard`, `odinn`) rather
than following the display names.

The seed's display names are German because the UI is – the code, the comments
and the model's own formatting helpers stay English. Everything the screens
print goes through `src/app/format-de.ts`, so a second language would only need
a sibling of that module.
