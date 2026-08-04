<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { blocksInOrder } from '@/model/plan-cycle';
import { DAY_XP, REST_XP, potentialXp } from '@/model/ranks';
import {
  blockBasesOf,
  doneSetsOf,
  isComplete,
  liveSessionXp,
  plannedSetsOf,
} from '@/app/session-xp';
import * as de from '@/app/format-de';
import AppFooter from '@/components/AppFooter.vue';
import ExerciseBlockCard from '@/components/ExerciseBlockCard.vue';
import LootCard from '@/components/LootCard.vue';
import RankStrip from '@/components/RankStrip.vue';
import SectionRule from '@/components/SectionRule.vue';
import { useNow } from '@/composables/useNow';
import { useTrainingStore } from '@/stores/training';
import { dayNumbers } from '@/model/plan-edit';

const training = useTrainingStore();
const { now } = useNow();

onMounted(() => training.startToday());

const plan = computed(() => training.activePlan);
const day = computed(() => training.todayDay);
const session = computed(() => training.todaySession);

const isRest = computed(() => day.value?.restDay === true);
const nothingPlanned = computed(() => day.value === null);

const heading = computed(() => {
  if (!day.value) return 'Frei';
  const numbers = plan.value ? dayNumbers(plan.value) : new Map();
  return de.dayTitle(day.value, numbers.get(day.value.id) ?? null);
});

const blocks = computed(() => (day.value ? blocksInOrder(day.value) : []));

const subline = computed(() => {
  if (!day.value) return 'Für heute ist nichts eingeplant.';
  if (isRest.value) return 'Kein Block · rotiert mit und zählt.';
  const sets = blocks.value.reduce((sum, b) => sum + b.sets, 0);
  const minutes = de.estimateMinutes(day.value, training.exercises);
  return `${blocks.value.length} Übungen · ${sets} Sätze · geschätzt ${minutes} Min`;
});

const xp = computed(() => (session.value ? liveSessionXp(session.value) : 0));
const maxXp = computed(() => (day.value ? potentialXp(day.value) : 0));

const setsDone = computed(() =>
  (session.value?.results ?? []).reduce(
    (sum, r) => sum + Math.min(doneSetsOf(r), plannedSetsOf(r)),
    0,
  ),
);
const setsTotal = computed(() =>
  (session.value?.results ?? []).reduce((sum, r) => sum + plannedSetsOf(r), 0),
);

const complete = computed(() => (session.value ? isComplete(session.value) : false));

const lootHint = computed(() => {
  if (nothingPlanned.value) return 'Kein Eintrag – die Woche läuft trotzdem weiter.';
  if (isRest.value)
    return 'Geplanter Ruhetag. Belohnt wird der Plan, nicht die Aktivität.';
  return complete.value
    ? 'Tag vollständig – die vollen Tagespunkte stehen.'
    : 'Der letzte Satz eines Blocks zahlt am meisten.';
});

const finishHint = computed(() =>
  complete.value
    ? `Tag vollständig · ${DAY_XP} XP gebucht · Zeiger rückt weiter`
    : `Jeder Tag ist ${DAY_XP} XP wert – zu holen sind sie erst, wenn alle Pflichtsätze stehen.`,
);

/**
 * Display data per block – the result is the session's, the copy the plan's,
 * and `base` the block's share of the day's 120 XP.
 */
const rows = computed(() => {
  const bases = session.value ? blockBasesOf(session.value) : [];
  return (session.value?.results ?? []).map((result, i) => {
    const block = blocks.value.find((b) => b.id === result.blockId);
    const exercise = training.exercises[result.exerciseId];
    return {
      result,
      base: bases[i] ?? 0,
      name: exercise?.name ?? 'Übung',
      target: block ? de.blockDe(block, exercise) : '',
      muscles: de.musclesDe(exercise),
    };
  });
});
</script>

<template>
  <div class="vh-screen">
    <header class="head">
      <div class="head__meta">
        <span class="head__date">{{ de.dateLong(now) }}</span>
        <span class="head__plan">{{ plan?.name ?? '' }}</span>
      </div>
      <h1 class="head__title">{{ heading }}</h1>
      <span class="vh-sub">{{ subline }}</span>
    </header>

    <RankStrip />

    <LootCard
      :xp="xp"
      :max="maxXp"
      :hint="lootHint"
      :rune="isRest ? 'ᛁ' : 'ᛞ'"
      :accent="isRest ? 'var(--vh-rest)' : 'var(--vh-accent)'"
    />

    <template v-if="isRest">
      <div class="rest vh-card">
        <span class="rest__rune vh-rune">ᛁ</span>
        <span class="rest__text">
          Geplanter Ruhetag. Zählt in der Rotation mit und bringt
          {{ REST_XP }} XP – belohnt wird der Plan, nicht die Aktivität.
        </span>
      </div>
    </template>

    <template v-else-if="nothingPlanned">
      <div class="rest vh-card">
        <span class="rest__rune vh-rune rest__rune--quiet">ᛜ</span>
        <span class="rest__text">
          Für diesen Wochentag ist kein Tag belegt. Belegte Wochentage änderst du im Plan
          – ein Ruhetag ist etwas anderes als nichts.
        </span>
      </div>
    </template>

    <template v-else>
      <SectionRule label="Sätze" :caption="`${setsDone} / ${setsTotal}`" />

      <ExerciseBlockCard
        v-for="row in rows"
        :key="row.result.blockId"
        :result="row.result"
        :base="row.base"
        :name="row.name"
        :target="row.target"
        :muscles="row.muscles"
        @toggle="(k) => training.toggleSet(row.result.blockId, k)"
        @extra="training.addExtraSet(row.result.blockId)"
      />

      <span class="finish">{{ finishHint }}</span>
    </template>

    <AppFooter />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.head__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head__date {
  font: 500 10px/1 var(--vh-mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vh-400);
}

.head__plan {
  font: 500 10px/1 var(--vh-mono);
  letter-spacing: 0.12em;
  color: var(--vh-400);
  white-space: nowrap;
}

.head__title {
  margin: 0;
  font: 600 32px/1.02 var(--vh-display);
  color: var(--vh-050);
}

.rest {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 15px;
}

.rest__rune {
  font-size: 17px;
  line-height: 1.2;
  color: var(--vh-rest);
  flex: none;
}

.rest__rune--quiet {
  color: var(--vh-400);
}

.rest__text {
  font: 400 11px/1.45 var(--vh-sans);
  color: var(--vh-200);
}

.finish {
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-400);
  text-align: center;
  margin-top: 2px;
}
</style>
