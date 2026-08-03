<script setup lang="ts">
defineProps<{
  title: string;
  sub: string;
  xpText: string;
  /** `missed` shows an em dash in the secondary colour. */
  missed: boolean;
  accent: string;
  selected: boolean;
}>();

defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    class="row"
    :class="{ 'row--selected': selected }"
    @click="$emit('select')"
  >
    <span class="row__left">
      <span class="row__bar" :style="{ background: accent }" />
      <span class="row__texts">
        <span class="row__title">{{ title }}</span>
        <span class="row__sub">{{ sub }}</span>
      </span>
    </span>
    <span class="row__xp" :class="{ 'row__xp--missed': missed }">{{ xpText }}</span>
  </button>
</template>

<style scoped>
.row {
  text-align: left;
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-panel);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: background var(--vh-t-color);
}

.row:hover {
  background: var(--vh-700);
}

.row--selected {
  border-color: var(--vh-400);
}

.row__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.row__bar {
  width: 3px;
  height: 32px;
  border-radius: 2px;
  flex: none;
}

.row__texts {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.row__title {
  font: 500 13px/1.2 var(--vh-sans);
  color: var(--vh-050);
}

.row__sub {
  font: 400 11px/1.2 var(--vh-mono);
  color: var(--vh-400);
}

.row__xp {
  font: 500 13px/1 var(--vh-mono);
  flex: none;
  color: var(--vh-accent);
}

.row__xp--missed {
  color: var(--vh-400);
}
</style>
