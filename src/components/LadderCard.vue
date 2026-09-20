<script setup lang="ts">
import { computed, ref } from 'vue';

import type { RankScope, ResolvedTier, TierProgress } from '@/model/ranks';
import * as de from '@/app/format-de';
import { SCOPE_COPY, tierColor } from '@/ui/tiers';
import ProgressRing from './ProgressRing.vue';
import TierInfoDialog from './TierInfoDialog.vue';
import TierRail from './TierRail.vue';

const props = defineProps<{
  scope: RankScope;
  progress: TierProgress;
  tiers: ResolvedTier[];
}>();

const copy = computed(() => SCOPE_COPY[props.scope]);

/** The three ladders alternate the shield's two quarters, week first. */
const QUARTERS: Record<RankScope, string> = {
  week: 'var(--vh-quarter-a)',
  month: 'var(--vh-quarter-b)',
  year: 'var(--vh-quarter-a)',
};
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

const infoOpen = ref(false);
</script>

<template>
  <article class="ladder vh-card" :style="{ '--vh-card': QUARTERS[scope] }">
    <div class="ladder__top">
      <ProgressRing :completion="progress.completion" :color="color" />

      <div class="ladder__info">
        <span class="vh-eyebrow vh-eyebrow--sm">{{ copy.label }}</span>
        <div class="ladder__tier">
          <span class="ladder__dot" :style="{ background: color }" />
          <span class="ladder__name">{{ progress.tier.name }}</span>
          <button
            type="button"
            class="ladder__lore"
            :aria-label="`Was ist ${progress.tier.name}?`"
            @click="infoOpen = true"
          >
            i
          </button>
        </div>
        <span class="ladder__remaining">{{ remaining }}</span>
        <span class="ladder__figures">{{ figures }}</span>
      </div>
    </div>

    <TierRail :tiers="tiers" :current-key="progress.tier.key" />

    <TierInfoDialog
      :open="infoOpen"
      :scope="scope"
      :tier="progress.tier"
      @close="infoOpen = false"
    />
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

/** 18px circle, but a 32px hit area – the tier name must not shift for it. */
.ladder__lore {
  position: relative;
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--vh-600);
  border-radius: 50%;
  background: var(--vh-800);
  color: var(--vh-400);
  font: 500 10px/1 var(--vh-mono);
  transition:
    color var(--vh-t-color),
    border-color var(--vh-t-color);
}

.ladder__lore::after {
  content: '';
  position: absolute;
  inset: -7px;
}

.ladder__lore:hover {
  color: var(--vh-050);
  border-color: var(--vh-400);
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
