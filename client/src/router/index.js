import { createRouter, createWebHashHistory } from 'vue-router';
import { store } from '../stores/auth.js';
import WelcomeView from '../views/WelcomeView.vue';
import AuthView from '../views/AuthView.vue';
import DashboardView from '../views/DashboardView.vue';
import LinksView from '../views/LinksView.vue';
import AnalyticsView from '../views/AnalyticsView.vue';
import AdminView from '../views/AdminView.vue';
import SettingsView from '../views/SettingsView.vue';
import ApiDocsView from '../views/ApiDocsView.vue';

const routes = [
  { path: '/', component: WelcomeView },
  { path: '/login', component: AuthView, meta: { guest: true } },
  { path: '/register', component: AuthView, meta: { guest: true } },
  { path: '/docs', component: ApiDocsView },
  { path: '/dashboard', component: DashboardView, meta: { auth: true } },
  { path: '/links', component: LinksView, meta: { auth: true } },
  { path: '/analytics', component: AnalyticsView, meta: { auth: true } },
  { path: '/admin', component: AdminView, meta: { auth: true, admin: true } },
  { path: '/settings', component: SettingsView, meta: { auth: true, admin: true } },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to, from, next) => {
  if (to.meta.auth && !store.token) return next('/login');
  if (to.meta.guest && store.token) return next('/dashboard');
  if (to.meta.admin && !store.isAdmin) return next('/dashboard');
  next();
});

export default router;
