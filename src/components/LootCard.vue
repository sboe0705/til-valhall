<script setup lang="ts">
import { computed } from 'vue';

/** "Tagesbeute" – the live XP of today, with the day's ceiling behind it. */
const props = withDefaults(
  defineProps<{
    xp: number;
    max: number;
    hint: string;
    rune?: string;
    accent?: string;
  }>(),
  { rune: 'ᛞ', accent: 'var(--vh-accent)' },
);

const pct = computed(() =>
  props.max > 0 ? Math.min(100, Math.round((props.xp / props.max) * 100)) : 0,
);
</script>

<template>
  <section class="loot vh-card">
    <span class="loot__rune vh-rune">{{ rune }}</span>

    <div class="loot__top">
      <div class="loot__figures">
        <span class="vh-eyebrow vh-eyebrow--sm">Tagesbeute</span>
        <div class="loot__amount">
          <span class="loot__xp" :style="{ color: accent }">{{ xp }}</span>
          <span class="loot__max">/ {{ max }} XP</span>
        </div>
      </div>
      <span class="loot__hint">{{ hint }}</span>
    </div>

    <div class="loot__track">
      <div class="loot__fill" :style="{ width: `${pct}%`, background: accent }" />
    </div>
  </section>
</template>

<style scoped>
.loot {
  padding: 15px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

.loot__rune {
  position: absolute;
  top: 9px;
  right: 11px;
  font-size: 15px;
  line-height: 1;
  color: var(--vh-600);
}

.loot__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.loot__figures {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.loot__amount {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.loot__xp {
  font: 600 30px/1 var(--vh-mono);
  transition: color 0.2s;
}

.loot__max {
  font: 400 13px/1 var(--vh-mono);
  color: var(--vh-400);
}

.loot__hint {
  font: 400 11px/1.3 var(--vh-sans);
  color: var(--vh-200);
  text-align: right;
  max-width: 150px;
}

.loot__track {
  height: 6px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  border-radius: 4px;
  overflow: hidden;
}

.loot__fill {
  height: 4px;
  transition: width var(--vh-t-bar);
}
</style>
