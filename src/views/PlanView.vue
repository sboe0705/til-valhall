<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Id, PlanSchedule } from '@/model/training';
import { REST_XP } from '@/model/ranks';
import { isWeekly, WEEKDAYS } from '@/model/schedule';
import type { DayDraft } from '@/model/plan-edit';
import { dayCard } from '@/app/day-card';
import * as de from '@/app/format-de';
import DayDraftPanel from '@/components/DayDraftPanel.vue';
import DayListItem from '@/components/DayListItem.vue';
import RotationCard from '@/components/RotationCard.vue';
import ScheduleSwitch from '@/components/ScheduleSwitch.vue';
import SectionRule from '@/components/SectionRule.vue';
import ValidationStrip from '@/components/ValidationStrip.vue';
import WeekdayGrid from '@/components/WeekdayGrid.vue';
import { useTrainingStore } from '@/stores/training';

const training = useTrainingStore();

/** UI-only state – never persisted. */
const openDayId = ref<Id | null>(null);
const drafting = ref(false);

const plan = computed(() => training.activePlan);
const kind = computed<PlanSchedule['kind']>(() => plan.value?.schedule.kind ?? 'cyclic');
const cyclic = computed(() => kind.value === 'cyclic');

const subline = computed(() =>
  cyclic.value
    ? 'Vier Tage, die sich drehen: Tag 1 → 2 → 3 → 4 → 1. Der Kalender spielt keine Rolle.'
    : 'Feste Wochentage. Was nicht belegt ist, ist frei – ein Ruhetag ist etwas anderes als nichts.',
);

/** Which weekday a day sits on – for the badge in weekly mode. */
const weekdayOf = computed(() => {
  const map = new Map<Id, string>();
  const schedule = plan.value?.schedule;
  if (!schedule || !isWeekly(schedule)) return map;
  for (const wd of WEEKDAYS) {
    const id = schedule.assignments[wd];
    if (id && !map.has(id)) map.set(id, de.weekdayShort(wd));
  }
  return map;
});

/** The read-only box plus the editing chrome the Plan screen adds around it. */
const items = computed(() =>
  training.days.map((day, index) => {
    const weekday = weekdayOf.value.get(day.id);

    return {
      day,
      ...dayCard(day, training.numbers.get(day.id) ?? null, training.exercises),
      badge: cyclic.value
        ? day.id === training.cursorDayId
          ? { label: 'jetzt', variant: 'now' as const }
          : null
        : weekday
          ? { label: weekday, variant: 'weekday' as const }
          : null,
      canUp: index > 0,
      canDown: index < training.days.length - 1,
    };
  }),
);

const canDelete = computed(() => training.days.length > 1);

function toggle(dayId: Id): void {
  openDayId.value = openDayId.value === dayId ? null : dayId;
}

function startDraft(): void {
  drafting.value = true;
  openDayId.value = null;
}

function saveDraft(draft: DayDraft): void {
  const id = training.createDay(draft);
  drafting.value = false;
  openDayId.value = id;
}

function remove(dayId: Id): void {
  training.deleteDay(dayId);
  if (openDayId.value === dayId) openDayId.value = null;
}
</script>

<template>
  <div class="vh-screen">
    <header class="head">
      <span class="vh-eyebrow vh-eyebrow--quadrant">Der Plan</span>
      <h1 class="vh-h1">{{ plan?.name ?? 'Kein Plan' }}</h1>
      <span class="vh-sub">{{ subline }}</span>
    </header>

    <ScheduleSwitch :kind="kind" @select="training.setScheduleKind($event)" />

    <RotationCard
      v-if="cyclic"
      :days="training.days"
      :numbers="training.numbers"
      :cursor-day-id="training.cursorDayId"
    />
    <WeekdayGrid v-else-if="plan" :plan="plan" :numbers="training.numbers" />

    <SectionRule
      label="Tage"
      :caption="`perfekte Woche: ${de.thousands(training.perfectWeek)} / ${de.thousands(training.perfectWeekMax)} XP`"
    />

    <DayListItem
      v-for="(item, i) in items"
      :key="item.day.id"
      :style="{ '--vh-card': `var(--vh-quarter-${i % 2 ? 'b' : 'a'})` }"
      :title="item.title"
      :meta="item.meta"
      :xp-text="item.xpText"
      :rest="item.rest"
      :badge="item.badge"
      :open="openDayId === item.day.id"
      :can-up="item.canUp"
      :can-down="item.canDown"
      :can-delete="canDelete"
      :rows="item.rows"
      :rest-xp="REST_XP"
      @toggle="toggle(item.day.id)"
      @up="training.shiftDay(item.day.id, -1)"
      @down="training.shiftDay(item.day.id, 1)"
      @remove="remove(item.day.id)"
    />

    <DayDraftPanel
      v-if="drafting"
      :exercises="training.exercises"
      :plans="training.plans"
      @save="saveDraft"
      @cancel="drafting = false"
    />
    <button v-else type="button" class="add" @click="startDraft">
      <span class="add__glyph">+</span>
      <span>Tag hinzufügen</span>
    </button>

    <ValidationStrip :errors="training.planErrors" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.add {
  height: 48px;
  border-radius: var(--vh-r-chip);
  background: var(--vh-900);
  border: 1px dashed var(--vh-400);
  color: var(--vh-200);
  font: 500 13px/1 var(--vh-sans);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    border-color var(--vh-t-color),
    color var(--vh-t-color);
}

.add:hover {
  border-color: var(--vh-accent);
  color: var(--vh-accent);
}

.add__glyph {
  font: 400 15px/1 var(--vh-mono);
}
</style>
