<script setup lang="ts">
/**
 * 74px tab bar – runic glyph, label, 16×2 underline pill.
 *
 * The four tabs are the four quarters of the shield and each carries its own
 * colour, so the bar reads as one coloured band instead of four grey slots.
 * `accent` is the same token `--vh-quadrant` resolves to on that route – it is
 * repeated here because an inactive tab has to show its colour too, and that
 * one is never the current quarter.
 */
const tabs = [
  { name: 'heute', label: 'Heute', rune: 'ᛞ', accent: 'var(--vh-shield-gold)' },
  { name: 'plan', label: 'Plan', rune: 'ᛃ', accent: 'var(--vh-shield-blue)' },
  { name: 'chronik', label: 'Chronik', rune: 'ᚱ', accent: 'var(--vh-shield-red)' },
  { name: 'raenge', label: 'Ränge', rune: 'ᛊ', accent: 'var(--vh-shield-green)' },
] as const;
</script>

<template>
  <nav class="tabbar">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      class="tab"
      :to="{ name: tab.name }"
      :aria-label="tab.label"
      :style="{ '--tab-accent': tab.accent }"
    >
      <span class="tab__rune vh-rune">{{ tab.rune }}</span>
      <span class="tab__label">{{ tab.label }}</span>
      <span class="tab__underline" />
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  flex: none;
  height: var(--vh-tabbar-h);
  background: var(--vh-800);
  border-top: 1px solid var(--vh-600);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  padding: 0 6px;
}

.tab {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  text-decoration: none;
  color: var(--vh-400);
  transition: color var(--vh-t-color);
}

/*
 * The rune keeps its quarter's colour at all times, dimmed while the tab is
 * inactive; only the label and the underline switch to full strength. Dimming
 * with `opacity` rather than a second token keeps one colour per tab.
 */
.tab__rune {
  font-size: 19px;
  line-height: 1;
  color: var(--tab-accent);
  opacity: 0.45;
  transition: opacity var(--vh-t-color);
}

.tab__label {
  font: 500 10px/1 var(--vh-sans);
  letter-spacing: 0.06em;
}

.tab__underline {
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: transparent;
}

.tab.router-link-active {
  color: var(--tab-accent);
}

.tab.router-link-active .tab__rune {
  opacity: 1;
}

.tab.router-link-active .tab__underline {
  background: var(--tab-accent);
}
</style>
