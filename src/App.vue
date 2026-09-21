<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import TabBar from '@/components/TabBar.vue';
import { useNow } from '@/composables/useNow';
import { useTrainingStore } from '@/stores/training';

const training = useTrainingStore();
const { todayIso } = useNow();
const route = useRoute();

// `rollOver()` is idempotent, so running it on start and on every date change
// is the whole date-boundary story.
watch(todayIso, () => training.refresh(), { immediate: true });

/**
 * `.shell` is the 100dvh frame and never scrolls, so the router's
 * `scrollBehavior` – which only ever addresses the window – has nothing to
 * reset. The real scroller is this element, and it has to be rewound by hand or
 * a screen entered from the bottom of the previous one opens halfway down.
 */
const scroller = ref<HTMLElement | null>(null);
watch(
  () => route.fullPath,
  () => scroller.value?.scrollTo({ top: 0 }),
);
</script>

<template>
  <div class="shell">
    <main ref="scroller" class="shell__scroll">
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
