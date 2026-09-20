<script setup lang="ts">
import type { ResolvedTier } from '@/model/ranks';
import { TIER_SHORT, tierColor } from '@/ui/tiers';

/**
 * The rail is what communicates the order of the intermediate goals – reached
 * tiers carry their own colour, the rest the border token.
 */
const props = defineProps<{ tiers: ResolvedTier[]; currentKey: string }>();

const currentIndex = () => props.tiers.findIndex((t) => t.key === props.currentKey);

const barColor = (i: number) =>
  i <= currentIndex() ? tierColor(props.tiers[i].key) : 'var(--vh-600)';
</script>

<template>
  <div class="rail">
    <div v-for="(tier, i) in tiers" :key="tier.key" class="rail__col">
      <span class="rail__bar" :style="{ background: barColor(i) }" />
      <span
        class="rail__label"
        :class="{ 'rail__label--current': tier.key === currentKey }"
      >
        {{ TIER_SHORT[tier.key] ?? tier.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.rail {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 11px;
  border-top: 1px solid var(--vh-600);
}

.rail__col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.rail__bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
}

.rail__label {
  font: 400 8px/1.1 var(--vh-mono);
  text-align: center;
  color: var(--vh-400);
}

.rail__label--current {
  color: var(--vh-050);
}
</style>
