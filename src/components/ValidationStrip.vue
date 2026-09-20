<script setup lang="ts">
import { computed } from 'vue';

/** Backed by `validatePlan()` – the model decides, this only phrases it. */
const props = defineProps<{ errors: string[] }>();

const ok = computed(() => props.errors.length === 0);
</script>

<template>
  <section class="valid vh-card" :class="{ 'valid--error': !ok }">
    <span class="vh-rune valid__rune">{{ ok ? 'ᛗ' : 'ᚦ' }}</span>
    <div class="valid__text">
      <span class="valid__title">{{ ok ? 'Plan gültig' : 'Plan ohne Training' }}</span>
      <span class="valid__body">
        {{
          ok
            ? 'Mindestens ein Trainingstag vorhanden. Die Rangschwellen wurden aus der aktuellen Liste neu berechnet.'
            : 'Nur Ruhetage in der Liste – so lässt sich kein Referenzwert berechnen.'
        }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.valid {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 14px;
  border-radius: var(--vh-r-panel);
  margin-top: 2px;
}

.valid__rune {
  font-size: 15px;
  line-height: 1.2;
  color: var(--vh-success);
  flex: none;
}

.valid__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.valid__title {
  font: 500 12px/1.2 var(--vh-sans);
  color: var(--vh-success);
}

.valid__body {
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-400);
}

.valid--error {
  --vh-card: var(--vh-quarter-b);
}

.valid--error .valid__rune,
.valid--error .valid__title {
  color: var(--vh-danger-strong);
}
</style>
