<script setup lang="ts">
import { computed } from 'vue';

import type { DayEntry, DayStatus } from '@/app/history';
import { leadingBlanks } from '@/app/history';
import { WEEKDAYS_SHORT_DE } from '@/app/format-de';

const props = defineProps<{
  month: Date;
  entries: DayEntry[];
  selected: string | null;
}>();

defineEmits<{ select: [iso: string] }>();

const blanks = computed(() => leadingBlanks(props.month));

const DOT: Record<DayStatus, string> = {
  done: 'var(--vh-success)',
  partial: 'var(--vh-accent)',
  missed: 'var(--vh-danger)',
  open: 'var(--vh-600)',
  future: 'var(--vh-600)',
};

const legend = [
  { label: 'voll', color: 'var(--vh-success)' },
  { label: 'teilweise', color: 'var(--vh-accent)' },
  { label: 'verpasst', color: 'var(--vh-danger)' },
  { label: 'offen', color: 'var(--vh-600)' },
];
</script>

<template>
  <section class="cal vh-card">
    <div class="cal__grid cal__grid--head">
      <span v-for="wd in WEEKDAYS_SHORT_DE" :key="wd" class="cal__wd">{{ wd }}</span>
    </div>

    <div class="cal__grid">
      <span v-for="n in blanks" :key="`blank-${n}`" class="cal__blank" />
      <button
        v-for="entry in entries"
        :key="entry.date"
        type="button"
        class="cal__cell"
        :class="{
          'cal__cell--selected': entry.date === selected,
          'cal__cell--future': entry.status === 'future',
        }"
        :aria-label="entry.date"
        @click="$emit('select', entry.date)"
      >
        <span>{{ entry.day }}</span>
        <span class="cal__dot" :style="{ background: DOT[entry.status] }" />
      </button>
    </div>

    <div class="cal__legend">
      <span v-for="item in legend" :key="item.label" class="cal__legend-item">
        <span class="cal__legend-dot" :style="{ background: item.color }" />{{
          item.label
        }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.cal {
  padding: 14px 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal__wd {
  text-align: center;
  font: 500 9px/1 var(--vh-mono);
  letter-spacing: 0.1em;
  color: var(--vh-400);
}

.cal__blank {
  aspect-ratio: 1;
}

.cal__cell {
  aspect-ratio: 1;
  border-radius: var(--vh-r-tile);
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font: 500 12px/1 var(--vh-mono);
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-050);
  transition: background 0.16s;
}

.cal__cell--future {
  color: var(--vh-400);
}

.cal__cell--selected {
  background: var(--vh-700);
  border-color: var(--vh-accent);
}

.cal__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.cal__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 5px;
  border-top: 1px solid var(--vh-600);
}

.cal__legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font: 400 10px/1 var(--vh-sans);
  color: var(--vh-400);
}

.cal__legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
