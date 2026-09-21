<script setup lang="ts">
import { computed } from 'vue';

import { useRankStore } from '@/stores/ranks';
import { SCOPES, SCOPE_COPY, tierColor } from '@/ui/tiers';

/** The three ladders in miniature – one column each, above Tagesbeute. */
const ranks = useRankStore();

const columns = computed(() =>
  SCOPES.map((scope) => {
    const p = ranks.progress?.[scope];
    return {
      scope,
      label: SCOPE_COPY[scope].label,
      tierName: p?.tier.name ?? '—',
      color: tierColor(p?.tier.key ?? ''),
      pct: Math.round((p?.completion ?? 0) * 100),
    };
  }),
);
</script>

<template>
  <div class="strip vh-card">
    <div v-for="col in columns" :key="col.scope" class="strip__col">
      <span class="vh-eyebrow vh-eyebrow--sm">{{ col.label }}</span>
      <span class="strip__tier">{{ col.tierName }}</span>
      <div class="strip__track">
        <div
          class="strip__fill"
          :style="{ width: `${col.pct}%`, background: col.color }"
        />
      </div>
      <span class="strip__pct">{{ col.pct }} %</span>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  padding: 13px 14px;
  border-radius: var(--vh-r-panel);
}

.strip__col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.strip__tier {
  font: 600 15px/1.1 var(--vh-heading);
  color: var(--vh-050);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.strip__track {
  height: 3px;
  background: var(--vh-600);
  border-radius: 2px;
  overflow: hidden;
}

.strip__fill {
  height: 3px;
  border-radius: 2px;
  transition: width var(--vh-t-bar);
}

.strip__pct {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-400);
}
</style>
