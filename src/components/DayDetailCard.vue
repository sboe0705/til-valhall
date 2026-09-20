<script setup lang="ts">
export interface DetailRow {
  name: string;
  done: number;
  planned: number;
}

defineProps<{
  title: string;
  status: string;
  statusVariant: 'done' | 'partial' | 'missed' | 'none';
  rows: DetailRow[];
  note: string;
  xpText: string;
}>();
</script>

<template>
  <section class="detail vh-card">
    <header class="detail__head">
      <h2 class="detail__title">{{ title }}</h2>
      <span class="detail__status" :class="`detail__status--${statusVariant}`">
        {{ status }}
      </span>
    </header>

    <div v-for="row in rows" :key="row.name" class="detail__row">
      <span class="detail__name">{{ row.name }}</span>
      <div class="detail__right">
        <span class="detail__count">{{ row.done }}/{{ row.planned }}</span>
        <div class="detail__pips">
          <span
            v-for="i in row.planned"
            :key="i"
            class="detail__pip"
            :class="{ 'detail__pip--done': i <= row.done }"
          />
        </div>
      </div>
    </div>

    <footer class="detail__foot">
      <span class="detail__note">{{ note }}</span>
      <span class="detail__xp">{{ xpText }}</span>
    </footer>
  </section>
</template>

<style scoped>
.detail {
  --vh-card: var(--vh-quarter-b);
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.detail__title {
  margin: 0;
  font: 600 17px/1.1 var(--vh-heading);
  color: var(--vh-050);
}

.detail__status {
  font: 500 11px/1 var(--vh-mono);
  color: var(--vh-400);
  white-space: nowrap;
}

.detail__status--done {
  color: var(--vh-success);
}

.detail__status--partial {
  color: var(--vh-accent);
}

.detail__status--missed {
  color: var(--vh-danger);
}

.detail__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.detail__name {
  font: 400 13px/1.2 var(--vh-sans);
  color: var(--vh-200);
  min-width: 0;
}

.detail__right {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
}

.detail__count {
  font: 400 11px/1 var(--vh-mono);
  color: var(--vh-400);
}

.detail__pips {
  display: flex;
  gap: 3px;
}

.detail__pip {
  width: 9px;
  height: 9px;
  border-radius: var(--vh-r-pip);
  border: 1px solid var(--vh-600);
}

.detail__pip--done {
  background: var(--vh-success);
  border-color: var(--vh-success);
}

.detail__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--vh-600);
}

.detail__note {
  font: 400 11px/1.3 var(--vh-sans);
  color: var(--vh-400);
}

.detail__xp {
  font: 500 15px/1 var(--vh-mono);
  color: var(--vh-accent);
  white-space: nowrap;
}
</style>
