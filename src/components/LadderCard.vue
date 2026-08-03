<script setup lang="ts">
import { computed } from 'vue';

import type { RankScope, ResolvedTier, TierProgress } from '@/model/ranks';
import * as de from '@/app/format-de';
import { SCOPE_COPY, tierColor } from '@/ui/tiers';
import ProgressRing from './ProgressRing.vue';
import TierRail from './TierRail.vue';

const props = defineProps<{
  scope: RankScope;
  progress: TierProgress;
  tiers: ResolvedTier[];
}>();

const copy = computed(() => SCOPE_COPY[props.scope]);
const color = computed(() => tierColor(props.progress.tier.key));

const remaining = computed(() =>
  props.progress.next
    ? `${de.thousands(props.progress.remaining)} XP bis ${props.progress.next.name}`
    : 'Höchster Rang erreicht',
);

const figures = computed(
  () =>
    `${de.thousands(props.progress.xp)} / ${de.thousands(props.progress.max)} XP · ${copy.value.reset}`,
);
</script>

<template>
  <article class="ladder vh-card">
    <div class="ladder__top">
      <ProgressRing :completion="progress.completion" :color="color" />

      <div class="ladder__info">
        <span class="vh-eyebrow vh-eyebrow--sm">{{ copy.label }}</span>
        <div class="ladder__tier">
          <span class="ladder__dot" :style="{ background: color }" />
          <span class="ladder__name">{{ progress.tier.name }}</span>
        </div>
        <span class="ladder__remaining">{{ remaining }}</span>
        <span class="ladder__figures">{{ figures }}</span>
      </div>
    </div>

    <TierRail :tiers="tiers" :current-key="progress.tier.key" />
  </article>
</template>

<style scoped>
.ladder {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.ladder__top {
  display: flex;
  align-items: center;
  gap: 15px;
}

.ladder__info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.ladder__tier {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ladder__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
  border: 1px solid var(--vh-900);
}

.ladder__name {
  font: 600 22px/1.05 var(--vh-display);
  color: var(--vh-050);
}

.ladder__remaining {
  font: 400 11px/1.35 var(--vh-sans);
  color: var(--vh-200);
}

.ladder__figures {
  font: 400 10px/1.3 var(--vh-mono);
  color: var(--vh-400);
}
</style>
