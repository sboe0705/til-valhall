<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** 0..1 across the whole period. */
  completion: number;
  color: string;
}>();

/** r = 37 → C = 2π·37 ≈ 232.5 */
const C = 2 * Math.PI * 37;

const pct = computed(() => Math.max(0, Math.min(1, props.completion)));
const dash = computed(() => `${(C * pct.value).toFixed(1)} ${C.toFixed(1)}`);
const label = computed(() => `${Math.round(pct.value * 100)} %`);
</script>

<template>
  <div class="ring">
    <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
      <circle class="ring__track" cx="43" cy="43" r="37" fill="none" stroke-width="5" />
      <circle
        cx="43"
        cy="43"
        r="37"
        fill="none"
        stroke-width="5"
        stroke-linecap="butt"
        transform="rotate(-90 43 43)"
        :stroke="color"
        :stroke-dasharray="dash"
      />
    </svg>
    <!--
      Deliberately an HTML <span> overlay, not an SVG <text>: a wrapper element
      injected into the SVG namespace has no rendering box and the number would
      silently disappear.
    -->
    <span class="ring__value">{{ label }}</span>
  </div>
</template>

<style scoped>
.ring {
  width: 86px;
  height: 86px;
  flex: none;
  position: relative;
}

.ring svg {
  display: block;
}

/* The unfilled part of the ring is the border token – styled here rather than
   as a presentation attribute so it stays a single source of truth. */
.ring__track {
  stroke: var(--vh-600);
}

.ring__value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 500 16px/1 var(--vh-mono);
  color: var(--vh-050);
}
</style>
