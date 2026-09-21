<script setup lang="ts">
import type { DayCardRow } from '@/app/day-card';

defineProps<{
  title: string;
  meta: string;
  xpText: string;
  /** Rest days carry the rest token instead of the accent. */
  rest: boolean;
  badge: { label: string; variant: 'now' | 'weekday' } | null;
  open: boolean;
  rows: DayCardRow[];
  restXp: number;
  /**
   * Preview mode: the box only reads. No reorder column, no collapsing and no
   * delete – the Heute screen shows the next day this way, where none of those
   * belong.
   */
  readonly?: boolean;
  canUp?: boolean;
  canDown?: boolean;
  canDelete?: boolean;
}>();

defineEmits<{ toggle: []; up: []; down: []; remove: [] }>();
</script>

<template>
  <article class="day" :class="{ 'day--open': open }">
    <div class="day__head" :class="{ 'day__head--static': readonly }">
      <div v-if="!readonly" class="day__reorder">
        <button
          type="button"
          class="day__arrow"
          :class="{ 'day__arrow--off': !canUp }"
          :aria-disabled="!canUp"
          aria-label="Tag nach oben"
          @click="canUp && $emit('up')"
        >
          ▴
        </button>
        <button
          type="button"
          class="day__arrow"
          :class="{ 'day__arrow--off': !canDown }"
          :aria-disabled="!canDown"
          aria-label="Tag nach unten"
          @click="canDown && $emit('down')"
        >
          ▾
        </button>
      </div>

      <component
        :is="readonly ? 'div' : 'button'"
        :type="readonly ? undefined : 'button'"
        class="day__title"
        :aria-expanded="readonly ? undefined : open"
        @click="!readonly && $emit('toggle')"
      >
        <span class="day__titles">
          <span class="day__name-row">
            <span class="day__name">{{ title }}</span>
            <span v-if="badge" class="day__badge" :class="`day__badge--${badge.variant}`">
              {{ badge.label }}
            </span>
          </span>
          <span class="day__meta">{{ meta }}</span>
        </span>
        <span class="day__right">
          <span class="day__xp" :class="{ 'day__xp--rest': rest }">{{ xpText }}</span>
          <span v-if="!readonly" class="day__caret">{{ open ? '▴' : '▾' }}</span>
        </span>
      </component>
    </div>

    <div v-if="open" class="day__body">
      <div v-for="row in rows" :key="row.name" class="day__row">
        <span class="day__row-left">
          <span class="day__row-name">{{ row.name }}</span>
          <span v-if="row.target" class="day__row-target">{{ row.target }}</span>
        </span>
        <span class="day__row-sets">{{ row.setsText }}</span>
      </div>

      <div v-if="rest" class="day__rest">
        <span class="vh-rune day__rest-rune">ᛁ</span>
        <span class="day__rest-text">
          Geplanter Ruhetag. Zählt in der Rotation mit und bringt {{ restXp }} XP –
          belohnt wird der Plan, nicht die Aktivität.
        </span>
      </div>

      <div v-if="!readonly" class="day__foot">
        <span class="day__hint">
          Übungen und Sätze werden beim Anlegen eines Tages festgelegt.
        </span>
        <button
          type="button"
          class="day__delete"
          :class="{ 'day__delete--off': !canDelete }"
          :aria-disabled="!canDelete"
          @click="canDelete && $emit('remove')"
        >
          {{ canDelete ? 'Tag löschen' : 'letzter Tag' }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.day {
  background: var(--vh-800);
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-card);
  overflow: hidden;
}

.day--open {
  border-color: var(--vh-400);
}

/* The hover has to cover the reorder column too – hence on the row, not the
   title button. */
.day__head {
  display: flex;
  align-items: stretch;
  transition: background var(--vh-t-color);
}

.day__head:hover {
  background: var(--vh-700);
}

/* A preview has nothing to click, so it must not look clickable either. */
.day__head--static:hover {
  background: none;
}

.day__reorder {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px 0 10px 10px;
}

.day__arrow {
  width: 28px;
  height: 25px;
  border-radius: 6px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  padding: 0;
  font: 500 11px/1 var(--vh-mono);
  color: var(--vh-200);
  transition: border-color var(--vh-t-color);
}

.day__arrow:hover {
  border-color: var(--vh-400);
}

.day__arrow--off {
  color: var(--vh-600);
  cursor: default;
}

.day__arrow--off:hover {
  border-color: var(--vh-600);
}

.day__title {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 14px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.day__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.day__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day__name {
  font: 600 17px/1.1 var(--vh-heading);
  color: var(--vh-050);
}

.day__badge {
  font: 500 9px/1 var(--vh-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 6px;
  border-radius: 4px;
}

.day__badge--now {
  background: var(--vh-accent);
  color: var(--vh-900);
}

.day__badge--weekday {
  background: var(--vh-600);
  color: var(--vh-200);
}

.day__meta {
  font: 400 11px/1.3 var(--vh-sans);
  color: var(--vh-400);
}

.day__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.day__xp {
  font: 500 12px/1 var(--vh-mono);
  color: var(--vh-accent);
}

.day__xp--rest {
  color: var(--vh-rest);
}

.day__caret {
  font: 400 12px/1 var(--vh-mono);
  color: var(--vh-400);
}

.day__body {
  padding: 13px 15px 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-top: 1px solid var(--vh-600);
}

.day__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.day__row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.day__row-name {
  font: 500 13px/1.2 var(--vh-sans);
  color: var(--vh-050);
}

.day__row-target {
  font: 400 11px/1.2 var(--vh-mono);
  color: var(--vh-400);
}

.day__row-sets {
  font: 500 12px/1 var(--vh-mono);
  color: var(--vh-200);
  flex: none;
}

.day__rest {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  border-radius: 9px;
}

.day__rest-rune {
  font-size: 15px;
  line-height: 1;
  color: var(--vh-rest);
  flex: none;
}

.day__rest-text {
  font: 400 11px/1.4 var(--vh-sans);
  color: var(--vh-200);
}

.day__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--vh-600);
}

.day__hint {
  font: 400 10px/1.4 var(--vh-sans);
  color: var(--vh-400);
  min-width: 0;
}

.day__delete {
  flex: none;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--vh-r-tile);
  background: var(--vh-900);
  border: 1px solid var(--vh-600);
  font: 500 11px/1 var(--vh-sans);
  color: var(--vh-danger);
  transition:
    border-color var(--vh-t-color),
    color var(--vh-t-color);
}

.day__delete:hover {
  border-color: var(--vh-danger-strong);
  color: var(--vh-danger-strong);
}

.day__delete--off {
  color: var(--vh-400);
  cursor: default;
}

.day__delete--off:hover {
  border-color: var(--vh-600);
  color: var(--vh-400);
}
</style>
