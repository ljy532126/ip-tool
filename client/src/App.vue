<template>
  <div>
    <nav v-if="store.token">
      <router-link class="logo" to="/dashboard">TRACK<span>ER</span></router-link>
      <router-link class="nav-link" to="/dashboard">概览</router-link>
      <router-link class="nav-link" to="/links">链接</router-link>
      <router-link class="nav-link" to="/analytics">分析</router-link>
      <router-link v-if="store.isAdmin" class="nav-link" to="/admin">管理</router-link>
      <router-link class="nav-link" to="/settings">设置</router-link>
      <router-link class="nav-link" to="/docs">API</router-link>
      <div class="nav-right">
        <span class="nav-role" :class="store.user?.role">{{ store.user?.role }}</span>
        <span class="nav-user">{{ store.user?.username }}</span>
        <button class="nav-logout" @click="logout">退出</button>
      </div>
    </nav>
    <main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.msg }}</div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { store } from './stores/auth.js';
import { useToast } from './stores/toast.js';

const router = useRouter();
const { toasts } = useToast();

function logout() {
  store.clear();
  router.push('/');
}
</script>
