<script setup lang="ts">
/** 74px tab bar – shield icon and label. */
import shieldRedBlue from '@/assets/shields/schild-rot-blau.svg';
import shieldTriquetra from '@/assets/shields/schild-triquetra.svg';
import shieldRunes from '@/assets/shields/schild-runen.svg';
import shieldGreenGold from '@/assets/shields/schild-gruen-gold.svg';

const tabs = [
  { name: 'heute', label: 'Heute', shield: shieldRedBlue },
  { name: 'plan', label: 'Plan', shield: shieldTriquetra },
  { name: 'chronik', label: 'Chronik', shield: shieldRunes },
  { name: 'raenge', label: 'Ränge', shield: shieldGreenGold },
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
      <img class="tab__shield" :src="tab.shield" alt="" width="26" height="26" />
      <span class="tab__label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
/* Frosted glass over the scrolling content: blurred and darkened enough that
   the silver labels read on anything that passes underneath. */
.tabbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  height: var(--vh-tabbar-h);
  background: rgb(0 0 0 / 0.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.3);
  backdrop-filter: blur(10px) saturate(1.3);
  border-top: 1px solid rgb(255 255 255 / 0.08);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  padding: 0 6px;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .tabbar {
    background: var(--vh-800);
  }
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

/* Inactive shields are dimmed rather than recoloured — the print is the icon. */
.tab__shield {
  width: 26px;
  height: 26px;
  opacity: 0.45;
  filter: saturate(0.6);
  transition:
    opacity var(--vh-t-color),
    filter var(--vh-t-color);
}

.tab.router-link-active .tab__shield {
  opacity: 1;
  filter: none;
}

.tab__label {
  font: 500 10px/1 var(--vh-sans);
  letter-spacing: 0.06em;
}

/* Labels are steel like the shield rims: dark at rest, lighter on hover, bone when active. */
@media (hover: hover) {
  .tab:hover {
    color: var(--vh-200);
  }

  .tab:hover .tab__shield {
    opacity: 0.75;
  }
}

.tab.router-link-active {
  color: var(--vh-050);
}
</style>
