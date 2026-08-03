<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** 1-based position within the block. */
  index: number;
  done: boolean;
  /** A set beyond the planned target. */
  extra: boolean;
  /** Cumulative block XP once this set is checked. */
  total: number;
}>();

defineEmits<{ tap: [] }>();

const mark = computed(() => (props.done ? '✓' : String(props.index)));
const xp = computed(() => (props.done ? `+${props.total}` : `${props.total} XP`));
const variant = computed(() =>
  props.done ? (props.extra ? 'overflow' : 'done') : 'open',
);
</script>

<template>
  <button
    type="button"
    class="pill"
    :class="`pill--${variant}`"
    :aria-pressed="done"
    :aria-label="`Satz ${index}`"
    @click="$emit('tap')"
  >
    <span class="pill__mark">{{ mark }}</span>
    <span class="pill__xp">{{ xp }}</span>
  </button>
</template>

<style scoped>
.pill {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0;
  transition:
    background var(--vh-t-color),
    border-color var(--vh-t-color),
    color var(--vh-t-color);
}

.pill--open {
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  color: var(--vh-400);
}

.pill--done {
  background: var(--vh-fill-success);
  border: 1px solid var(--vh-success);
  color: var(--vh-success);
}

.pill--overflow {
  background: var(--vh-fill-overflow);
  border: 1px solid var(--vh-overflow);
  color: var(--vh-overflow);
}

.pill:hover {
  border-color: var(--vh-400);
}

.pill__mark {
  font: 500 15px/1 var(--vh-mono);
}

.pill__xp {
  font: 400 9px/1 var(--vh-mono);
  opacity: 0.72;
}
</style>
