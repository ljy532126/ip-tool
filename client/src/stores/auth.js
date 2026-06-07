import { reactive } from 'vue';

const STORE_KEY = 'iptrack_store';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
}
function save(token, user) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ token, user }));
}

const saved = load();

export const store = reactive({
  token: saved.token || '',
  user: saved.user || null,

  get isAdmin() {
    return this.user?.role === 'admin';
  },

  setSession(data) {
    this.token = data.token;
    this.user = { userId: data.userId, username: data.username, role: data.role };
    save(this.token, this.user);
  },

  clear() {
    this.token = '';
    this.user = null;
    localStorage.removeItem(STORE_KEY);
  },
});
