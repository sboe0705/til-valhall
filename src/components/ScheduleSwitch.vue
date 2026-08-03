<script setup lang="ts">
import type { PlanSchedule } from '@/model/training';

defineProps<{ kind: PlanSchedule['kind'] }>();
defineEmits<{ select: [kind: PlanSchedule['kind']] }>();

const options = [
  { kind: 'cyclic' as const, label: 'Zyklus' },
  { kind: 'weekly' as const, label: 'Wochentage' },
];
</script>

<template>
  <div class="switch">
    <button
      v-for="option in options"
      :key="option.kind"
      type="button"
      class="switch__btn"
      :class="{ 'switch__btn--active': kind === option.kind }"
      :aria-pressed="kind === option.kind"
      @click="$emit('select', option.kind)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.switch {
  display: flex;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-chip);
  padding: 4px;
}

.switch__btn {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: var(--vh-r-tile);
  font: 500 12px/1 var(--vh-sans);
  letter-spacing: 0.04em;
  background: transparent;
  color: var(--vh-400);
  transition:
    background var(--vh-t-color),
    color var(--vh-t-color);
}

.switch__btn--active {
  background: var(--vh-600);
  color: var(--vh-050);
}
</style>
