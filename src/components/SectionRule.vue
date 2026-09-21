<script setup lang="ts">
/** Eyebrow · hairline · optional right-hand caption. */
defineProps<{ label: string; caption?: string }>();
</script>

<template>
  <div class="rule">
    <span class="vh-eyebrow">{{ label }}</span>
    <div class="vh-hairline" />
    <span v-if="caption" class="rule__caption">{{ caption }}</span>
  </div>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.rule__caption {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-400);
  white-space: nowrap;
}
</style>
