<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Exercise, Id, TrainingPlan } from '@/model/training';
import { potentialXp } from '@/model/ranks';
import type { DayDraft } from '@/model/plan-edit';
import { MAX_SETS, MIN_SETS, defaultTargetFor } from '@/model/plan-edit';
import * as de from '@/app/format-de';

const props = defineProps<{
  exercises: Record<Id, Exercise>;
  plans: TrainingPlan[];
}>();

const emit = defineEmits<{ save: [draft: DayDraft]; cancel: [] }>();

const draft = ref<DayDraft>({ name: '', restDay: false, blocks: [] });

const catalog = computed(() =>
  Object.values(props.exercises)
    .filter((e) => !e.archived)
    .map((exercise) => ({
      exercise,
      used: draft.value.blocks.some((b) => b.exerciseId === exercise.id),
    })),
);

const rows = computed(() =>
  draft.value.blocks.map((block, index) => ({
    index,
    name: props.exercises[block.exerciseId]?.name ?? block.exerciseId,
    target: `${block.sets} × ${de.targetDe(block.target)}`,
    sets: block.sets,
  })),
);

const previewXp = computed(() =>
  potentialXp({
    id: 'draft',
    name: draft.value.name,
    order: 0,
    restDay: draft.value.restDay,
    blocks: draft.value.blocks.map((b, order) => ({
      id: `draft-${order}`,
      exerciseId: b.exerciseId,
      sets: b.sets,
      target: b.target,
      order,
    })),
  }),
);

/** Valid = a name **and** (rest day or at least one block). */
const valid = computed(
  () =>
    draft.value.name.trim().length > 0 &&
    (draft.value.restDay || draft.value.blocks.length > 0),
);

function addFromCatalog(exercise: Exercise): void {
  if (draft.value.blocks.some((b) => b.exerciseId === exercise.id)) return;
  draft.value.blocks.push({
    exerciseId: exercise.id,
    sets: 3,
    target: defaultTargetFor(props.plans, exercise.id),
  });
}

function step(index: number, delta: number): void {
  const block = draft.value.blocks[index];
  if (!block) return;
  block.sets = Math.min(MAX_SETS, Math.max(MIN_SETS, block.sets + delta));
}

function submit(): void {
  if (!valid.value) return;
  emit('save', {
    name: draft.value.name.trim(),
    restDay: draft.value.restDay,
    blocks: draft.value.restDay ? [] : draft.value.blocks,
  });
}
</script>

<template>
  <section class="draft">
    <header class="draft__head">
      <span class="draft__title">Neuer Tag</span>
      <span class="draft__xp">{{ previewXp }} XP</span>
    </header>

    <input
      v-model="draft.name"
      class="draft__input"
      type="text"
      placeholder="Bezeichnung, z. B. Zug &amp; Rumpf"
      aria-label="Bezeichnung des Tages"
    />

    <div class="draft__types">
      <button
        type="button"
        class="draft__type"
        :class="{ 'draft__type--work': !draft.restDay }"
        @click="draft.restDay = false"
      >
        Trainingstag
      </button>
      <button
        type="button"
        class="draft__type"
        :class="{ 'draft__type--rest': draft.restDay }"
        @click="draft.restDay = true"
      >
        Ruhetag
      </button>
    </div>

    <div v-if="!draft.restDay" class="draft__blocks">
      <div v-for="row in rows" :key="row.index" class="draft__row">
        <span class="draft__row-left">
          <span class="draft__row-name">{{ row.name }}</span>
          <span class="draft__row-target">{{ row.target }}</span>
        </span>
        <span class="draft__stepper">
          <button
            type="button"
            class="draft__step"
            aria-label="Weniger Sätze"
            @click="step(row.index, -1)"
          >
            −
          </button>
          <span class="draft__count">{{ row.sets }}</span>
          <button
            type="button"
            class="draft__step"
            aria-label="Mehr Sätze"
            @click="step(row.index, 1)"
          >
            +
          </button>
          <button
            type="button"
            class="draft__step draft__step--remove"
            aria-label="Block entfernen"
            @click="draft.blocks.splice(row.index, 1)"
          >
            ×
          </button>
        </span>
      </div>

      <span class="vh-eyebrow vh-eyebrow--sm draft__catalog-label">Übungskatalog</span>
      <div class="draft__catalog">
        <button
          v-for="item in catalog"
          :key="item.exercise.id"
          type="button"
          class="draft__chip"
          :class="{ 'draft__chip--used': item.used }"
          @click="addFromCatalog(item.exercise)"
        >
          {{ item.exercise.name }}
        </button>
      </div>
    </div>

    <div class="draft__foot">
      <button type="button" class="draft__cancel" @click="$emit('cancel')">
        Abbrechen
      </button>
      <button
        type="button"
        class="draft__save"
        :class="{ 'draft__save--valid': valid }"
        :aria-disabled="!valid"
        @click="submit"
      >
        Tag anlegen
      </button>
    </div>
  </section>
</template>

<style scoped>
.draft {
  background: var(--vh-800);
  border: 1px solid var(--vh-accent);
  border-radius: var(--vh-r-card);
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.draft__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.draft__title {
  font: 600 17px/1.1 var(--vh-heading);
  color: var(--vh-050);
}

.draft__xp {
  font: 500 12px/1 var(--vh-mono);
  color: var(--vh-accent);
}

.draft__input {
  height: 44px;
  border-radius: 9px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-050);
  padding: 0 13px;
  font: 500 14px/1 var(--vh-sans);
  outline: none;
  transition: border-color var(--vh-t-color);
}

.draft__input::placeholder {
  color: var(--vh-400);
}

.draft__input:focus {
  border-color: var(--vh-accent);
}

.draft__types {
  display: flex;
  gap: 8px;
}

.draft__type {
  flex: 1;
  height: 38px;
  border-radius: var(--vh-r-tile);
  font: 500 12px/1 var(--vh-sans);
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-400);
  transition:
    background var(--vh-t-color),
    border-color var(--vh-t-color),
    color var(--vh-t-color);
}

.draft__type--work {
  background: var(--vh-700);
  border-color: var(--vh-accent);
  color: var(--vh-050);
}

.draft__type--rest {
  background: var(--vh-fill-rest);
  border-color: var(--vh-rest);
  color: var(--vh-rest);
}

.draft__blocks {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.draft__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  padding: 10px 11px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  border-radius: 9px;
}

.draft__row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.draft__row-name {
  font: 500 13px/1.2 var(--vh-sans);
  color: var(--vh-050);
}

.draft__row-target {
  font: 400 11px/1.2 var(--vh-mono);
  color: var(--vh-400);
}

.draft__stepper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.draft__step {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  color: var(--vh-200);
  font: 500 15px/1 var(--vh-mono);
  padding: 0;
  transition: border-color var(--vh-t-color);
}

.draft__step:hover {
  border-color: var(--vh-400);
}

.draft__step--remove {
  color: var(--vh-danger);
  font-size: 13px;
}

.draft__step--remove:hover {
  border-color: var(--vh-danger);
}

.draft__count {
  font: 500 12px/1 var(--vh-mono);
  color: var(--vh-050);
  min-width: 20px;
  text-align: center;
}

.draft__catalog-label {
  padding-top: 2px;
}

.draft__catalog {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.draft__chip {
  padding: 8px 11px;
  border-radius: var(--vh-r-tile);
  font: 400 12px/1.2 var(--vh-sans);
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-200);
  transition:
    border-color var(--vh-t-color),
    color var(--vh-t-color);
}

.draft__chip:hover {
  border-color: var(--vh-400);
}

.draft__chip--used {
  border-color: var(--vh-success);
  color: var(--vh-success);
  cursor: default;
}

.draft__chip--used:hover {
  border-color: var(--vh-success);
}

.draft__foot {
  display: flex;
  gap: 8px;
  padding-top: 11px;
  border-top: 1px solid var(--vh-600);
}

.draft__cancel {
  flex: 1;
  height: 46px;
  border-radius: 10px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-200);
  font: 500 13px/1 var(--vh-sans);
  transition: border-color var(--vh-t-color);
}

.draft__cancel:hover {
  border-color: var(--vh-400);
}

.draft__save {
  flex: 1;
  height: 46px;
  border-radius: 10px;
  font: 600 13px/1 var(--vh-heading);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  color: var(--vh-400);
  cursor: default;
}

.draft__save--valid {
  background: var(--vh-accent);
  border-color: var(--vh-accent);
  color: var(--vh-900);
  cursor: pointer;
}
</style>
