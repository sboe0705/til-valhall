# Til Valhall – Data Model

Data model for training plans in TypeScript, framework-neutral and directly
usable from Vue 3 / Pinia. Two plan types are supported:

- **cyclic** – Day 1 → 2 → 3 → 4 → 1 → …, independent of the calendar
- **weekday based** – fixed weekday → day mapping, e.g. weekend off

On top of that a rank system with Norse theming that turns completed sets into
XP and feeds three parallel ladders (week / month / year) from them.

```
src/
├── model/
│   ├── training.ts      # types + type guards (the data model proper)
│   ├── plan-cycle.ts    # rotation, formatting, session creation
│   ├── schedule.ts      # calendar resolution, weekdays, validation
│   ├── ranks.ts         # XP awards, rank ladders, period resets
│   └── ranks.test.ts    # invariants of the XP and rank mechanics (vitest)
└── data/
    └── default-plan.ts  # seed: 4-day cycle + weekly plan variant
```

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
| Cycle via `cursors`, not via calendar dates | A cyclic plan is periodic, not tied to weekdays – after a break you pick up where you left off. For a weekly plan the day follows directly from the date, which is why the cursor is ignored there. |
| Two kinds of "off": `null` assignment and `restDay` | `null` = nothing is scheduled on that weekday at all (Sat/Sun). `restDay` = a deliberately planned rest day that exists as a day, rotates with the cycle and shows up in the history. |
| `sessions` separate from the plan | Plan = target, session = actual. Plan changes do not distort the history (`dayName` is a snapshot). |
| `Record<Id, …>` instead of arrays for master data | O(1) lookup and simple immutable updates in the store. |
| `schemaVersion` in the state | Migration path for localStorage as soon as the model changes. |
| `RankState` separate from `TrainingState` | The rank system is a reward layer, not training data. It can be reset or replaced without touching the history. |
| Three ladders from **one** XP source | A checked-off set counts once and fills week, month and year simultaneously – so the mechanics cannot contradict each other. |
| `records` survives the reset | A hard reset on January 1st would otherwise devalue a whole year of work. The counter restarts, the title earned remains. |
| Thresholds as `share` instead of absolute values | A perfectly trained period is guaranteed to land on 100 %. Otherwise the values would have to be adjusted by hand on every plan change – and would still only be right for one plan type. |
| `ScopeProgress.max` in the state | The reference value is fixed at the start of the period; a plan change mid-month does not distort the running period. |
| `overflow` with a fixed length instead of a tail curve | A never-ending curve rewards arbitrary extra volume. The full stop after the 5th set is a design statement, not a rounding artefact. |
| `SetCurve` as cumulative sample points | The weighting is configuration, not a formula; interpolation makes it work for blocks with 4 or 5 sets too. |
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
calendar view needs. For cyclic plans the rotation advances per calendar day –
so the preview shows the course of events under the assumption "training every
day". The real cursor only advances when a session is completed
(`advanceCursor`), so after a break the preview shifts accordingly.
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
| `week` | Mondays (ISO) | Estate ladder of the Rígsþula | Drengr → Karl → Hersir → Jarl → Konungr |
| `month` | 1st of the month | The Nine Worlds | Niflheim → … → Midgard → … → Asgard |
| `year` | January 1st | Twelve Æsir by prominence | Bragi → … → Thor → Odin (top at 90 %) |

### Relative thresholds

The tiers are **not** stored as absolute values but as a `share` (0..1) of the
perfect period. The reference value comes from `perfectXp(plan, scope, date)`:
the XP a gaplessly completed period yields.

```ts
resolveTiers('week', perfectXp(weeklyPlan, 'week', date));
// Drengr 0 | Karl 98 | Hersir 221 | Jarl 353 | Konungr 490
```

That way a perfectly trained period lands on the top tier – regardless of how
many sets the days contain and whether the month has 28 or 31 days. If the plan
changes, the thresholds shift along with it automatically.

`ScopeProgress.max` is fixed at the start of a period so that a plan change
mid-month does not retroactively distort the running period.

The invariant (lowest tier `share: 0`, top tier `share` in `(0, 1]`, strictly
monotonic) is checked by `assertLadder()` – see `ranks.test.ts`.

#### Cyclic plans: mind the phase

With `schedule.kind === 'cyclic'` the cycle falls into the period phase
dependently. For the 4-day seed the perfect week varies between **800 and
830 XP** depending on the cursor position (Day 1 is worth 140, Days 2–4 are
worth 110 each). That is why `perfectXp` optionally takes the cursor:

```ts
perfectXp(defaultPlan, 'week', date);                          // 823 – daily average, phase blind
perfectXp(defaultPlan, 'week', date, DEFAULT_XP, 'day-1');     // 830 – exact for this phase
perfectXp(defaultPlan, 'week', date, DEFAULT_XP, 'day-2');     // 800
```

Without a cursor the daily average remains as a plan-independent approximation –
in which case a gaplessly trained week can get stuck at 97.2 % in the worst
phase and miss Konungr. `createRankState()`, `rollOver()`, `awardXp()` and
`applySession()` pass the cursor through as their last optional argument;
supplying it buys you the "gapless = top tier" guarantee for cyclic plans too.
For weekly plans the parameter makes no difference.

### Awarding XP

The total points of an exercise follow from `perSet × block.sets`. The
`SetCurve` only determines how much of that is unlocked after how many sets –
cumulative, monotonically increasing, last value always `1`:

```ts
CURVE_MODERATE = [0.15, 0.4, 1];   // 3-set block, max. 30 XP → 5 / 12 / 30
```

The last set is therefore worth more than the first two combined. That is the
core of the mechanic: finishing an exercise should pay off, not starting one.
For differing set counts the value is interpolated over the normalised position
(5 sets → 5 / 10 / 18 / 32 / 50).

On top of that come `dayCompleted` for a fully checked-off day and `restDay` for
a deliberately taken rest day – the latter rewards sticking to the plan rather
than mere activity.

**Repetitions** do not enter the XP calculation: `3 x 10 pull-ups` and
`3 x 30 biceps per side` are both worth 30 base XP, as is `3 x 1:00 min per side`
side plank. `perSide` does not double the XP either – it describes how a set is
executed, not how many sets there are.
Weighting by repetitions would reward the easy high-rep exercises and devalue
the hard ones. If differentiation is wanted after all, the factor belongs on the
`Exercise` (e.g. `intensity?: number` as a multiplier on `perSet`), not on the
repetition count.

### Extra sets beyond the target

Anyone who does a fourth set after the three planned ones should get something
for it – but not arbitrarily much. `OVERFLOW_CURVE` gives the surcharge as a
share of the block base:

```ts
OVERFLOW_CURVE = [0.25, 0.1];   // 4th set +25 %, 5th set +10 %, nothing after that
```

A 3-set block (base 30 XP) therefore yields 5 / 12 / 30 / 38 / 41 / 41 / 41 XP.
The length of the array is a **hard ceiling**: a curve that tends towards zero
but never ends would be an incentive to overtrain; a visible full stop is more
honest.

The surcharge only affects the set base, not `dayCompleted` or `restDay` – the
day bonus stands for completeness, not for volume. `100 %` therefore stays
"plan fulfilled", not "maximum extracted"; `completion` is capped.

`withExtraSet(session, blockId)` appends a set and refuses while the target is
still open or the limit has been reached. It requires
`BlockResult.plannedSets` – without that value a fourth set could not be told
apart from a target of "4 sets". `ranks.ts` declares the field itself; if you
want it in the core model, move it to `training.ts` and have `createSession()`
fill it with `block.sets` right away.

### The limit for extra sets

Extra sets must **not** be able to make up for a missed training day, otherwise
a consistency mechanic turns into a volume mechanic. From that follows a hard
ceiling, computed by `overflowHeadroom()` and enforced by `assertOverflowSafe()`
as a test. The reference value for both figures is the week **without** the
missed day – that is where the comparison happens:

```
rest   = perfect week − cheapest training day
limit  = cheapest training day / rest
actual = (set base of the week − set base of the cheapest day) × Σ overflow / rest
```

The subtraction in the numerator matters: there are no extra sets on the missed
day either, so its volume must not count towards the surcharge.

| Plan | perfect week | limit | surcharge with `[0.25, 0.1]` | |
|---|---|---|---|---|
| `weeklyPlan` (4 workouts + rest day) | 490 | 28.9 % | 19.3 % | ok |
| `defaultPlan` (cyclic, 7 workouts) | 823 | 15.4 % | 20.3 % | **too much** |

The reason is structural: the more training days a week has, the less a single
missed one weighs – and the more easily it can be replaced by extra volume. In
this respect rest days make the week more robust.

For the cyclic plan without a rest day it is not the shape of the curve that
matters but its sum: anything below **Σ overflow ≈ 0.266** is safe.
`[0.15, 0.07]` (Σ 0.22 → +12.7 %) sits comfortably below that, `[0.18, 0.08]`
(Σ 0.26 → +15.1 %) nearly exhausts the limit, `[0.25, 0.1]` (Σ 0.35) breaks it.
A single rest day in the cycle is not yet enough for the default curve
(limit 19.1 % against a 19.3 % surcharge) – it would take two (22.7 % against
18.4 %).

### Flow

```ts
import {
  applySession, createRankState, rollOver, tierProgress, withExtraSet,
} from './model/ranks';

// Pass the cursor optionally – for cyclic plans it makes `max` exact.
let ranks = createRankState(plan, new Date(), DEFAULT_XP, state.cursors[plan.id]);

// On app start / day change: close expired periods and compute the new
// reference value from the plan. Idempotent, therefore repeatable.
ranks = rollOver(ranks, plan, new Date(), DEFAULT_XP, state.cursors[plan.id]);

// Optional: extra set once the target has been met.
session = withExtraSet(session, blockId);

// After finishing a workout: book the XP onto all three ladders.
ranks = applySession(ranks, session, plan);

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

Simulated over a fully trained year 2026, all sets checked off:

| Plan type | XP/week | August | Year | Result |
|---|---|---|---|---|
| `weeklyPlan` (Mon–Fri + rest day) | 490 | 2,100 | 25,590 | Konungr / Asgard / Odin |
| `defaultPlan` (cyclic, daily, cursor `day-1`) | 830 | 3,650 | 42,910 | Konungr / Asgard / Odin |

Both plan types land on 100 % because the reference value comes from the
respective plan – Odin already falls at 90 % (see below).

Without a cursor passed through, `perfectXp` computes the daily average for the
cyclic plan and returns 823 / 3,643 / 42,888. Depending on the phase the actual
values above deviate from that by −2.8 % to +0.9 %; `completion` is capped at 1,
but there is no buffer on the downside. Hence the optional cursor parameter.

Individual daily XP for checking the maths: Day 1 (9 sets) 140, Days 2–4
(6 sets each) 110, rest day 20.

### Headroom at the top

Week and month end at `share: 1` – gapless training lands exactly on Konungr and
Asgard respectively. The yearly ladder, by contrast, ends at **`share: 0.9`**:
over twelve months holidays, illness and days without a pull-up bar are certain
to happen, and a single missed set in January should not make Odin
arithmetically impossible for eleven months.

Concretely that means (weekly plan, simulated year 2026, misses spread evenly
across all weekdays):

| Training behaviour | Year total | Rank |
|---|---|---|
| gapless | 100 % | Odin – reached on **November 26th**, a good five weeks of buffer |
| every 10th day missed | 89.4 % | Thor – just short |
| every 7th day missed | 85.7 % | Thor |
| every 5th day missed | 79.9 % | Týr |

The 90 % threshold therefore sits almost exactly at "at most every tenth day is
missed" – deliberately tight, but attainable.

`assertLadder()` permits a top tier in `(0, 1]`; above 1 it would be
unreachable. Should the monthly ladder feel too strict as well (a holiday costs
roughly a third there), Asgard can be set to `0.95` with the same move.

## Vue 3 / Pinia

```ts
// stores/training.ts
import { defineStore } from 'pinia';
import { initialState } from '../data/default-plan';
import { nextDay } from '../model/plan-cycle';
import { agenda, dayForDate } from '../model/schedule';
import type { AgendaEntry } from '../model/schedule';
import type { TrainingDay, TrainingState } from '../model/training';

export const useTrainingStore = defineStore('training', {
  // structuredClone is mandatory: defaultPlan and weeklyPlan share the objects
  // in `days`, so a mutation would otherwise hit both plans.
  state: (): TrainingState => structuredClone(initialState),

  getters: {
    activePlan: (s) => (s.activePlanId ? s.plans[s.activePlanId] : null),
    // works for cyclic and weekly plans alike
    currentDay(): TrainingDay | null {
      const p = this.activePlan;
      return p ? dayForDate(p, new Date(), this.cursors[p.id]) : null;
    },
    week(): AgendaEntry[] {
      const p = this.activePlan;
      return p ? agenda(p, new Date(), 7, this.cursors[p.id]) : [];
    },
  },

  actions: {
    completeWorkout(sessionId: string) {
      const s = this.sessions.find(x => x.id === sessionId)!;
      s.status = 'done';
      s.finishedAt = new Date().toISOString();
      const plan = this.plans[s.planId];
      // only advance the cursor for cyclic plans
      if (plan.schedule.kind === 'cyclic') {
        this.cursors[plan.id] = nextDay(plan, s.dayId).id;
      }
    },
  },

  persist: true, // pinia-plugin-persistedstate
});
```

Mutating directly inside the store is fine (Pinia/Vue reactivity); the functions
in `plan-cycle.ts` are deliberately free of side effects and therefore
individually testable.

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
- `agenda()` assumes one cycle day per calendar day for cyclic plans; the real
  cursor only advances on completion. The preview is therefore an
  "if everything goes to plan" scenario, not a promise.
- `weekKey()` follows ISO-8601, `monthKey()`/`yearKey()` follow the calendar. At
  the turn of the year a session can therefore fall into week `2026-W53` and
  month `2027-01` at the same time – that is intended.

## Notes

`Side Plank`, `Triceps Exercise`, `Bow Pull` and `Biceps Exercise` are stored
with `perSide: true` in the seed data – the side plank because the minute
applies per side, the biceps curl because both arms are trained separately with
a resistance band. The flag only affects the display and the duration estimate –
the XP calculation counts sets, not sides, so the rank figures are unaffected.

All `id` values (`ex-side-plank`, `day-1`, `plan-default`, …) are stable
persistence keys for localStorage, the session history and rank assets. Display
names may change freely, ids may not: renaming one once data has been persisted
requires a migration via `schemaVersion`. The same holds for `RankTier.key`,
which is why the tier keys stay Old Norse (`konungr`, `asgard`, `odinn`) rather
than following the display names.
