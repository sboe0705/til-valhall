<script setup lang="ts">
/** 74px tab bar – runic glyph, label, 16×2 underline pill. */
const tabs = [
  { name: 'heute', label: 'Heute', rune: 'ᛞ' },
  { name: 'plan', label: 'Plan', rune: 'ᛃ' },
  { name: 'chronik', label: 'Chronik', rune: 'ᚱ' },
  { name: 'raenge', label: 'Ränge', rune: 'ᛊ' },
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

.tab__rune {
  font-size: 19px;
  line-height: 1;
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
  color: var(--vh-accent);
}

.tab.router-link-active .tab__underline {
  background: var(--vh-accent);
}
</style>
