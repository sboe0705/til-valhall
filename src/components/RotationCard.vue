<script setup lang="ts">
import { computed } from 'vue';

import type { Id, TrainingDay } from '@/model/training';

const props = defineProps<{
  days: TrainingDay[];
  numbers: Map<Id, number | null>;
  cursorDayId?: Id;
}>();

/** Six chips is what the card fits – the rest of the cycle lives in the list. */
const chips = computed(() =>
  props.days.slice(0, 6).map((day) => ({
    id: day.id,
    short: day.restDay ? 'ᛁ' : String(props.numbers.get(day.id) ?? '·'),
    isRune: day.restDay === true,
    cursor: day.id === props.cursorDayId,
  })),
);
</script>

<template>
  <section class="rotation vh-card">
    <header class="rotation__head">
      <span class="vh-eyebrow vh-eyebrow--sm">Rotation</span>
      <span class="rotation__note">kalenderunabhängig</span>
    </header>

    <div class="rotation__chips">
      <div v-for="chip in chips" :key="chip.id" class="rotation__col">
        <div
          class="rotation__chip"
          :class="{ 'rotation__chip--cursor': chip.cursor, 'vh-rune': chip.isRune }"
        >
          {{ chip.short }}
        </div>
        <span class="rotation__mark" :class="{ 'rotation__mark--cursor': chip.cursor }">
          {{ chip.cursor ? 'Zeiger' : '→' }}
        </span>
      </div>
    </div>

    <p class="rotation__copy">
      Der Zeiger rückt erst vor, wenn ein Tag abgeschlossen ist – nach einer Pause geht es
      dort weiter, wo du aufgehört hast.
    </p>
  </section>
</template>

<style scoped>
.rotation {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.rotation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rotation__note {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-400);
}

.rotation__chips {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rotation__col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.rotation__chip {
  width: 100%;
  height: 46px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 15px/1 var(--vh-heading);
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-200);
}

.rotation__chip--cursor {
  background: var(--vh-700);
  border-color: var(--vh-accent);
  color: var(--vh-accent);
}

.rotation__mark {
  font: 400 9px/1 var(--vh-mono);
  color: var(--vh-400);
}

.rotation__mark--cursor {
  color: var(--vh-accent);
}

.rotation__copy {
  margin: 0;
  font: 400 11px/1.45 var(--vh-sans);
  color: var(--vh-400);
}
</style>
