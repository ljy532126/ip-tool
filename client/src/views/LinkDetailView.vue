<template>
  <div>
    <div class="section-head">
      <h2>链接分布 · <span style="color:var(--accent)">{{ link.key }}</span></h2>
      <button class="btn btn-outline btn-sm" @click="$router.back()">返回</button>
    </div>

    <p style="font-size:13px;color:var(--muted);margin-bottom:18px">
      目标：{{ link.targetUrl }} &nbsp;|&nbsp; 总访问：<span class="tag tag-green">{{ link.visitCount }}</span>
    </p>

    <div class="stats-grid">
      <div class="stat-card accent"><div class="stat-value">{{ link.visitCount||0 }}</div><div class="stat-label">总访问次数</div></div>
      <div class="stat-card green"><div class="stat-value">{{ cities.length }}</div><div class="stat-label">覆盖城市</div></div>
      <div class="stat-card blue"><div class="stat-value">{{ uniqueIps }}</div><div class="stat-label">独立IP</div></div>
      <div class="stat-card red"><div class="stat-value">{{ topCity }}</div><div class="stat-label">TOP1城市</div></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">城市热力分布</div>
      <div ref="mapDom" class="map-box"></div>
    </div>

    <div class="charts-row">
      <div class="card">
        <div class="card-title">城市 TOP10 排行</div>
        <div ref="barDom" class="bar-box"></div>
      </div>
      <div class="card">
        <div class="card-title">访问明细</div>
        <div class="table-wrap" v-if="records.length">
          <table><thead><tr><th>IP</th><th>省份/城市</th><th>运营商</th><th>时间</th></tr></thead>
          <tbody><tr v-for="r in records" :key="r._id"><td class="mono">{{esc(r.ip)}}</td><td>{{loc(r)}}</td><td>{{esc(r.geoInfo?.isp)}}</td><td>{{fmt(r.createdAt)}}</td></tr></tbody></table>
        </div>
        <div v-else class="empty"><p>暂无访问记录</p></div>
        <div class="pagination" v-if="totalPages>1">
          <button :disabled="page<=1" @click="fetchVisits(page-1)">上一页</button><span class="page-info">{{page}}/{{totalPages}}</span><button :disabled="page>=totalPages" @click="fetchVisits(page+1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as echarts from 'echarts';
import api from '../api/index.js';

const route = useRoute();
const link = ref({});
const cities = ref([]);
const records = ref([]);
const page = ref(1), totalPages = ref(1);
const mapDom = ref(null), barDom = ref(null);
let mapInst = null, barInst = null, nationalGeo = null;

const uniqueIps = computed(() => new Set(records.value.map(r => r.ip)).size);
const topCity = computed(() => cities.value[0]?.name || '—');

function esc(s) { return s ? String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'; }
function fmt(d) { if (!d) return '—'; try { return new Date(d).toLocaleString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' }); } catch { return d; } }
function loc(r) { return esc([r.geoInfo?.province, r.geoInfo?.city, r.geoInfo?.district].filter(Boolean).join(' ')); }

async function load() {
  const id = route.params.id;
  try {
    const geoRes = await fetch('/china_cities.json');
    nationalGeo = await geoRes.json();
    echarts.registerMap('link_map', nationalGeo);

    const [regRes, visitRes] = await Promise.all([
      api.get(`/api/v1/links/${id}/regions`),
      api.get(`/api/v1/links/${id}/visits?page=1&pageSize=15`),
    ]);
    link.value = regRes.data.link || {};
    cities.value = regRes.data.cities || [];
    records.value = visitRes.data.list || [];
    totalPages.value = visitRes.data.totalPages || 1;

    await nextTick();
    drawCharts();
  } catch (e) { console.warn(e); }
}

async function fetchVisits(p) {
  page.value = p;
  try {
    const r = await api.get(`/api/v1/links/${route.params.id}/visits?page=${p}&pageSize=15`);
    records.value = r.data.list;
    totalPages.value = r.data.totalPages;
  } catch {}
}

function drawCharts() {
  const el = mapDom.value, be = barDom.value;
  if (!el || !be || !cities.value.length) return;
  if (mapInst) mapInst.dispose();
  if (barInst) barInst.dispose();

  const gSet = new Set(nationalGeo.features.map(f => f.properties.name));
  const m = n => gSet.has(n) ? n : gSet.has(n+'市') ? n+'市' : gSet.has(n+'区') ? n+'区' : gSet.has(n+'县') ? n+'县' : n;
  const mapData = cities.value.map(p => ({ name: m(p.name), value: p.value }));
  const maxVal = Math.max(...cities.value.map(p => p.value), 1);

  mapInst = echarts.init(el);
  mapInst.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(8,10,15,0.95)', borderColor: '#d4a853', textStyle: { color: '#8B6914', fontSize: 14 }, formatter: p => `<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次` },
    visualMap: { min: 0, max: maxVal, left: 10, bottom: 20, text: ['高','低'], calculable: true, textStyle: { color: '#c9cdd4', fontSize: 13 }, inRange: { color: ['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c'] } },
    geo: { map: 'link_map', zoom: 1.15, center: [104.5, 36], roam: true, label: { show: false }, emphasis: { label: { color: '#8B6914', fontSize: 12, fontWeight: 'bold', show: true }, itemStyle: { areaColor: '#f5e6c8' } }, itemStyle: { areaColor: '#0d1117', borderColor: '#2a3345', borderWidth: 0.5 } },
    series: [{ name: '访问', type: 'map', map: 'link_map', geoIndex: 0, data: mapData }],
  });

  const top10 = [...cities.value].sort((a,b) => b.value - a.value).slice(0, 10);
  barInst = echarts.init(be);
  barInst.setOption({
    backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: 'rgba(8,10,15,0.95)', borderColor: '#d4a853', textStyle: { color: '#8B6914', fontSize: 13 }, formatter: p => `${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次` },
    grid: { left: '4%', right: '18%', top: '8%', bottom: '8%', containLabel: true },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#111820' } }, axisLabel: { color: '#8892a4', fontSize: 11 } },
    yAxis: { type: 'category', data: top10.map(i => i.name).reverse(), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#c9cdd4', fontSize: 13, fontWeight: 600 } },
    series: [{ type: 'bar', data: top10.map(i => i.value).reverse(), itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#c9a84c' }, { offset: 1, color: '#3b5e7a' }]) }, barWidth: '55%', label: { show: true, position: 'right', color: '#c9cdd4', fontSize: 12, fontWeight: 700 } }],
  });
}

function onResize() { if (mapInst) mapInst.resize(); if (barInst) barInst.resize(); }

onMounted(async () => { await load(); window.addEventListener('resize', onResize); });
onUnmounted(() => { window.removeEventListener('resize', onResize); if (mapInst) mapInst.dispose(); if (barInst) barInst.dispose(); });
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.map-box { width: 100%; height: 500px; }
.bar-box { width: 100%; height: 420px; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media(max-width:768px){ .stats-grid{grid-template-columns:repeat(2,1fr)} .charts-row{grid-template-columns:1fr} .map-box{height:340px} .bar-box{height:280px} }
</style>
