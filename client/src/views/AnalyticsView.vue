<template>
  <div>
    <div class="section-head"><h2>访问分析 · 近 30 天</h2></div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">
        {{ drillTitle }}
        <button v-if="drillCode" class="btn btn-outline btn-sm" style="margin-left:12px" @click="backUp">返回上级</button>
      </div>
      <div class="map-wrap">
        <div ref="mapRef" class="map-box"></div>
        <canvas ref="gCvs" class="glow-canvas"></canvas>
      </div>
      <div v-if="mapLoading" class="chart-loading">加载地图中...</div>
    </div>

    <div class="charts-row">
      <div class="card">
        <div class="card-title">城市 TOP10 排行</div>
        <div ref="barRef" class="bar-box"></div>
      </div>
      <div class="charts-grid">
        <div class="chart-box" v-for="c in charts" :key="c.title">
          <h3>{{ c.title }}</h3>
          <canvas :id="c.id" style="max-height:260px"></canvas>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-title">城市访问排行 TOP 20</div>
      <div class="table-wrap" v-if="cityList.length">
        <table><thead><tr><th>#</th><th>城市</th><th>访问次数</th><th>占比</th></tr></thead>
        <tbody><tr v-for="(c,i) in cityList" :key="c.name"><td>{{i+1}}</td><td>{{esc(c.name)}}</td><td><span class="tag tag-accent">{{c.value}}</span></td><td>{{c.pct}}%</td></tr></tbody></table>
      </div>
      <div v-else class="empty"><p>暂无数据</p></div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);
import * as echarts from 'echarts';
import api from '../api/index.js';

const mapRef = ref(null), barRef = ref(null), gCvs = ref(null), mapLoading = ref(false);
let mapInst = null, barInst = null, nationalGeo = null, geoCache = {};
let grAF = null, gData = [];
const cityList = ref([]), charts = ref([]), chartInstances = [], regions = ref({});
const drillCode = ref(''), drillTitle = ref('全国城市 IP 访问热力分布');

function esc(s) { return s ? String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—'; }

const PM = {'11000000':'北京市','12000000':'天津市','13000000':'河北省','14000000':'山西省','15000000':'内蒙古','21000000':'辽宁省','22000000':'吉林省','23000000':'黑龙江省','31000000':'上海市','32000000':'江苏省','33000000':'浙江省','34000000':'安徽省','35000000':'福建省','36000000':'江西省','37000000':'山东省','41000000':'河南省','42000000':'湖北省','43000000':'湖南省','44000000':'广东省','45000000':'广西','46000000':'海南省','50000000':'重庆市','51000000':'四川省','52000000':'贵州省','53000000':'云南省','54000000':'西藏','61000000':'陕西省','62000000':'甘肃省','63000000':'青海省','64000000':'宁夏','65000000':'新疆','71000000':'台湾','81000000':'香港','82000000':'澳门'};

async function loadGeo() {
  try {
    const r = await fetch('/china_cities.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    nationalGeo = await r.json();
    echarts.registerMap('china_city', nationalGeo);
  } catch(e) { console.warn('地图加载失败:', e); }
}

async function load() {
  try {
    const [reg, dist] = await Promise.all([
      api.get('/api/v1/statistics/user-regions'),
      api.get('/api/v1/statistics/user-distribution'),
    ]);
    regions.value = reg.data;
    cityList.value = (reg.data.provinces || []).slice(0, 20);

    chartInstances.forEach(ci => ci.destroy());
    chartInstances.length = 0; charts.value = [];
    const d = dist.data;
    const defs = [
      d.regions?.length && { id: 'c-regions', title: '省份分布', data: d.regions },
      d.platforms?.length && { id: 'c-platforms', title: '平台分布', data: d.platforms },
      d.browsers?.length && { id: 'c-browsers', title: '浏览器分布', data: d.browsers },
    ].filter(Boolean);
    charts.value = defs;
    await nextTick();
    defs.forEach(c => {
      const cv = document.getElementById(c.id);
      if (!cv) return;
      chartInstances.push(new Chart(cv, {
        type: 'doughnut',
        data: { labels: c.data.map(i=>i.name), datasets: [{ data: c.data.map(i=>i.pct), backgroundColor: c.data.map(i=>i.color||'#d4a853'), borderColor:'rgba(8,10,15,0.8)', borderWidth:2 }] },
        options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#8892a4', padding:16, font:{size:11}, usePointStyle:true } } } },
      }));
    });

    await nextTick();
    currentMapName = 'china_city';
    drawCharts('china_city');
    setTimeout(glowRefresh, 600);
  } catch(e) { console.warn('Analytics error:', e); }
}

async function drillTo(code) {
  const len = code.length; let url, mapKey; const pp = code.substring(0, 2);
  if (len === 2) { url = `/api/geojson?code=${code}0000`; mapKey = 'prov_' + code; }
  else if (len >= 4) { url = `/api/geojson?code=${code}`; mapKey = 'city_' + code; }
  else return;
  mapLoading.value = true;
  try {
    if (!geoCache[mapKey]) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); geoCache[mapKey] = await r.json(); }
    echarts.registerMap(mapKey, geoCache[mapKey]); drillCode.value = code;
    if (len === 2) { drillTitle.value = PM[code + '000000'] || ''; }
    else { const pn = PM[pp + '000000'] || ''; const c = nationalGeo?.features.find(f => String(f.id) === String(code)); drillTitle.value = (pn ? pn + ' — ' : '') + (c?.properties.name || ''); }
    await nextTick(); drawCharts(mapKey);
  } catch(e) { console.error(e); } finally { mapLoading.value = false; }
}

function backUp() {
  const c = drillCode.value; if (!c) return;
  if (c.length <= 2) { drillCode.value = ''; drillTitle.value = '全国城市 IP 访问热力分布'; drawCharts('china_city'); }
  else drillTo(c.substring(0, 2));
}

function drawCharts(mapName) {
  const el = mapRef.value, be = barRef.value;
  if (!el || !be) return;
  if (mapInst) mapInst.dispose();
  if (barInst) barInst.dispose();
  const isNation = !drillCode.value, isCity = drillCode.value && drillCode.value.length >= 4;
  const rawData = isCity ? (regions.value?.districts || regions.value?.provinces || []) : (regions.value?.provinces || []);
  if (!rawData.length) return;

  const geo = isNation ? nationalGeo : geoCache[mapName];
  const gSet = geo ? new Set(geo.features.map(f => f.properties.name)) : new Set();
  const m = n => gSet.has(n) ? n : gSet.has(n + '市') ? n + '市' : gSet.has(n + '区') ? n + '区' : gSet.has(n + '县') ? n + '县' : n;
  const mapData = rawData.map(p => ({ name: m(p.name), value: p.value }));

  const maxVal = Math.max(...rawData.map(p => p.value), 1);

  mapInst = echarts.init(el);
  mapInst.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(8,10,15,0.95)', borderColor: '#d4a853', textStyle: { color: '#8B6914', fontSize: 14 }, formatter: p => { if (!p.value) return p.name; return `<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`; } },
    visualMap: { min: 0, max: maxVal, left: 10, bottom: 20, text: ['高', '低'], calculable: true, textStyle: { color: '#c9cdd4', fontSize: 13 }, inRange: { color: ['#101520', '#3b5e7a', '#8B7355', '#c9a84c', '#e6a23c'] } },
    geo: { map: mapName, zoom: isNation ? 1.15 : 2.5, roam: true, center: isNation ? [104.5, 36] : undefined, label: { show: false }, emphasis: { label: { color: '#8B6914', fontSize: 12, fontWeight: 'bold', show: true }, itemStyle: { areaColor: '#f5e6c8' } }, itemStyle: { areaColor: '#0d1117', borderColor: '#2a3345', borderWidth: isNation ? 0.5 : 0.8 } },
    series: [{ name: '访问次数', type: 'map', map: mapName, geoIndex: 0, data: mapData }],
  });
  currentMapName = mapName;
  setTimeout(glowRefresh, 500);

  const cGeo = isNation ? nationalGeo : geoCache[mapName];
  const level = isNation ? 'nation' : (drillCode.value.length <= 2 ? 'province' : 'city');
  mapInst.off('click');
  mapInst.on('click', p => {
    if (!p.name || !cGeo) return;
    const f = cGeo.features.find(fe => fe.properties.name === p.name);
    if (!f) return;
    if (level === 'nation') { if (f.id) drillTo(String(f.id).substring(0, 2)); }
    else if (level === 'province') { const cn = p.name.replace(/市$/, ''); const cf = nationalGeo?.features.find(fe => fe.properties.name === p.name || fe.properties.name === cn); if (cf?.id) drillTo(String(cf.id)); }
  });

  const top10 = [...rawData].sort((a, b) => b.value - a.value).slice(0, 10);
  barInst = echarts.init(be);
  barInst.setOption({
    backgroundColor: 'transparent', tooltip: { trigger: 'axis', backgroundColor: 'rgba(8,10,15,0.95)', borderColor: '#d4a853', textStyle: { color: '#8B6914', fontSize: 13 }, formatter: p => `${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次` },
    grid: { left: '4%', right: '18%', top: '8%', bottom: '8%', containLabel: true },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#111820' } }, axisLabel: { color: '#8892a4', fontSize: 11 } },
    yAxis: { type: 'category', data: top10.map(i => i.name).reverse(), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#c9cdd4', fontSize: 13, fontWeight: 600 } },
    series: [{ type: 'bar', data: top10.map(i => i.value).reverse(), itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#c9a84c' }, { offset: 1, color: '#3b5e7a' }]) }, barWidth: '55%', label: { show: true, position: 'right', color: '#c9cdd4', fontSize: 12, fontWeight: 700 } }],
  });
}

function onResize() { if (mapInst) mapInst.resize(); if (barInst) barInst.resize(); glowRefresh(); }

// ===== 粒子发光效果 =====
function glowRefresh() {
  if (!mapInst || !gCvs.value) return;
  const curMap = currentMapName || 'china_city';
  const isN = !drillCode.value;
  const geo = isN ? nationalGeo : geoCache[curMap];
  if (!geo) return;
  const raw = regions.value?.provinces || [];
  const pts = [];
  geo.features.forEach(f => {
    const cp = f.properties?.cp || f.properties?.center;
    if (!cp || cp.length < 2) return;
    const match = raw.find(p => {
      const nm = f.properties.name;
      return p.name === nm || p.name === nm.replace(/市|区|县$/, '') || nm === p.name + '市' || nm === p.name + '区' || nm === p.name + '县';
    });
    if (match) pts.push({ lon: cp[0], lat: cp[1], v: match.value });
  });
  gData = pts;
  if (!grAF) glowLoop();
}
let glowT = 0;
function glowLoop() {
  const cv = gCvs.value; if (!cv || !mapInst) return;
  const mapEl = mapRef.value; if (!mapEl) return;
  const rect = mapEl.getBoundingClientRect();
  cv.width = rect.width * window.devicePixelRatio;
  cv.height = rect.height * window.devicePixelRatio;
  cv.style.width = rect.width + 'px';
  cv.style.height = rect.height + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const isN = !drillCode.value;
  const maxV = Math.max(...gData.map(d => d.v), 1);
  glowT += 0.03;
  gData.forEach(d => {
    try {
      const px = mapInst.convertToPixel({ geoIndex: 0 }, [d.lon, d.lat]);
      if (!px || isNaN(px[0])) return;
      const x = px[0], y = px[1];
      const ratio = d.v / maxV;
      const r = 4 + ratio * 20;
      const breathe = 0.4 + 0.6 * Math.sin(glowT * 2.5 + d.lat * 0.3 + d.lon * 0.2);
      const a = (0.12 + ratio * 0.4) * breathe;

      let ic, mc, cc;
      if (ratio < 0.3) { ic = [120, 180, 255]; mc = [80, 140, 220]; cc = [180, 220, 255]; }
      else if (ratio < 0.7) { ic = [245, 210, 150]; mc = [212, 168, 83]; cc = [255, 240, 200]; }
      else { ic = [255, 200, 100]; mc = [240, 160, 40]; cc = [255, 245, 200]; }

      const grd = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      grd.addColorStop(0, `rgba(${ic[0]},${ic[1]},${ic[2]},${a})`);
      grd.addColorStop(0.5, `rgba(${mc[0]},${mc[1]},${mc[2]},${a * 0.7})`);
      grd.addColorStop(0.85, `rgba(${mc[0]},${mc[1]},${mc[2]},0.03)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      const cr = r * 0.12;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, cr);
      cg.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},${a * 1.2})`);
      cg.addColorStop(0.6, `rgba(${cc[0]},${cc[1]},${cc[2]},${a * 0.5})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2);
      ctx.fillStyle = cg; ctx.fill();
    } catch {}
  });
  grAF = requestAnimationFrame(glowLoop);
}
function stopGlow() { if (grAF) { cancelAnimationFrame(grAF); grAF = null; } }
let currentMapName = 'china_city';

onMounted(async () => {
  await loadGeo();
  await load();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if (mapInst) mapInst.dispose(); if (barInst) barInst.dispose();
  chartInstances.forEach(ci => ci.destroy());
  stopGlow();
});
</script>

<style scoped>
.map-box{width:100%;height:580px}.bar-box{width:100%;height:420px}.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.map-wrap{position:relative}.glow-canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5}.chart-loading{text-align:center;padding:60px;color:var(--muted);font-size:14px}
</style>
