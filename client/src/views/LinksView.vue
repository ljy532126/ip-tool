<template>
  <div>
    <div class="section-head"><h2>链接管理</h2></div>
    <div class="card">
      <div class="card-title">+ 创建新链接</div>
      <div class="inline-form">
        <input v-model="newUrl" placeholder="输入目标网址，如 example.com/promo" @keyup.enter="create" />
        <button class="btn btn-primary" :disabled="creating" @click="create">{{ creating ? '生成中...' : '生成链接' }}</button>
      </div>
      <div v-if="createdUrl" class="url-display">
        {{ createdUrl }}
        <button @click="copyText(createdUrl)">复制</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">链接列表 <span style="font-weight:400;color:var(--muted);font-size:12px">共 {{ total }} 条</span></div>
      <div class="table-wrap" v-if="list.length">
        <table>
          <thead><tr><th>短链 Key</th><th>目标 URL</th><th>访问量</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="l in list" :key="l._id">
              <td class="mono">{{ esc(l.key) }}</td>
              <td class="url-cell">{{ esc(l.targetUrl) }}</td>
              <td><span class="tag tag-green">{{ l.visitCount }}</span></td>
              <td>{{ fmt(l.createdAt) }}</td>
              <td>
                <button class="btn btn-outline btn-sm" @click="copyLink(l.key)">复制</button>
                <button class="btn btn-outline btn-sm" @click="openVisits(l)">详情</button>
                <button class="btn btn-danger btn-sm" @click="del(l._id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty"><p>还没有链接，创建一个吧</p></div>
      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="page <= 1" @click="fetch(page - 1)">上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="fetch(page + 1)">下一页</button>
      </div>
    </div>

    <!-- Visit Detail Modal -->
    <div class="modal-mask" v-if="modal" @click.self="modal = false">
      <div class="modal-box">
        <div class="modal-hd"><h2>访问明细 · {{ modalKey }}</h2><button class="modal-x" @click="modal = false">&times;</button></div>
        <div class="modal-bd">
          <div class="table-wrap" v-if="visits.length">
            <table>
              <thead><tr><th>IP</th><th>国家</th><th>省份</th><th>城市</th><th>运营商</th><th>时间</th></tr></thead>
              <tbody>
                <tr v-for="v in visits" :key="v._id">
                  <td class="mono">{{ esc(v.ip) }}</td>
                  <td>{{ esc(v.geoInfo?.country) }}</td>
                  <td>{{ esc(v.geoInfo?.province) }}</td>
                  <td>{{ esc(v.geoInfo?.city) }}</td>
                  <td>{{ esc(v.geoInfo?.isp) }}</td>
                  <td>{{ fmt(v.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty"><p>暂无访问记录</p></div>
          <div class="pagination" v-if="vTotalPages > 1" style="margin-top:12px">
            <button :disabled="vPage <= 1" @click="loadVisits(vPage - 1)">上一页</button>
            <span class="page-info">{{ vPage }} / {{ vTotalPages }}</span>
            <button :disabled="vPage >= vTotalPages" @click="loadVisits(vPage + 1)">下一页</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/index.js';
import { useToast } from '../stores/toast.js';

const { add: toast } = useToast();

const newUrl = ref('');
const createdUrl = ref('');
const creating = ref(false);
const list = ref([]);
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);

const modal = ref(false);
const modalKey = ref('');
const modalId = ref('');
const visits = ref([]);
const vPage = ref(1);
const vTotalPages = ref(1);

function esc(s) { return s ? String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'; }
function fmt(d) { if (!d) return '—'; try { return new Date(d).toLocaleString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' }); } catch { return d; } }
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('已复制')).catch(() => toast('复制失败', 'error')); }

async function fetch(p = 1) {
  page.value = p;
  try {
    const res = await api.get(`/api/v1/links?page=${p}&pageSize=15`);
    Object.assign({ list, total, totalPages, page }, res.data);
  } catch {}
}

async function create() {
  const url = newUrl.value.trim();
  if (!url) return toast('请输入目标 URL', 'error');
  creating.value = true;
  try {
    const res = await api.post('/api/v1/links', { targetUrl: url });
    createdUrl.value = res.data.redirectUrl;
    newUrl.value = '';
    toast('链接已生成');
    fetch(page.value);
  } catch (e) { toast(e.message, 'error'); }
  finally { creating.value = false; }
}

async function del(id) {
  if (!confirm('确定删除此链接及所有访问日志？不可恢复。')) return;
  try { await api.del(`/api/v1/links/${id}`); toast('已删除'); fetch(page.value); }
  catch (e) { toast(e.message, 'error'); }
}

function copyLink(key) { copyText(`${location.protocol}//${location.host}/r/${key}`); }

async function openVisits(link) {
  modal.value = true; modalKey.value = link.key; modalId.value = link._id;
  await loadVisits(1);
}

async function loadVisits(p) {
  vPage.value = p;
  try {
    const res = await api.get(`/api/v1/links/${modalId.value}/visits?page=${p}&pageSize=15`);
    visits.value = res.data.list;
    vTotalPages.value = res.data.totalPages;
  } catch {}
}

onMounted(() => fetch());
</script>
