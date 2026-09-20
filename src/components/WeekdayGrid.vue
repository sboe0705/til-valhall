<script setup lang="ts">
import { computed } from 'vue';

import type { Id, TrainingPlan } from '@/model/training';
import { isWeekly } from '@/model/schedule';
import { WEEKDAYS } from '@/model/schedule';
import { WEEKDAYS_SHORT_DE } from '@/app/format-de';

const props = defineProps<{ plan: TrainingPlan; numbers: Map<Id, number | null> }>();

/**
 * Read-only: the week is derived from the day list, so reordering the list is
 * how it changes. Rendered from `schedule.assignments` rather than from list
 * position – the seed's weekly plan puts its rest day on Wednesday while the
 * day sits fifth in the list, and position would draw that wrong.
 */
const cells = computed(() =>
  WEEKDAYS.map((wd) => {
    const assignments = isWeekly(props.plan.schedule)
      ? props.plan.schedule.assignments
      : null;
    const dayId = assignments?.[wd] ?? null;
    const day = dayId ? props.plan.days.find((d) => d.id === dayId) : undefined;

    if (!day) return { wd, label: 'frei', variant: 'free' as const };
    if (day.restDay) return { wd, label: 'Ruhe', variant: 'rest' as const };
    return {
      wd,
      label: `T${props.numbers.get(day.id) ?? '?'}`,
      variant: 'work' as const,
    };
  }),
);
</script>

<template>
  <section class="week vh-card">
    <span class="vh-eyebrow vh-eyebrow--sm">Wochentage</span>

    <div class="week__grid">
      <div v-for="cell in cells" :key="cell.wd" class="week__col">
        <span class="week__wd">{{ WEEKDAYS_SHORT_DE[cell.wd - 1] }}</span>
        <div class="week__tile" :class="`week__tile--${cell.variant}`">
          {{ cell.label }}
        </div>
      </div>
    </div>

    <p class="week__copy">
      Die Belegung folgt der Reihenfolge der Tage-Liste, beginnend am Montag. Verschiebe
      die Tage unten, um die Woche umzustellen.
    </p>
  </section>
</template>

<style scoped>
.week {
  --vh-card: var(--vh-tint-gold);
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.week__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.week__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.week__wd {
  font: 500 10px/1 var(--vh-mono);
  color: var(--vh-400);
}

.week__tile {
  width: 100%;
  height: 54px;
  border-radius: var(--vh-r-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 13px/1 var(--vh-heading);
}

.week__tile--work {
  background: var(--vh-700);
  border: 1px solid var(--vh-600);
  color: var(--vh-050);
}

.week__tile--rest {
  background: var(--vh-fill-rest);
  border: 1px solid var(--vh-rest);
  color: var(--vh-rest);
}

.week__tile--free {
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-400);
}

.week__copy {
  margin: 0;
  font: 400 11px/1.45 var(--vh-sans);
  color: var(--vh-400);
}
</style>
