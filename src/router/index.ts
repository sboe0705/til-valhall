import { createRouter, createWebHistory } from 'vue-router';

import HeuteView from '@/views/HeuteView.vue';

/**
 * One route per tab, plus `/impressum` – the only screen without a tab. The tab
 * bar is otherwise the whole navigation, but routes make the screens
 * deep-linkable and give the e2e test something to address.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/heute' },
    { path: '/heute', name: 'heute', component: HeuteView },
    { path: '/plan', name: 'plan', component: () => import('@/views/PlanView.vue') },
    {
      path: '/chronik',
      name: 'chronik',
      component: () => import('@/views/ChronikView.vue'),
    },
    {
      path: '/raenge',
      name: 'raenge',
      component: () => import('@/views/RaengeView.vue'),
    },
    {
      path: '/impressum',
      name: 'impressum',
      component: () => import('@/views/ImpressumView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/heute' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

export default router;
