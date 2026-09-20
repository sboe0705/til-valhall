<script setup lang="ts">
/**
 * Back matter for the Heute screen: which build is running, and the way to the
 * legal notice. The values are substituted at build time – see `vite.config.ts`.
 */
const commit = __APP_COMMIT__;
const commitDate = __APP_COMMIT_DATE__;
</script>

<template>
  <footer class="foot">
    <span class="foot__build">v{{ commit }} · {{ commitDate }}</span>
    <span class="foot__sep">·</span>
    <RouterLink class="foot__link" to="/impressum">Impressum</RouterLink>
  </footer>
</template>

<style scoped>
.foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 4px;
}

.foot__build {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-200);
}

.foot__sep {
  color: var(--vh-line);
}

.foot__link {
  font: 400 10px/1 var(--vh-mono);
  color: var(--vh-200);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color var(--vh-t-color);
}

.foot__link:hover {
  color: var(--vh-accent);
}
</style>
