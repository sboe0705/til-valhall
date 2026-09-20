<script setup lang="ts">
import { computed, ref } from 'vue';

import type { WorkoutSession } from '@/model/training';
import type { DayEntry } from '@/app/history';
import { monthCursor, monthEntries, monthStats } from '@/app/history';
import { doneSetsOf, plannedSetsOf } from '@/app/session-xp';
import * as de from '@/app/format-de';
import DayDetailCard from '@/components/DayDetailCard.vue';
import MonthCalendar from '@/components/MonthCalendar.vue';
import SectionRule from '@/components/SectionRule.vue';
import SessionRow from '@/components/SessionRow.vue';
import { useNow } from '@/composables/useNow';
import { useTrainingStore } from '@/stores/training';

const training = useTrainingStore();
const { now } = useNow();

/** UI-only state. */
const monthOffset = ref(0);
const selected = ref<string | null>(null);

const month = computed(
  () => new Date(now.value.getFullYear(), now.value.getMonth() + monthOffset.value, 1),
);

/** `›` is clamped at the current month. */
const canGoForward = computed(() => monthCursor(month.value) < monthCursor(now.value));

const entries = computed<DayEntry[]>(() =>
  training.activePlan
    ? monthEntries(month.value, training.activePlan, training.state.sessions, now.value)
    : [],
);

const stats = computed(() => monthStats(entries.value));

/** Default selection: the most recent day that is not in the future. */
const selectedIso = computed(
  () =>
    selected.value ??
    [...entries.value].reverse().find((e) => e.status !== 'future')?.date ??
    entries.value[0]?.date ??
    null,
);

const selectedEntry = computed(
  () => entries.value.find((e) => e.date === selectedIso.value) ?? null,
);

/** `Tag 3` / `Ruhetag`, resolved against the current plan where possible. */
function shortLabel(session: WorkoutSession): string {
  const day = training.activePlan?.days.find((d) => d.id === session.dayId);
  if (!day) return session.dayName;
  if (day.restDay) return 'Ruhetag';
  const n = training.numbers.get(day.id);
  return n ? `Tag ${n}` : session.dayName;
}

function fullLabel(session: WorkoutSession): string {
  const day = training.activePlan?.days.find((d) => d.id === session.dayId);
  return day ? de.dayTitle(day, training.numbers.get(day.id) ?? null) : session.dayName;
}

const detail = computed(() => {
  const entry = selectedEntry.value;
  const date = entry ? new Date(`${entry.date}T00:00:00`) : now.value;
  const session = entry?.session ?? null;
  const status = entry?.status ?? 'open';

  const variant =
    status === 'done' || status === 'partial' || status === 'missed' ? status : 'none';

  // "kein Eintrag" only when there really is no session – a day that is under
  // way but still empty is open, not missing.
  const label =
    status === 'done'
      ? 'vollständig'
      : status === 'partial'
        ? 'teilweise'
        : status === 'missed'
          ? 'verpasst'
          : session
            ? 'offen'
            : 'kein Eintrag';

  return {
    title: session
      ? `${de.dayAndMonth(date)} · ${shortLabel(session)}`
      : de.dayAndMonth(date),
    status: label,
    statusVariant: variant as 'done' | 'partial' | 'missed' | 'none',
    rows: (session?.results ?? []).map((result) => ({
      name: training.exercises[result.exerciseId]?.name ?? result.exerciseId,
      done: Math.min(doneSetsOf(result), plannedSetsOf(result)),
      planned: plannedSetsOf(result),
    })),
    note: session
      ? `${entry?.doneSets ?? 0} von ${entry?.totalSets ?? 0} Sätzen abgehakt`
      : 'Für diesen Tag liegt keine Session vor',
    xpText: entry && entry.xp > 0 ? `+${entry.xp} XP` : '—',
  };
});

/** Up to twelve rows, newest first. */
const rows = computed(() =>
  entries.value
    .filter((e) => e.session !== null)
    .slice()
    .reverse()
    .slice(0, 12)
    .map((entry) => {
      const date = new Date(`${entry.date}T00:00:00`);
      const blank = entry.xp === 0;
      return {
        entry,
        title: entry.session ? fullLabel(entry.session) : '—',
        sub: `${de.dateShort(date)} · ${entry.doneSets}/${entry.totalSets} Sätze`,
        xpText: blank ? '—' : `+${entry.xp}`,
        missed: blank,
        accent:
          entry.status === 'done'
            ? 'var(--vh-success)'
            : entry.status === 'partial'
              ? 'var(--vh-accent)'
              : 'var(--vh-danger)',
      };
    }),
);
</script>

<template>
  <div class="vh-screen">
    <header class="head">
      <span class="vh-eyebrow vh-eyebrow--quadrant">Chronik</span>
      <div class="head__row">
        <h1 class="vh-h1">{{ de.monthLabel(month) }}</h1>
        <div class="head__nav">
          <button
            type="button"
            class="head__btn"
            aria-label="Vorheriger Monat"
            @click="
              monthOffset -= 1;
              selected = null;
            "
          >
            ‹
          </button>
          <button
            type="button"
            class="head__btn"
            :class="{ 'head__btn--off': !canGoForward }"
            :aria-disabled="!canGoForward"
            aria-label="Nächster Monat"
            @click="
              if (canGoForward) {
                monthOffset += 1;
                selected = null;
              }
            "
          >
            ›
          </button>
        </div>
      </div>
    </header>

    <MonthCalendar
      :month="month"
      :entries="entries"
      :selected="selectedIso"
      @select="selected = $event"
    />

    <DayDetailCard
      :title="detail.title"
      :status="detail.status"
      :status-variant="detail.statusVariant"
      :rows="detail.rows"
      :note="detail.note"
      :xp-text="detail.xpText"
    />

    <div class="stats">
      <div class="stats__card stats__card--days vh-card">
        <span class="stats__value">{{ stats.trainedDays }}/{{ stats.totalDays }}</span>
        <span class="stats__label">Tage trainiert</span>
      </div>
      <div class="stats__card stats__card--xp vh-card">
        <span class="stats__value stats__value--xp">{{ de.thousands(stats.xp) }}</span>
        <span class="stats__label">XP im Monat</span>
      </div>
      <div class="stats__card stats__card--share vh-card">
        <span class="stats__value stats__value--share">
          {{ Math.round(stats.share * 100) }}%
        </span>
        <span class="stats__label">der perfekten Periode</span>
      </div>
    </div>

    <SectionRule label="Verlauf" />

    <SessionRow
      v-for="row in rows"
      :key="row.entry.date"
      :title="row.title"
      :sub="row.sub"
      :xp-text="row.xpText"
      :missed="row.missed"
      :accent="row.accent"
      :selected="row.entry.date === selectedIso"
      @select="selected = row.entry.date"
    />

    <span v-if="rows.length === 0" class="empty">
      In diesem Monat liegt noch keine Session vor.
    </span>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head__nav {
  display: flex;
  gap: 7px;
}

.head__btn {
  width: 34px;
  height: 34px;
  border-radius: var(--vh-r-tile);
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  color: var(--vh-200);
  font: 500 13px/1 var(--vh-mono);
  padding: 0;
  transition: border-color var(--vh-t-color);
}

.head__btn:hover {
  border-color: var(--vh-400);
}

.head__btn--off {
  color: var(--vh-600);
  cursor: default;
}

.head__btn--off:hover {
  border-color: var(--vh-600);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 9px;
}

.stats__card {
  border-radius: var(--vh-r-panel);
  padding: 12px 11px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Quartered like the shield: the middle figure takes the other quarter. */
.stats__card--xp {
  --vh-card: var(--vh-quarter-b);
}

.stats__value {
  font: 600 20px/1 var(--vh-mono);
  color: var(--vh-050);
}

.stats__value--xp {
  color: var(--vh-accent);
}

.stats__value--share {
  color: var(--vh-success);
}

.stats__label {
  font: 400 10px/1.25 var(--vh-sans);
  color: var(--vh-400);
}

.empty {
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-400);
  text-align: center;
}
</style>
