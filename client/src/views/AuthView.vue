<template>
  <div class="auth-box">
    <div class="auth-card">
      <h1>TRACKER</h1>
      <div class="auth-sub">{{ isRegister ? '创建新账户' : '登录你的账户' }}</div>
      <div v-if="error" class="auth-error">{{ error }}</div>
      <div class="field">
        <label>用户名</label>
        <input v-model="username" :placeholder="isRegister ? '3-20个字符' : '输入用户名'" @keyup.enter="submit" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" :placeholder="isRegister ? '至少6位' : '输入密码'" @keyup.enter="submit" />
      </div>
      <button class="btn btn-primary btn-block" :disabled="loading" @click="submit">
        {{ loading ? '处理中...' : (isRegister ? '注 册' : '登 录') }}
      </button>
      <div v-if="isRegister" class="auth-sub" style="margin-top:18px;margin-bottom:0">
        已有账户？<a href="#" @click.prevent="switchMode(false)">登录</a>
      </div>
      <div v-else class="auth-sub" style="margin-top:18px;margin-bottom:0">
        没有账户？<a href="#" @click.prevent="switchMode(true)">立即注册</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { store } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import api from '../api/index.js';

const router = useRouter();
const route = useRoute();
const { add: toast } = useToast();

const isRegister = ref(route.path === '/register');
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

watch(() => route.path, (val) => {
  isRegister.value = val === '/register';
  error.value = '';
});

function switchMode(reg) {
  router.push(reg ? '/register' : '/login');
}

async function submit() {
  error.value = '';
  if (!username.value || !password.value) return (error.value = '请输入用户名和密码');
  if (isRegister.value) {
    if (username.value.length < 3 || username.value.length > 20) return (error.value = '用户名 3-20 个字符');
    if (password.value.length < 6) return (error.value = '密码至少 6 位');
  }
  loading.value = true;
  try {
    const path = isRegister.value ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const res = await api.post(path, { username: username.value, password: password.value });
    toast(res.message || '成功');
    store.setSession(res.data);
    router.push('/dashboard');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
