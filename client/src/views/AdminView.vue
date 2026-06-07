<template>
  <div>
    <div class="section-head"><h2>用户管理</h2></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>用户名</th><th>角色</th><th>链接数</th><th>访问量</th><th>注册时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="u in list" :key="u._id">
              <td><strong>{{ esc(u.username) }}</strong></td>
              <td><span class="tag" :class="u.role === 'admin' ? 'tag-accent' : 'tag-blue'">{{ u.role }}</span></td>
              <td>{{ u.linkCount }}</td>
              <td>{{ u.visitCount }}</td>
              <td>{{ fmt(u.createdAt) }}</td>
              <td>
                <span v-if="u.role === 'admin'" style="color:var(--muted);font-size:12px">受保护</span>
                <button v-else class="btn btn-danger btn-sm" @click="delUser(u._id, u.username)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="page <= 1" @click="fetch(page - 1)">上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="fetch(page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/index.js';
import { useToast } from '../stores/toast.js';

const { add: toast } = useToast();

const list = ref([]);
const page = ref(1);
const totalPages = ref(1);

function esc(s) { return s ? String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'; }
function fmt(d) { if (!d) return '—'; try { return new Date(d).toLocaleString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' }); } catch { return d; } }

async function fetch(p = 1) {
  page.value = p;
  try {
    const res = await api.get(`/api/v1/admin/users?page=${p}&pageSize=15`);
    list.value = res.data.list;
    page.value = res.data.page;
    totalPages.value = res.data.totalPages;
  } catch {}
}

async function delUser(id, name) {
  if (!confirm(`确定删除用户 "${name}" 及其所有数据？不可恢复。`)) return;
  try { await api.del(`/api/v1/admin/users/${id}`); toast('用户已删除'); fetch(page.value); }
  catch (e) { toast(e.message, 'error'); }
}

onMounted(() => fetch());
</script>
