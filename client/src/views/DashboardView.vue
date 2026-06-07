<template>
  <div>
    <div class="section-head"><h2>数据概览 · 近 30 天</h2></div>
    <div class="stats-grid">
      <div class="stat-card" v-for="c in cards" :key="c.label" :class="c.cls">
        <div class="stat-value">{{ c.value }}</div>
        <div class="stat-label">{{ c.label }}</div>
        <div class="stat-sub">{{ c.sub }}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">
        {{ drillTitle }}
        <button v-if="drillCode" class="btn btn-outline btn-sm" style="margin-left:12px" @click="backUp">返回上级</button>
      </div>
      <div ref="mapDom" class="map-box"></div>
      <div v-if="mapLoading" class="chart-loading">加载地图中...</div>
    </div>

    <div class="charts-row">
      <div class="card">
        <div class="card-title">城市 TOP10 排行</div>
        <div ref="barDom" class="bar-box"></div>
      </div>
      <div class="card">
        <div class="card-title">最近访问记录</div>
        <div class="table-wrap" v-if="records.length">
          <table><thead><tr><th>IP</th><th>省份/城市</th><th>运营商</th><th>时间</th></tr></thead>
          <tbody><tr v-for="r in records" :key="r.ip+r.createdAt"><td class="mono">{{esc(r.ip)}}</td><td>{{esc(r.province)}} {{esc(r.city)}}</td><td>{{esc(r.isp)}}</td><td>{{fmt(r.createdAt)}}</td></tr></tbody></table>
        </div>
        <div v-else class="empty"><p>暂无访问记录</p></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import api from '../api/index.js';

const overview = ref({}); const regions = ref({}); const records = ref([]);
const mapDom = ref(null); const barDom = ref(null); const mapLoading = ref(false);
const drillCode = ref(''); const drillTitle = ref('全国城市 IP 访问热力分布');
let mapInst = null, barInst = null;
let nationalGeo = null;
let geoCache = {};

const cards = computed(() => {
  const o = overview.value || {}, r = regions.value || {};
  return [
    { value: o.totalVisits ?? '—', label: '总访问次数', sub: `近7日 ${o.weekVisits??0} 次`, cls:'accent' },
    { value: o.totalIps ?? '—', label: '独立 IP 数', sub: `今日 ${o.todayVisits??0} 次`, cls:'green' },
    { value: o.coveredCities ?? '—', label: '覆盖城市', sub: `境外 ${o.overseasCount??0} 次`, cls:'blue' },
    { value: r.topProvince?.pct!=null ? r.topProvince.pct+'%' : '—', label: 'TOP1 占比', sub: r.topProvince?.name||'暂无', cls:'red' },
  ];
});
function esc(s){return s?String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—'}
function fmt(d){if(!d)return'—';try{return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return d}}

const PROV_MAP = {
  '11000000':'北京市','12000000':'天津市','13000000':'河北省','14000000':'山西省','15000000':'内蒙古','21000000':'辽宁省',
  '22000000':'吉林省','23000000':'黑龙江省','31000000':'上海市','32000000':'江苏省','33000000':'浙江省','34000000':'安徽省',
  '35000000':'福建省','36000000':'江西省','37000000':'山东省','41000000':'河南省','42000000':'湖北省','43000000':'湖南省',
  '44000000':'广东省','45000000':'广西','46000000':'海南省','50000000':'重庆市','51000000':'四川省','52000000':'贵州省',
  '53000000':'云南省','54000000':'西藏','61000000':'陕西省','62000000':'甘肃省','63000000':'青海省','64000000':'宁夏',
  '65000000':'新疆','71000000':'台湾','81000000':'香港','82000000':'澳门',
};

// ===== 加载全国 =====
async function loadNational() {
  try {
    const res = await fetch('/china_cities.json');
    nationalGeo = await res.json();
    echarts.registerMap('china_city', nationalGeo);
  } catch(e) { console.error(e); }
}

// ===== 下钻 =====
async function drillTo(code) {
  // code: 2位=省, 4位=市
  const len = code.length;
  let url, mapKey;
  const provPrefix = code.substring(0,2);

  if (len === 2) {
    url = `/api/geojson?code=${code}0000`;
    mapKey = 'prov_' + code;
  } else if (len === 4 || len === 6) {
    url = `/api/geojson?code=${code}`;
    mapKey = 'city_' + code;
  } else return;

  mapLoading.value = true;
  try {
    if (!geoCache[mapKey]) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      geoCache[mapKey] = await res.json();
    }
    echarts.registerMap(mapKey, geoCache[mapKey]);
    drillCode.value = code;

    // 构建标题
    if (len === 2) {
      drillTitle.value = PROV_MAP[code + '000000'] || '';
    } else {
      const provName = PROV_MAP[provPrefix + '000000'] || '';
      const city = nationalGeo?.features.find(f => String(f.id) === String(code));
      drillTitle.value = (provName ? provName + ' — ' : '') + (city?.properties.name || '');
    }

    await nextTick();
    drawCharts(mapKey, len === 2);
  } catch(e) { console.error(e); }
  finally { mapLoading.value = false; }
}

function backUp() {
  const code = drillCode.value;
  if (!code) return;
  if (code.length <= 2) {
    // 从省视图回全国
    drillCode.value = '';
    drillTitle.value = '全国城市 IP 访问热力分布';
    drawCharts('china_city', true);
  } else {
    // 从市视图回省
    const prov = code.substring(0, 2);
    drillTo(prov);
  }
}

// ===== 绘制 =====
function drawCharts(mapName, showLabel = false) {
  const el = mapDom.value, barEl = barDom.value;
  if (!el || !barEl) return;
  if (mapInst) mapInst.dispose();
  if (barInst) barInst.dispose();

  const cities = regions.value?.provinces || [];
  if (!cities.length) return;

  const isNational = !drillCode.value;
  const maxVal = Math.max(...cities.map(p => p.value), 1);

  mapInst = echarts.init(el);
  mapInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(8,10,15,0.95)', borderColor: '#d4a853',
      textStyle: { color: '#8B6914', fontSize: 14, fontFamily: 'sans-serif' },
      formatter: p => {
        if (!p.value) return p.name;
        return `<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`;
      },
    },
    visualMap: {
      min: 0, max: maxVal, left: 10, bottom: 20,
      text: ['高','低'], calculable: true,
      textStyle: { color: '#c9cdd4', fontSize: 13 },
      inRange: { color: ['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c'] },
    },
    geo: {
      map: mapName, zoom: isNational ? 1.15 : 2.5, roam: true,
      center: isNational ? [104.5,36] : undefined,
      label: { show: showLabel, color: '#8B6914', fontSize: 9 },
      emphasis: { label: { color: '#8B6914', fontSize: 12, fontWeight: 'bold', show: true }, itemStyle: { areaColor: '#f5e6c8' } },
      itemStyle: { areaColor: '#0d1117', borderColor: '#2a3345', borderWidth: isNational ? 0.5 : 0.8 },
    },
    series: [{
      name: '访问次数', type: 'map', map: mapName, geoIndex: 0,
      data: cities.map(p => ({ name: p.name, value: p.value })),
    }],
  });

  // 点击事件
  const currentGeo = isNational ? nationalGeo : geoCache[mapName];
  const currentLevel = isNational ? 'nation' : (drillCode.value.length <= 2 ? 'province' : 'city');
  mapInst.off('click');
  mapInst.on('click', (params) => {
    if (!params.name || !currentGeo) return;
    const f = currentGeo.features.find(fe => fe.properties.name === params.name);
    if (!f) return;

    if (currentLevel === 'nation') {
      // 全国城市：id=330700 → 提取省代码 "33"
      if (f.id) drillTo(String(f.id).substring(0, 2));
    } else if (currentLevel === 'province') {
      // 省份城市：无 id → 从 nationalGeo 按名称反查 adcode
      const citySearchName = params.name.replace(/市$/, '');
      const cityF = nationalGeo?.features.find(fe =>
        fe.properties.name === params.name || fe.properties.name === citySearchName
      );
      if (cityF?.id) drillTo(String(cityF.id));
    }
    // city 级别不继续
  });

  // TOP10
  const top10 = [...cities].sort((a,b) => b.value - a.value).slice(0, 10);
  barInst = echarts.init(barEl);
  barInst.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger:'axis',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:13},formatter:p=>`${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次` },
    grid: { left:'4%',right:'18%',top:'8%',bottom:'8%',containLabel:true },
    xAxis: { type:'value',axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:'#111820'}},axisLabel:{color:'#8892a4',fontSize:11} },
    yAxis: { type:'category',data:top10.map(i=>i.name).reverse(),inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#c9cdd4',fontSize:13,fontWeight:600} },
    series:[{ type:'bar',data:top10.map(i=>i.value).reverse(),
      itemStyle:{borderRadius:[0,6,6,0],color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#c9a84c'},{offset:1,color:'#3b5e7a'}])},
      barWidth:'55%',label:{show:true,position:'right',color:'#c9cdd4',fontSize:12,fontWeight:700},
    }],
  });
}

function onResize(){ if(mapInst)mapInst.resize(); if(barInst)barInst.resize(); }

onMounted(async ()=>{
  try{
    const [ov,reg]=await Promise.all([api.get('/api/v1/statistics/overview'),api.get('/api/v1/statistics/user-regions')]);
    overview.value=ov.data; regions.value=reg.data; records.value=(reg.data.recentRecords||[]).slice(0,10);
    await loadNational();
    await nextTick();
    drawCharts('china_city', false);
  }catch(e){ console.error(e); }
  window.addEventListener('resize',onResize);
});
onUnmounted(()=>{
  window.removeEventListener('resize',onResize);
  if(mapInst)mapInst.dispose(); if(barInst)barInst.dispose();
});
</script>

<style scoped>
.map-box { width: 100%; height: 580px; }
.bar-box { width: 100%; height: 420px; }
.chart-loading { text-align: center; padding: 60px; color: var(--muted); font-size: 14px; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 768px) { .map-box{height:380px;} .bar-box{height:320px;} .charts-row{grid-template-columns:1fr;} }
</style>
