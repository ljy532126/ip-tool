import { store } from '../stores/auth.js';

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) headers['Authorization'] = `Bearer ${store.token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (data.code === 401) {
    store.clear();
    window.location.hash = '#/login';
    throw new Error('登录已过期');
  }
  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

export default {
  get: p => api('GET', p),
  post: (p, b) => api('POST', p, b),
  del: p => api('DELETE', p),
};
