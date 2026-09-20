<script setup lang="ts">
/**
 * Eyebrow · hairline · optional right-hand caption.
 *
 * The hairline opens with a short segment in the screen's shield quarter. It
 * is the one repeating element on every screen, and out on the page it is also
 * the only place the quarter can appear at all: a shape clears the 3:1 bar
 * against the grey, a 10px label would need 4.5:1 and turn pastel for it.
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
  color: var(--vh-200);
  white-space: nowrap;
}
</style>
