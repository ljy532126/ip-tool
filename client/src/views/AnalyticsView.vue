<template>
  <div>
    <div class="section-head"><h2>访问分析 · 近 30 天</h2></div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-title">全国城市 IP 访问热力分布</div>
      <div ref="mapRef" class="map-box"></div>
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
import { Chart } from 'chart.js';
import * as echarts from 'echarts';
import api from '../api/index.js';

const mapRef = ref(null), barRef = ref(null);
let mapInst = null, barInst = null, nationalGeo = null, geoReady = false;
const cityList = ref([]), charts = ref([]), chartInstances = [], provinces = ref([]);

function esc(s) { return s ? String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—'; }

async function loadGeo() {
  try {
    const r = await fetch('/china_cities.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    nationalGeo = await r.json();
    echarts.registerMap('china_city', nationalGeo);
    geoReady = true;
  } catch(e) { console.warn('地图加载失败:', e); }
}

async function load() {
  try {
    const [reg, dist] = await Promise.all([
      api.get('/api/v1/statistics/user-regions'),
      api.get('/api/v1/statistics/user-distribution'),
    ]);
    provinces.value = reg.data.provinces || [];
    cityList.value = (reg.data.provinces || []).slice(0, 20);

    // Chart.js
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

    drawMap();
  } catch(e) { console.warn('Analytics error:', e); }
}

function drawMap() {
  const el = mapRef.value, be = barRef.value;
  if (!el || !be || !geoReady) return;
  const data = provinces.value;
  if (!data.length) return;

  if (mapInst) mapInst.dispose();
  if (barInst) barInst.dispose();

  // 名称匹配
  const gSet = nationalGeo ? new Set(nationalGeo.features.map(f => f.properties.name)) : new Set();
  const m = n => gSet.has(n) ? n : gSet.has(n+'市') ? n+'市' : gSet.has(n+'区') ? n+'区' : gSet.has(n+'县') ? n+'县' : n;
  const mapData = data.map(p => ({ name: m(p.name), value: p.value }));
  const maxVal = Math.max(...data.map(p => p.value), 1);

  mapInst = echarts.init(el);
  mapInst.setOption({
    backgroundColor:'transparent',
    tooltip:{ trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>{if(!p.value)return p.name;return`<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`}},
    visualMap:{ min:0,max:maxVal,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
    geo:{ map:'china_city',zoom:1.15,center:[104.5,36],roam:true,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:0.5}},
    series:[{ name:'访问次数',type:'map',map:'china_city',geoIndex:0,data:mapData }],
  });

  // 下钻
  mapInst.off('click');
  mapInst.on('click', p => {
    if (!p.name || !nationalGeo) return;
    const f = nationalGeo.features.find(fe => fe.properties.name === p.name);
    if (f?.id) drillDown(String(f.id));
  });

  // TOP10
  const top10 = [...data].sort((a,b) => b.value - a.value).slice(0, 10);
  barInst = echarts.init(be);
  barInst.setOption({
    backgroundColor:'transparent',tooltip:{trigger:'axis',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:13},formatter:p=>`${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次`},
    grid:{left:'4%',right:'18%',top:'8%',bottom:'8%',containLabel:true},
    xAxis:{type:'value',axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:'#111820'}},axisLabel:{color:'#8892a4',fontSize:11}},
    yAxis:{type:'category',data:top10.map(i=>i.name).reverse(),inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#c9cdd4',fontSize:13,fontWeight:600}},
    series:[{type:'bar',data:top10.map(i=>i.value).reverse(),itemStyle:{borderRadius:[0,6,6,0],color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#c9a84c'},{offset:1,color:'#3b5e7a'}])},barWidth:'55%',label:{show:true,position:'right',color:'#c9cdd4',fontSize:12,fontWeight:700}}],
  });

  // 省份下钻
  const geoCache = {};
  async function drillDown(code) {
    const mk = 'ana_city_' + code;
    try {
      if (!echarts.getMap(mk)) {
        const r = await fetch(`/api/geojson?code=${code}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        echarts.registerMap(mk, await r.json());
      }
      if (mapInst) mapInst.dispose();
      mapInst = echarts.init(el);
      mapInst.setOption({
        backgroundColor:'transparent',
        tooltip:{ trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>`<strong style="color:#8B6914">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value||0}</span> 次`},
        visualMap:{ min:0,max:maxVal,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
        geo:{ map:mk,zoom:2.5,roam:true,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:0.8}},
        series:[{ name:'访问',type:'map',map:mk,geoIndex:0,data:data.map(p=>({name:p.name,value:p.value})) }],
      });
    } catch(e) { console.warn('下钻失败:', e); }
  }
}

function onResize(){ if(mapInst)mapInst.resize(); if(barInst)barInst.resize(); }

onMounted(async () => {
  await loadGeo();
  await load();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if(mapInst)mapInst.dispose(); if(barInst)barInst.dispose();
  chartInstances.forEach(ci=>ci.destroy());
});
</script>

<style scoped>
.map-box{width:100%;height:580px}.bar-box{width:100%;height:420px}.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
</style>
