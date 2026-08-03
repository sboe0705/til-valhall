<script setup lang="ts">
import { computed } from 'vue';

import { TIERS } from '@/model/ranks';
import * as de from '@/app/format-de';
import LadderCard from '@/components/LadderCard.vue';
import SectionRule from '@/components/SectionRule.vue';
import { SCOPES, SCOPE_COPY, TIER_RUNES, tierGlyphColor } from '@/ui/tiers';
import { useRankStore } from '@/stores/ranks';

const ranks = useRankStore();

const ladders = computed(() =>
  SCOPES.map((scope) => ({
    scope,
    progress: ranks.progress?.[scope] ?? null,
    tiers: ranks.tiersFor(scope),
  })),
);

/** Best tier ever reached per scope – survives every reset. */
const records = computed(() =>
  SCOPES.map((scope) => {
    const key = ranks.records[scope];
    const tier = key ? TIERS[scope].find((t) => t.key === key) : undefined;
    return {
      scope,
      label: SCOPE_COPY[scope].record,
      name: tier?.name ?? '—',
      rune: tier ? (TIER_RUNES[tier.key] ?? 'ᛞ') : 'ᛞ',
      color: tier ? tierGlyphColor(tier.key) : 'var(--vh-600)',
      empty: !tier,
    };
  }),
);

const chronicle = computed(() =>
  ranks.history.map((item, i) => {
    const tier = TIERS[item.scope].find((t) => t.key === item.tier);
    return {
      key: `${item.scope}-${item.period}-${i}`,
      name: tier?.name ?? item.tier,
      period: de.periodLabel(item.scope, item.period),
      xp: de.xp(item.xp),
      color: tierGlyphColor(item.tier),
    };
  }),
);
</script>

<template>
  <div class="vh-screen">
    <header class="head">
      <span class="vh-eyebrow">Drei Leitern, eine Quelle</span>
      <h1 class="vh-h1">Ränge</h1>
      <span class="vh-sub">
        Jeder abgehakte Satz zählt einmal und füllt Woche, Monat und Jahr gleichzeitig.
      </span>
    </header>

    <template v-for="ladder in ladders" :key="ladder.scope">
      <LadderCard
        v-if="ladder.progress"
        :scope="ladder.scope"
        :progress="ladder.progress"
        :tiers="ladder.tiers"
      />
    </template>

    <SectionRule label="Bestmarken" caption="überlebt jeden Reset" />

    <div class="records">
      <div v-for="record in records" :key="record.scope" class="records__card vh-card">
        <span class="vh-rune records__rune" :style="{ color: record.color }">
          {{ record.rune }}
        </span>
        <span class="records__name" :class="{ 'records__name--empty': record.empty }">
          {{ record.name }}
        </span>
        <span class="records__label">{{ record.label }}</span>
      </div>
    </div>

    <SectionRule label="Abgeschlossene Perioden" />

    <div v-for="item in chronicle" :key="item.key" class="period vh-card">
      <span class="period__left">
        <span class="period__dot" :style="{ background: item.color }" />
        <span class="period__texts">
          <span class="period__name">{{ item.name }}</span>
          <span class="period__label">{{ item.period }}</span>
        </span>
      </span>
      <span class="period__xp">{{ item.xp }}</span>
    </div>

    <span v-if="chronicle.length === 0" class="empty">
      Noch keine Periode abgeschlossen – die erste schließt am Montag.
    </span>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.records {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 9px;
}

.records__card {
  border-radius: var(--vh-r-panel);
  padding: 13px 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: flex-start;
}

.records__rune {
  font-size: 17px;
  line-height: 1;
}

.records__name {
  font: 600 14px/1.1 var(--vh-heading);
  color: var(--vh-050);
}

.records__name--empty {
  color: var(--vh-400);
}

.records__label {
  font: 400 9px/1.2 var(--vh-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vh-400);
}

.period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--vh-r-chip);
}

.period__left {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.period__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.period__texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.period__name {
  font: 500 13px/1.2 var(--vh-sans);
  color: var(--vh-050);
}

.period__label {
  font: 400 10px/1.2 var(--vh-mono);
  color: var(--vh-400);
}

.period__xp {
  font: 400 11px/1 var(--vh-mono);
  color: var(--vh-200);
  white-space: nowrap;
}

.empty {
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-400);
  text-align: center;
}
</style>
