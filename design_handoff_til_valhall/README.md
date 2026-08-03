# Handoff: Til Valhall — Mobile Workout Tracker

## Overview

Til Valhall is a Norse-themed workout tracker. This handoff covers the complete mobile
app UI: managing a training plan (cyclic or weekday-based), logging a workout set by
set, reviewing history, and following three parallel XP rank ladders (week / month /
year).

The prototype is built against the data model in
<https://github.com/sboe0705/til-valhall> (`src/model/training.ts`, `plan-cycle.ts`,
`schedule.ts`, `ranks.ts`). All XP figures, ladder tiers and thresholds in the design
are derived from that README's specification and reproduce its calibration numbers
exactly. **The model is the source of truth — where this document and the model
disagree, the model wins.**

Target stack per the repo: **Vue 3 + TypeScript + Pinia** (`pinia-plugin-persistedstate`).

## About the Design Files

`Til Valhall.dc.html` (plus its runtime `support.js`) is a **design reference created in
HTML** — a prototype demonstrating intended look, copy and behaviour. It is **not
production code to port line by line.** The task is to **recreate this design inside the
Til Valhall Vue 3 codebase**, using its existing components, stores and conventions.
The prototype's own JS re-implements parts of `ranks.ts` (XP curve, thresholds) purely
so the mock could be interactive; in the real app that logic must come from the
existing model modules, not be duplicated.

Open the file directly in a browser to interact with it (all four tabs are live).

## Fidelity

**High-fidelity.** Final colours, typography, spacing, states and copy (German). The
UI should be recreated pixel-accurately with the codebase's component library. Every
hex value, font size and radius in this document is the intended production value.

Design frame: **390 × 844 px** (iPhone-class viewport), dark mode only. Light mode is
out of scope for this handoff; see "Open questions".

---

## Global structure

```
┌─ status bar          42px, flex-none
├─ scroll area         flex:1, overflow-y:auto, overflow-x:hidden
│    └─ one of: Heute | Plan | Chronik | Ränge
└─ tab bar             74px, flex-none
```

Root phone container: `width:390px; height:844px; background:#0F1416;
border:1px solid #2C383E; border-radius:38px; overflow:hidden;
display:flex; flex-direction:column`.
(The `outline:10px solid #161D21` and the caption/wordmark around it are presentation
chrome for the mock — **do not** implement them.)

Every screen body: `padding:8px 18px 28px; display:flex; flex-direction:column;
gap:16px; animation: vhrise .24s ease` where

```css
@keyframes vhrise { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
```

### Tab bar

`height:74px; background:#161D21; border-top:1px solid #2C383E;
display:grid; grid-template-columns:repeat(4,1fr); align-items:center; padding:0 6px`

Each tab is a 60px-high column: runic glyph (19px, Noto Sans Runic) · label (10px/500,
IBM Plex Sans, letter-spacing .06em) · 16×2px underline pill.

| Tab | Label | Rune | Active | Inactive |
|---|---|---|---|---|
| heute | Heute | `ᛞ` | `#D4A537`, underline `#D4A537` | `#6B7B84`, underline transparent |
| plan | Plan | `ᛃ` | " | " |
| chronik | Chronik | `ᚱ` | " | " |
| raenge | Ränge | `ᛊ` | " | " |

Colour transition `.18s`.

---

## Screen 1 — Heute

**Purpose:** log today's workout, set by set.

### Layout (top to bottom, gap 16px)

**1. Header** (`flex-column`, gap 5px)
- Row: date left — `Sonntag, 2. August` — 10px/500 IBM Plex Mono, `letter-spacing:.18em`,
  uppercase, `#6B7B84`; plan name right (`Walhall-Zyklus` / `Wochenplan`), same style
  without uppercase, `letter-spacing:.12em`.
- `<h1>`: `Tag 1 · Zug & Rumpf` — 32px/1.02 **Grenze Gotisch 600**, `#E8EDEF`.
  The number is derived from the day's *position* among training days, not stored.
- Sub: `3 Übungen · 9 Sätze · geschätzt 37 Min` — 13px/1.45 IBM Plex Sans, `#AFBCC2`.

**2. Rank strip** — card `background:#161D21; border:1px solid #2C383E;
border-radius:12px; padding:13px 14px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px`.
Per column: scope label (9px mono, `.16em`, uppercase, `#6B7B84`) · tier name
(15px/1.1 Grenze 600, `#E8EDEF`, ellipsis) · 3px track (`#2C383E`, radius 2) with fill
in the **tier colour**, `transition:width .35s ease` · percent (10px mono `#6B7B84`).

**3. Tagesbeute card** — `#161D21`, 1px `#2C383E`, radius 14, padding 15/16, gap 12.
Decorative rune `ᛞ` top-right, 15px, `#2C383E`.
- "TAGESBEUTE" (9px mono, `.16em`, uppercase, `#6B7B84`)
- live XP: 30px/1 **IBM Plex Mono 600**, `#D4A537`; then `/ 140 XP` 13px mono `#6B7B84`
- hint right-aligned, 11px/1.3 IBM Plex Sans `#AFBCC2`, max-width 150px
- progress: outer `height:6px; background:#0F1416; border:1px solid #2C383E; radius:4`,
  inner `height:4px; background:#D4A537; transition:width .35s ease`

**4. Section rule** — "SÄTZE" (10px mono, `.18em`, uppercase, `#6B7B84`) · 1px `#2C383E`
hairline `flex:1` · counter `4 / 9` (10px mono `#6B7B84`).

**5. Exercise block cards** (one per `ExerciseBlock`)
`#161D21`, 1px `#2C383E`, radius 14, `padding:14px 15px 15px`, gap 12.
- Title 17px/1.15 **Grenze 600** `#E8EDEF` (exercise name)
- Target line 12px/1.3 mono `#AFBCC2` — output of `formatBlock()`, e.g.
  `3 × 20 Wdh. pro Seite`, `3 × 1:00 Min pro Seite`
- Muscles 11px IBM Plex Sans `#6B7B84`
- Right: `<done> / <max> XP` 11px/500 mono; colour `#6B7B84` open, `#4FA86A` complete,
  `#B5763A` when overflow sets are booked
- **Set pills**: `flex; gap:8px; flex-wrap:wrap`. Each **52 × 52 px**, radius 10,
  column-centred: mark (15px mono — `✓` when done, else the set number) over XP
  (9px mono, opacity .72 — `+30` when done, `30 XP` when open).
  - open: bg `#0F1416`, border `#2C383E`, text `#6B7B84`
  - done: bg `#14231A`, border `#4FA86A`, text `#4FA86A`
  - done **overflow** set: bg `#2A1D12`, border `#B5763A`, text `#B5763A`
  - hover: `border-color:#6B7B84`; transitions `.18s`
- **Extra-set button** — only rendered when the block's target is met and fewer than
  `OVERFLOW_CURVE.length` extra sets exist. 52px tall, `padding:0 13px`, radius 10,
  `background:#0F1416`, **1px dashed `#B5763A`**, text `#B5763A`, rune `ᚹ` over "Extra".
  Hover bg `#1F282D`.
- **Note line** (11px/1.35 IBM Plex Sans), shown once the block is complete:
  - no extra: `Block voll – der letzte Satz war mehr wert als die ersten beiden zusammen.` (`#4FA86A`)
  - with extra: `Extrasatz gebucht · Aufschlag 25 % auf die Satzbasis, danach ist Schluss.` (`#B5763A`)

**6. Footer hint** — 11px/1.4 IBM Plex Sans `#6B7B84`, centred:
- incomplete: `Erst wenn alle Pflichtsätze stehen, gibt es die 50 XP für den vollen Tag.`
- complete: `+50 XP Tagesbonus gebucht · Zeiger rückt auf Tag 2`

> There is deliberately **no "finish day" button**. `dayCompleted` is booked implicitly
> the moment every planned set of every block is checked, and revoked if a set is
> unchecked. The cursor advance (`advanceCursor` / `completeWorkout`) is triggered by
> the same condition.

### Interaction

- Tapping set pill *k*: `done = (done === k ? k − 1 : k)` — tapping the current last
  done set unchecks it, tapping any other set checks up to it. Never a plain toggle.
- Extra button appends one set (`withExtraSet(session, blockId)`); it must refuse while
  the target is still open or the ceiling is reached — in the UI it simply isn't shown.
- Every change immediately re-books XP into all three ladders (rank strip animates).

---

## Screen 2 — Plan

**Purpose:** manage the plan. The **day list is the only editable surface.**

**1. Header** — "DER PLAN" eyebrow, `<h1>` plan name (30px Grenze Gotisch 600), sub copy:
- cyclic: `Vier Tage, die sich drehen: Tag 1 → 2 → 3 → 4 → 1. Der Kalender spielt keine Rolle.`
- weekly: `Feste Wochentage. Was nicht belegt ist, ist frei – ein Ruhetag ist etwas anderes als nichts.`

**2. Schedule switch** — segmented control: `#161D21`, 1px `#2C383E`, radius 11,
padding 4; two buttons `flex:1; height:38px; radius:8; font:500 12px IBM Plex Sans`.
Active `background:#2C383E; color:#E8EDEF`, inactive transparent `#6B7B84`.
Labels: **Zyklus** / **Wochentage**. Maps to `convertSchedule(plan, kind)` — day
content is preserved across the switch.

**3a. Cyclic → rotation card** (`#161D21`, radius 14, padding 15, gap 13)
Eyebrow "ROTATION" left, `kalenderunabhängig` right. Then up to 6 equal columns:
46px-high chip (radius 9, 15px Grenze 600) showing the day number, or `ᛁ` for a rest
day; caption below. Cursor day: bg `#1F282D`, border `#D4A537`, text `#D4A537`, caption
`Zeiger`. Others: bg `#0F1416`, border `#2C383E`, text `#AFBCC2`, caption `→` `#6B7B84`.
Footer copy: `Der Zeiger rückt erst vor, wenn ein Tag abgeschlossen ist – nach einer Pause geht es dort weiter, wo du aufgehört hast.`

**3b. Weekly → weekday grid** (same card) — `grid-template-columns:repeat(7,1fr); gap:5px`.
Per column: weekday abbreviation (10px mono `#6B7B84`) over a **read-only** 54px tile
(radius 8, 13px Grenze 600):
- training day → `T<n>`, bg `#1F282D`, border `#2C383E`, text `#E8EDEF`
- rest day → `Ruhe`, bg `#12202A`, border `#5B8CA8`, text `#5B8CA8`
- unassigned → `frei`, bg `#0F1416`, border `#2C383E`, text `#6B7B84`

The mapping is **derived from list order starting Monday** (day *i* → weekday *i*,
days beyond 7 unassigned) — the `convertSchedule` behaviour described in the model
README. The tiles are not interactive; reordering the list is how you change the week.
Footer copy: `Die Belegung folgt der Reihenfolge der Tage-Liste, beginnend am Montag. Verschiebe die Tage unten, um die Woche umzustellen.`

**4. Section rule** — "TAGE" · hairline · `perfekte Woche: 830 XP` (live `perfectXp`).

**5. Day list** — one card per day (`#161D21`, radius 14, border `#2C383E`, `#6B7B84`
when open, `overflow:hidden`).

Header row (`display:flex; align-items:stretch; transition:background .18s;`
hover `#1F282D` — **the hover must cover the reorder column too**):
- Reorder column, `padding:10px 0 10px 10px`, gap 4: two 28 × 25px buttons (radius 6,
  bg `#0F1416`, border `#2C383E`) with `▴` / `▾`. Enabled `#AFBCC2`, disabled at the
  ends `#2C383E`. Hover `border-color:#6B7B84`.
- Title button (`flex:1`, padding 14/15, transparent): name 17px Grenze 600 `#E8EDEF`
  (`Tag 2 · Druck`, or `Ruhetag`) + badge + meta (11px `#6B7B84`,
  `2 Übungen · 6 Sätze` or `kein Block · rotiert mit`); right side XP
  (12px/500 mono, `#D4A537`, rest days `#5B8CA8`) and caret `▾`/`▴` (12px `#6B7B84`).
- Badge (9px mono, `.1em`, uppercase, radius 4, `padding:3px 6px`):
  cyclic → `jetzt` on the cursor day, bg `#D4A537` text `#0F1416`;
  weekly → weekday abbreviation, bg `#2C383E` text `#AFBCC2`.

Expanded body (`border-top:1px solid #2C383E; padding:13px 15px 15px; gap:9px`) —
**read-only**:
- one row per block: name 13px/500 IBM Plex Sans `#E8EDEF` + target 11px mono `#6B7B84`
  on the left, `3 Sätze` 12px/500 mono `#AFBCC2` on the right
- rest day → info strip: `#0F1416`, 1px `#2C383E`, radius 9, rune `ᛁ` `#5B8CA8` +
  `Geplanter Ruhetag. Zählt in der Rotation mit und bringt 20 XP – belohnt wird der Plan, nicht die Aktivität.`
- footer row above a `#2C383E` hairline: hint
  `Übungen und Sätze werden beim Anlegen eines Tages festgelegt.` (10px `#6B7B84`) and a
  **Tag löschen** button (34px, radius 8, bg `#0F1416`, border `#2C383E`, text `#A63A2C`,
  hover border+text `#C8452B`). With only one day left it reads `letzter Tag`, text
  `#6B7B84`, and does nothing.

**6. Tag hinzufügen** — 48px, radius 11, bg `#0F1416`, **1px dashed `#6B7B84`**, text
`#AFBCC2`, `+` glyph + label. Hover border and text `#D4A537`. Hidden while the draft
panel is open.

**7. Draft panel** (replaces the add button) — `#161D21`, **1px `#D4A537`**, radius 14,
padding 15, gap 13.
- Header `Neuer Tag` (17px Grenze 600) + live XP preview (12px/500 mono `#D4A537`)
- Name input: 44px, radius 9, bg `#0F1416`, 1px `#2C383E`, text `#E8EDEF`,
  `padding:0 13px`, 14px/500 IBM Plex Sans, `outline:none`, focus border `#D4A537`,
  placeholder `Bezeichnung, z. B. Zug & Rumpf`
- Type toggle: two `flex:1` 38px buttons — **Trainingstag** (active bg `#1F282D`,
  border `#D4A537`, text `#E8EDEF`) / **Ruhetag** (active bg `#12202A`, border+text
  `#5B8CA8`). Inactive: bg `#0F1416`, border `#2C383E`, text `#6B7B84`.
- Chosen blocks (training day only): row `#0F1416`, 1px `#2C383E`, radius 9,
  `padding:10px 11px` — name + target on the left; `−` / count / `+` / `×` on the right
  (30 × 30px, radius 7, bg `#161D21`, border `#2C383E`; minus/plus `#AFBCC2`,
  remove `#A63A2C`, hover border `#A63A2C`). Sets clamp to **1…6**.
- "ÜBUNGSKATALOG" eyebrow, then one chip per catalogue exercise (`padding:8px 11px`,
  radius 8, bg `#0F1416`, 12px IBM Plex Sans). Unused: border `#2C383E`, text `#AFBCC2`.
  Already added: border+text `#4FA86A`, tap is a no-op.
- Footer above a hairline: **Abbrechen** (`flex:1`, 46px, radius 10, bg `#0F1416`,
  border `#2C383E`, text `#AFBCC2`) and **Tag anlegen** (`flex:1`, 46px, 13px Grenze 600,
  uppercase, `letter-spacing:.06em`). Valid → bg+border `#D4A537`, text `#0F1416`;
  invalid → bg `#161D21`, border `#2C383E`, text `#6B7B84`, click ignored.
  Valid = non-empty name **and** (rest day **or** ≥ 1 block).
- On save the day is appended to the list, the panel closes and the new day opens.

**8. Validation strip** — `#161D21`, 1px `#2C383E`, radius 12, `padding:13px 14px`,
rune + title + text. Backed by `validatePlan()`.
- ok: rune `ᛗ`, `#4FA86A`, `Plan gültig` /
  `Mindestens ein Trainingstag vorhanden. Die Rangschwellen wurden aus der aktuellen Liste neu berechnet.`
- error: rune `ᚦ`, `#C8452B`, `Plan ohne Training` /
  `Nur Ruhetage in der Liste – so lässt sich kein Referenzwert berechnen.`

### Day numbering rule

Day numbers are **positional, never stored**: walk the list, increment a counter for
each non-rest day. Reordering renumbers the list, the rotation chips and the weekday
tiles at once. What the user types when creating a day is the **title** (`Tag 5 · Rücken`),
not the number. Historical sessions keep their `dayName` snapshot and are unaffected.

---

## Screen 3 — Chronik

**Purpose:** what was actually done, per day.

**1. Header** — "CHRONIK" eyebrow; `<h1>` `Juli 2026` (30px Grenze Gotisch 600) with two
34px prev/next buttons (radius 8, `#161D21`, 1px `#2C383E`, `#AFBCC2`, hover border
`#6B7B84`). Next is clamped at the current month.

**2. Calendar card** (`#161D21`, 1px `#2C383E`, radius 14, `padding:14px 13px 15px`, gap 9)
- Weekday head row `Mo…So`, 9px mono `.1em` `#6B7B84`, `grid-template-columns:repeat(7,1fr); gap:4px`
- Day cells: same grid, `aspect-ratio:1`, radius 8, 12px/500 mono, centred number over a
  5px status dot. Leading blanks are transparent, non-interactive.
  - default bg `#0F1416`, border `#2C383E`, text `#E8EDEF`; future days text `#6B7B84`
  - selected: bg `#1F282D`, border `#D4A537`
  - dot: done `#4FA86A` · partial `#D4A537` · missed `#A63A2C` · open/future `#2C383E`
- Legend row above a hairline: 6px dots + 10px labels `#6B7B84` —
  `voll` / `teilweise` / `verpasst` / `offen`

**3. Day detail card** — title `12. Juli · Tag 3` (17px Grenze 600) + status
(11px/500 mono; `vollständig` `#4FA86A`, `teilweise` `#D4A537`, `verpasst` `#A63A2C`,
`kein Eintrag` `#6B7B84`). One row per block: name (13px `#AFBCC2`), `2/3` (11px mono
`#6B7B84`) and 9 × 9px pips (radius 2; done bg+border `#4FA86A`, open border `#2C383E`).
Footer above a hairline: `7 von 9 Sätzen abgehakt` (11px `#6B7B84`) and `+112 XP`
(15px/500 mono `#D4A537`).

**4. Month stats** — 3 equal cards (`#161D21`, 1px `#2C383E`, radius 12,
`padding:12px 11px`): value 20px/500 mono over 10px label `#6B7B84`.
`26/31 Tage trainiert` (`#E8EDEF`) · `3.190 XP im Monat` (`#D4A537`) ·
`87% der perfekten Periode` (`#4FA86A`).

**5. "VERLAUF" rule**, then up to 12 session rows (newest first): button `#161D21`,
radius 12, `padding:12px 14px`, border `#2C383E` (`#6B7B84` when it is the selected
day), hover bg `#1F282D`. Left: 3 × 32px status bar (done `#4FA86A`, partial `#D4A537`,
missed `#A63A2C`) + title `Tag 3 · Beine` (13px/500) + sub
`Di, 14. Juli · 6/6 Sätze` (11px mono `#6B7B84`). Right: `+110` (13px/500 mono
`#D4A537`; missed shows `—` in `#6B7B84`). Tapping selects that day in the calendar.

---

## Screen 4 — Ränge

**Purpose:** the three parallel ladders, plus records and closed periods.

**1. Header** — eyebrow `DREI LEITERN, EINE QUELLE`, `<h1>` `Ränge`, sub
`Jeder abgehakte Satz zählt einmal und füllt Woche, Monat und Jahr gleichzeitig.`

**2. Three ladder cards** (week, month, year — in that order).
`#161D21`, 1px `#2C383E`, radius 14, padding 15, gap 13.

- **Ring**, 86 × 86px, `position:relative`:
  - `<svg width=86 height=86 viewBox="0 0 86 86">` with two `<circle cx=43 cy=43 r=37
    fill=none stroke-width=5>`: track `#2C383E`, progress in the **tier colour**,
    `transform="rotate(-90 43 43)"`, `stroke-linecap: butt`,
    `stroke-dasharray = "<C·pct/100> <C>"`, `C = 2π·37 ≈ 232.5`.
  - Percentage as an **HTML `<span>` absolutely centred over the SVG**
    (16px/500 mono `#E8EDEF`). Do **not** put it in an SVG `<text>` — see Pitfalls.
- Right column (gap 5px): scope label (9px mono `.16em` uppercase `#6B7B84`) ·
  9px tier dot in the tier colour with a 1px `#0F1416` ring + tier name
  (22px/1.05 **Grenze Gotisch 600** `#E8EDEF`) · `123 XP bis Jarl` (11px `#AFBCC2`) ·
  `468 / 830 XP · Reset montags (ISO)` (10px mono `#6B7B84`).
- **Tier rail** above a hairline: equal-width columns, each a 4px bar (radius 2) over an
  8px mono abbreviation. Reached tiers use their own colour, unreached `#2C383E`;
  the current label is `#E8EDEF`, the rest `#6B7B84`. This is what communicates the
  order of the intermediate goals — keep it.

Copy per scope: `Woche` / `Monat` / `Jahr`; systems `Ständeleiter der Rígsþula`,
`Die Neun Welten`, `Zwölf Asen nach Rang`; resets `Reset montags (ISO)`, `Reset am 1.`,
`Reset am 1. Januar`. At the top tier the remaining line reads `Höchster Rang erreicht`.

**3. "BESTMARKEN" rule** (right caption `überlebt jeden Reset`) → 3 cards
(`#161D21`, 1px `#2C383E`, radius 12, `padding:13px 11px`, gap 7, left-aligned):
17px rune in the tier colour · tier name (14px Grenze 600 `#E8EDEF`) · label
(9px mono `.08em` uppercase `#6B7B84`) — `Beste Woche` / `Bester Monat` / `Bestes Jahr`.
Backed by `RankState.records`, which survives period resets.

**4. "ABGESCHLOSSENE PERIODEN" rule** → rows (`#161D21`, 1px `#2C383E`, radius 11,
`padding:11px 14px`): 8px dot in the tier colour · tier name (13px/500) over period
(10px mono `#6B7B84`) · XP right (11px mono `#AFBCC2`). From `RankState.history`.

---

## Interactions & Behavior

| Trigger | Effect |
|---|---|
| Tab tap | switch screen, `vhrise` entry animation, scroll resets |
| Set pill *k* | `done = done === k ? k−1 : k`; XP re-booked to all three ladders |
| All planned sets done | `dayCompleted` (+50 XP) booked implicitly; cursor advances; hint swaps |
| Unchecking after completion | day bonus revoked, cursor advance undone |
| Extra-set button | append one overflow set; button disappears at the ceiling |
| Zyklus / Wochentage | `convertSchedule()`; days preserved; thresholds recomputed |
| `▴` / `▾` | swap with neighbour; renumbers days and (weekly) reassigns weekdays |
| Day header tap | expand / collapse; only one open at a time |
| Tag löschen | remove day; blocked when one day remains |
| Tag hinzufügen | open draft panel, close any open day |
| Catalogue chip | add block with the exercise's default target and 3 sets |
| `−` / `+` / `×` in draft | sets clamp 1…6 / remove block |
| Tag anlegen | append day, close panel, open the new day |
| Calendar cell / session row | select that day for the detail card |
| `‹` / `›` | month step; `›` clamped at the current month |

**Transitions:** `.18s` for colour/background/border on interactive elements,
`.35s ease` for progress-bar widths, `.24s` for the screen entry animation.
No gradients, no glows anywhere — this is a hard rule of the palette.

**Hover:** desktop nicety only; the design is touch-first. All hit targets are ≥ 44px
(set pills 52px, list buttons ≥ 44px) except the secondary `−/+/×` steppers at 30px,
which sit inside the draft panel with 6px gaps.

**Empty / error states:** plan with only rest days → red validation strip; day with no
session → `kein Eintrag`, `Für diesen Tag liegt keine Session vor`, `—` XP; fresh user
→ all ladders at the lowest tier, records `—` in `#2C383E`, empty chronicle.

---

## State Management

Two Pinia stores, mirroring the model's split.

**`useTrainingStore` (`TrainingState`)** — `exercises`, `plans`, `cursors`, `sessions`,
`activePlanId`, `schemaVersion`; `persist: true`. Note the model README's warning:
seed with `structuredClone(initialState)`, because `defaultPlan` and `weeklyPlan` share
day objects.

**`useRankStore` (`RankState`)** — `week` / `month` / `year` `ScopeProgress`, `records`,
`history`. Call `rollOver()` on app start and on day change (idempotent);
`applySession()` after a workout; always pass `cursors[plan.id]` as the trailing
argument so `perfectXp` is phase-exact for cyclic plans.

**UI-only state** (component-local, not persisted):
`activeTab`, `openDayId`, `monthOffset`, `selectedDate`, and the draft object
`{ name, restDay, blocks[] }`.

Derived, never stored: day numbers (positional), weekday assignment in weekly mode
(list order from Monday), tier thresholds (`resolveTiers(scope, perfectXp(...))`),
`ScopeProgress.max` (fixed at period start).

---

## Design Tokens

### Neutrals & semantics

```css
--vh-900: #0F1416;  /* app background (dark first) */
--vh-800: #161D21;  /* card */
--vh-700: #1F282D;  /* raised surface, hover */
--vh-600: #2C383E;  /* border — never text */
--vh-400: #6B7B84;  /* text secondary (dimmest legal text colour) */
--vh-200: #AFBCC2;  /* text tertiary */
--vh-050: #E8EDEF;  /* text primary (bone, not white) */

--vh-accent:   #D4A537;  /* XP, progress, primary action */
--vh-success:  #4FA86A;  /* set checked */
--vh-rest:     #5B8CA8;  /* rest day */
--vh-overflow: #B5763A;  /* extra set */
```

Two dark tints used only as "done" pill fills: `#14231A` (success) and `#2A1D12`
(overflow); `#12202A` for rest-day tiles.

### Tier colours (`RankTier.key` → hex)

```ts
export const TIER_COLORS: Record<Id, string> = {
  drengr: '#B9AC94', karl: '#C08A2E', hersir: '#A63A2C',
  jarl: '#2F5D8C', konungr: '#E0B23C',

  niflheim: '#86A0AE', helheim: '#3F4A47', muspelheim: '#C8452B',
  jotunheim: '#7B6E5D', svartalfaheim: '#4B3A63', midgard: '#4E7A4A',
  alfheim: '#E6D9A8', vanaheim: '#2E8B84', asgard: '#E8B93C',

  bragi: '#5E6B7A', forseti: '#5A7480', ullr: '#567D80', vidar: '#567F72',
  vali: '#628060', njord: '#7C8557', freyr: '#948652', heimdallr: '#AC8850',
  baldr: '#C08E4E', tyr: '#CE9645', thorr: '#DFA93A', odinn: '#F2C64B',
};
```

**Rules that must hold:**
- Tier colour is an **accent only** — icon, ring, dot, 3–4px rail, hairline. Never a
  card background; with 9 and 12 colours the app would turn into a paint box.
- **Never put text on a tier colour.** Text is always `--vh-050` on a dark surface with
  the tier colour beside it.
- `#2C383E` is a **border token**. It may tint an unreached rail segment or a disabled
  glyph, but it must never carry information the user has to read.
- `helheim` is 3.1:1 against `--vh-900` — if it ever gets an icon, add an outline or a
  lighter ring. All other tiers are ≥ 4.5:1.
- No gradients, no glow. The gold reads metallic through flat fills plus fine borders.
- Light mode (secondary): darken `alfheim` and `konungr` by ~15 %.

### Typography

| Role | Family | Sizes used |
|---|---|---|
| Display / titles / tier names | **Grenze Gotisch** 600 | 32, 30, 26, 22 |
| Headings, exercise & day names | **Grenze** 600 | 17, 15, 14, 13 |
| Body & labels | **IBM Plex Sans** 400/500/600 | 13, 12, 11, 10 |
| Numbers, eyebrows, meta | **IBM Plex Mono** 400/500/600 | 30, 20, 15, 13, 12, 11, 10, 9 |
| Runes | **Noto Sans Runic** 400 | 30, 19, 17, 15, 14 |

Google Fonts single request:

```
https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@400;500;600;700&family=Grenze:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Runic&display=swap
```

Eyebrow convention: mono, 9–10px, 500, `letter-spacing:.16em`–`.18em`, uppercase,
`#6B7B84`, followed by a 1px `#2C383E` hairline when it heads a section.

### Spacing, radii, misc

- Screen padding `8px 18px 28px`; section gap **16px**; in-card gap **12–13px**.
- Card padding **15px** (14–16 where noted).
- Radii: cards **14**, inner panels/tiles **12**, chips/segments **8–11**, pips **2**,
  phone shell **38**.
- Borders always **1px**; dashed only for "add" affordances (`#6B7B84`) and the
  extra-set button (`#B5763A`).
- Body: `text-wrap: pretty`, `-webkit-font-smoothing: antialiased`.
- Scrollbars hidden (`::-webkit-scrollbar { width:0; height:0 }`).

---

## XP mechanics reproduced in the design

Straight from `ranks.ts` / the model README — reuse the real functions, this is only
here so the numbers on screen can be checked.

```
DEFAULT_XP     perSet 10 · dayCompleted 50 · restDay 20
CURVE_MODERATE [0.15, 0.40, 1]        cumulative, interpolated over normalised position
OVERFLOW_CURVE [0.25, 0.10]           share of the block base, hard ceiling
```

- 3-set block (base 30): **5 / 12 / 30**, then **38 / 41** with extra sets.
- 5-set block (base 50): 5 / 10 / 18 / 32 / 50.
- Seed cyclic plan: Tag 1 (9 sets) **140 XP**, Tage 2–4 (6 sets) **110 XP**, Ruhetag **20 XP**.
- Perfect week: cyclic from `day-1` **830** (800 from `day-2` — hence the cursor
  argument), weekly (4 workouts + rest day) **490**.
- Thresholds are `share × perfectXp`, never absolute. Week/month top out at
  `share: 1`, the year ladder at **`share: 0.9`** (Odin).

Ladder shares used in the prototype (week and year are the model's; the nine monthly
shares are a design proposal — **confirm against `ranks.ts` before shipping**):

```
week   0 · .20 · .45 · .72 · 1
month  0 · .12 · .24 · .36 · .48 · .60 · .72 · .85 · 1
year   0 · .08 · .16 · .24 · .32 · .40 · .48 · .56 · .64 · .72 · .81 · .90
```

Repetitions never enter the XP calculation, and `perSide` does not double anything —
it only affects display and the duration estimate.

---

## Assets

None. No images, no icon set, no SVG illustrations. Every glyph is text:

- Runes from **Noto Sans Runic** (Elder Futhark, Unicode U+16A0–U+16F8):
  `ᛞ ᛃ ᚱ ᛊ ᚹ ᛁ ᚦ ᛗ ᚲ ᚺ ᚾ ᚨ ᛒ ᚠ ᚢ ᛏ ᛟ`
- UI marks are plain characters: `✓ + − × ▴ ▾ ‹ › →`
- The only vector is the progress ring, drawn with two `<circle>` elements.

If a rank badge/icon set is added later, key the files by `RankTier.key`
(`konungr.svg`, `asgard.svg`, `odinn.svg`) — the model README reserves that key for
exactly this purpose, and display names may change while keys may not.

---

## Files

| File | What it is |
|---|---|
| `Til Valhall.dc.html` | The full interactive prototype — all four screens. Open in a browser. |
| `support.js` | Runtime required by the prototype. Prototype infrastructure only — nothing to port. |

Inside the HTML: the markup between `<x-dc>` and `</x-dc>` is the template, the
`class Component` block below it holds the state and the display logic (including the
throwaway XP re-implementation).

Reference implementation to build against:
<https://github.com/sboe0705/til-valhall> — `src/model/{training,plan-cycle,schedule,ranks}.ts`,
`src/data/default-plan.ts`.

---

## Pitfalls found while building the prototype

1. **Don't render the ring percentage as SVG `<text>`** if your framework injects a
   wrapper element into it — the wrapper has no rendering box in the SVG namespace and
   the number silently disappears. Overlay an absolutely positioned HTML `<span>`.
2. **`#2C383E` is not a text colour.** It is ~1.2:1 on `#161D21`. Anything the user has
   to read uses `#6B7B84` or lighter.
3. Set pills are not checkboxes — tapping set 2 when 3 are done must set the count to 2,
   not toggle a single box.
4. Day numbers are positional. Don't persist them, or a reorder leaves two "Tag 1"s.

---

## Open questions for the team

1. **Monthly ladder shares** — the nine-world thresholds above are a design proposal;
   align them with `ranks.ts` (and consider Asgard at `0.95`, which the model README
   floats as an option if a holiday makes the month too strict).
2. **Light mode** — not designed. The palette prescribes darkening `alfheim` and
   `konungr` by ~15 %; the rest needs a pass.
3. **Overflow curve** — the design shows `[0.25, 0.1]`, which the model README flags as
   *too much* for a cyclic plan without rest days (Σ must stay below ≈ 0.266). If the
   default plan ships cyclic and gapless, the copy in the extra-set note ("Aufschlag
   25 %") has to follow whatever curve you settle on.
4. **Weekday assignment in weekly mode** is derived from list order. If arbitrary
   per-weekday assignment is wanted later, it needs a UI that isn't the list.
5. **Desktop / tablet** — the design is 390px, mobile only.
