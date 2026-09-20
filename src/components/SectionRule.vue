<script setup lang="ts">
/**
 * Eyebrow · hairline · optional right-hand caption.
 *
 * The hairline opens with a short segment in the screen's shield quarter – the
 * one repeating element on every screen, so it is what carries the colour
 * through the content instead of leaving it to the chrome alone.
 */
defineProps<{ label: string; caption?: string }>();
</script>

<template>
  <div class="rule">
    <span class="vh-eyebrow">{{ label }}</span>
    <span class="rule__lead" />
    <div class="vh-hairline" />
    <span v-if="caption" class="rule__caption">{{ caption }}</span>
  </div>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.rule__lead {
  flex: none;
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: var(--vh-quadrant);
}

.rule__caption {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-400);
  white-space: nowrap;
}
</style>
