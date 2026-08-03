<script setup lang="ts">
import { watch } from 'vue';

import TabBar from '@/components/TabBar.vue';
import { useNow } from '@/composables/useNow';
import { useTrainingStore } from '@/stores/training';

const training = useTrainingStore();
const { todayIso } = useNow();

// `rollOver()` is idempotent, so running it on start and on every date change
// is the whole date-boundary story.
watch(todayIso, () => training.refresh(), { immediate: true });
</script>

<template>
  <div class="shell">
    <main class="shell__scroll">
      <RouterView />
    </main>
    <TabBar />
  </div>
</template>

<style scoped>
.shell {
  width: 100%;
  max-width: var(--vh-screen-max);
  margin: 0 auto;
  height: 100dvh;
  background: var(--vh-900);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shell__scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 8px;
}

/* Desktop is out of scope for the handoff – keep the phone column centred and
   fence it off with the border the design uses for cards. */
@media (min-width: 520px) {
  .shell {
    border-left: 1px solid var(--vh-600);
    border-right: 1px solid var(--vh-600);
  }
}
</style>
