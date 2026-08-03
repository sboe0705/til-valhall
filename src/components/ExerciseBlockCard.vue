<script setup lang="ts">
import { computed } from 'vue';

import type { BlockResult } from '@/model/training';
import { DEFAULT_XP, maxExtraSets } from '@/model/ranks';
import {
  doneSetsOf,
  extraSetsOf,
  liveBlockXp,
  pillTotals,
  plannedSetsOf,
} from '@/app/session-xp';
import SetPill from './SetPill.vue';

const props = defineProps<{
  result: BlockResult;
  name: string;
  target: string;
  muscles: string;
}>();

defineEmits<{ toggle: [k: number]; extra: [] }>();

const planned = computed(() => plannedSetsOf(props.result));
const done = computed(() => doneSetsOf(props.result));
const extras = computed(() => extraSetsOf(props.result));
const totals = computed(() => pillTotals(planned.value));
const complete = computed(() => done.value >= planned.value);

const xpText = computed(
  () => `${liveBlockXp(props.result)} / ${totals.value[planned.value - 1] ?? 0} XP`,
);

const state = computed(() =>
  complete.value ? (extras.value > 0 ? 'overflow' : 'done') : 'open',
);

/**
 * The button only exists while it would actually do something: the target has
 * to be met, every set checked, and the overflow ceiling still ahead.
 */
const canExtra = computed(
  () =>
    complete.value &&
    done.value === props.result.sets.length &&
    extras.value < maxExtraSets(DEFAULT_XP),
);

const note = computed(() => {
  if (!complete.value) return null;
  if (extras.value === 0) {
    return {
      text: 'Block voll – der letzte Satz war mehr wert als die ersten beiden zusammen.',
      variant: 'done' as const,
    };
  }
  const share = (DEFAULT_XP.overflow[extras.value - 1] ?? 0) * 100;
  return {
    text: `Extrasatz gebucht · Aufschlag ${Math.round(share)} % auf die Satzbasis, danach ist Schluss.`,
    variant: 'overflow' as const,
  };
});
</script>

<template>
  <article class="block vh-card">
    <header class="block__head">
      <div class="block__titles">
        <h2 class="block__name">{{ name }}</h2>
        <span class="block__target">{{ target }}</span>
        <span v-if="muscles" class="block__muscles">{{ muscles }}</span>
      </div>
      <span class="block__xp" :class="`block__xp--${state}`">{{ xpText }}</span>
    </header>

    <div class="block__sets">
      <SetPill
        v-for="(set, i) in result.sets"
        :key="set.setIndex"
        :index="i + 1"
        :done="i < done"
        :extra="i >= planned"
        :total="totals[i] ?? 0"
        @tap="$emit('toggle', i + 1)"
      />
      <button v-if="canExtra" type="button" class="block__extra" @click="$emit('extra')">
        <span class="vh-rune block__extra-rune">ᚹ</span>
        <span>Extra</span>
      </button>
    </div>

    <span v-if="note" class="block__note" :class="`block__note--${note.variant}`">
      {{ note.text }}
    </span>
  </article>
</template>

<style scoped>
.block {
  padding: 14px 15px 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.block__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.block__name {
  margin: 0;
  font: 600 17px/1.15 var(--vh-heading);
  color: var(--vh-050);
}

.block__target {
  font: 400 12px/1.3 var(--vh-mono);
  color: var(--vh-200);
}

.block__muscles {
  font: 400 11px/1.3 var(--vh-sans);
  color: var(--vh-400);
}

.block__xp {
  font: 500 11px/1 var(--vh-mono);
  white-space: nowrap;
  padding-top: 2px;
  color: var(--vh-400);
}

.block__xp--done {
  color: var(--vh-success);
}

.block__xp--overflow {
  color: var(--vh-overflow);
}

.block__sets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.block__extra {
  height: 52px;
  padding: 0 13px;
  border-radius: 10px;
  background: var(--vh-900);
  border: 1px dashed var(--vh-overflow);
  color: var(--vh-overflow);
  font: 500 11px/1.2 var(--vh-mono);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: background var(--vh-t-color);
}

.block__extra:hover {
  background: var(--vh-700);
}

.block__extra-rune {
  font-size: 14px;
  line-height: 1;
}

.block__note {
  font: 400 11px/1.35 var(--vh-sans);
}

.block__note--done {
  color: var(--vh-success);
}

.block__note--overflow {
  color: var(--vh-overflow);
}
</style>
