<script setup lang="ts">
/**
 * The lore popup behind the current rank.
 *
 * A native <dialog> on purpose: it renders in the top layer, so it escapes the
 * `.shell` frame (`100dvh`, `overflow: hidden`) without a teleport, and brings
 * Esc, focus trapping and inertness of the page behind it for free.
 */
import { ref, watch } from 'vue';

import type { RankScope, ResolvedTier } from '@/model/ranks';
import * as de from '@/app/format-de';
import { SCOPE_COPY, TIER_RUNES, tierColor, tierLore } from '@/ui/tiers';

const props = defineProps<{
  open: boolean;
  scope: RankScope;
  tier: ResolvedTier;
}>();

const emit = defineEmits<{ close: [] }>();

const el = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    const dialog = el.value;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  },
);

/** Fires for Esc and for `close()` alike – one place to sync the prop back. */
const onClose = () => emit('close');

/** The dialog element itself is the backdrop-sized box; the card is inside. */
const onClick = (event: MouseEvent) => {
  if (event.target === el.value) emit('close');
};
</script>

<template>
  <dialog ref="el" class="info" @close="onClose" @click="onClick">
    <article class="info__card vh-card">
      <header class="info__head">
        <span class="vh-rune info__rune" :style="{ color: tierColor(tier.key) }">
          {{ TIER_RUNES[tier.key] ?? 'ᛞ' }}
        </span>
        <span class="info__texts">
          <span class="vh-eyebrow vh-eyebrow--sm">{{ SCOPE_COPY[scope].system }}</span>
          <h2 class="info__name">{{ tier.name }}</h2>
        </span>
      </header>

      <p class="info__lore">{{ tierLore(tier.key) }}</p>

      <span class="info__threshold">
        {{ tier.minXp === 0 ? 'Startrang' : `ab ${de.thousands(tier.minXp)} XP` }}
      </span>

      <button type="button" class="info__close" @click="emit('close')">Schließen</button>
    </article>
  </dialog>
</template>

<style scoped>
.info {
  margin: auto;
  padding: 0;
  border: 0;
  background: none;
  width: min(100% - 36px, calc(var(--vh-screen-max) - 36px));
  max-height: calc(100dvh - 48px);
  overflow: visible;
  color: var(--vh-050);
}

.info::backdrop {
  background: rgb(15 20 22 / 0.72);
}

.info[open] .info__card {
  animation: vhrise var(--vh-t-screen);
}

.info__card {
  padding: 17px;
  display: flex;
  flex-direction: column;
  gap: 13px;
  background: var(--vh-800);
}

.info__head {
  display: flex;
  align-items: center;
  gap: 13px;
}

.info__rune {
  font-size: 26px;
  line-height: 1;
}

.info__texts {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.info__name {
  margin: 0;
  font: 600 24px/1.05 var(--vh-display);
  color: var(--vh-050);
}

.info__lore {
  margin: 0;
  font: 400 13px/1.5 var(--vh-sans);
  color: var(--vh-200);
}

.info__threshold {
  font: 400 10px/1.3 var(--vh-mono);
  color: var(--vh-400);
}

.info__close {
  align-self: flex-end;
  padding: 8px 15px;
  border: 1px solid var(--vh-600);
  border-radius: var(--vh-r-chip);
  background: var(--vh-700);
  color: var(--vh-050);
  font: 500 12px/1 var(--vh-sans);
  transition: background var(--vh-t-color);
}

.info__close:hover {
  background: var(--vh-600);
}
</style>
