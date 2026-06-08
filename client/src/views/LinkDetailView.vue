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
      <div class="stat-card accent"><div class="stat-value">{{ link.visitCount||0 }}</div><div class="stat-label">总访问</div></div>
      <div class="stat-card green"><div class="stat-value">{{ cities.length }}</div><div class="stat-label">覆盖城市</div></div>
      <div class="stat-card blue"><div class="stat-value">{{ uniqueIps }}</div><div class="stat-label">独立IP</div></div>
      <div class="stat-card red"><div class="stat-value">{{ topCity }}</div><div class="stat-label">TOP1 城市</div></div>
    </div>

    <!-- 地图 -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">城市热力分布
        <span v-if="drillProv" style="color:var(--accent);font-weight:400"> — {{ drillProv }}</span>
        <button v-if="drillCode" class="btn btn-outline btn-sm" style="margin-left:12px" @click="backUp">{{ drillCode.length >= 4 ? '返回省份' : '返回全国' }}</button>
      </div>
      <div ref="mapDom" class="map-box"></div>
    </div>

    <!-- 柱状图 + 饼图 -->
    <div class="charts-row">
      <div class="card">
        <div class="card-title">城市 TOP10</div>
        <div ref="barDom" class="bar-box"></div>
      </div>
      <div class="card">
        <div class="card-title">平台分布</div>
        <canvas id="link-platforms" class="pie-box"></canvas>
      </div>
    </div>
    <div class="charts-row" style="margin-top:14px">
      <div class="card">
        <div class="card-title">浏览器分布</div>
        <canvas id="link-browsers" class="pie-box"></canvas>
      </div>
      <div class="card">
        <div class="card-title">省份分布</div>
        <canvas id="link-regions" class="pie-box"></canvas>
      </div>
    </div>

    <!-- 访问明细 -->
    <div class="card" style="margin-top:18px">
      <div class="card-title">访问明细</div>
      <div class="table-wrap" v-if="records.length">
        <table><thead><tr><th>IP</th><th>省份/城市</th><th>运营商</th><th>设备</th><th>浏览器</th><th>时间</th></tr></thead>
        <tbody><tr v-for="r in records" :key="r._id"><td class="mono">{{esc(r.ip)}}</td><td>{{loc(r)}}</td><td>{{esc(r.geoInfo?.isp)}}</td><td>{{platform(r.userAgent)}}</td><td>{{browser(r.userAgent)}}</td><td>{{fmt(r.createdAt)}}</td></tr></tbody></table>
      </div>
      <div v-else class="empty"><p>暂无访问记录</p></div>
      <div class="pagination" v-if="totalPages>1">
        <button :disabled="page<=1" @click="fetchVisits(page-1)">上一页</button><span class="page-info">{{page}}/{{totalPages}}</span><button :disabled="page>=totalPages" @click="fetchVisits(page+1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import * as echarts from 'echarts';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../api/index.js';
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const route = useRoute();
const link = ref({});
const cities = ref([]);
const allVisits = ref([]);
const records = ref([]);
const page = ref(1), totalPages = ref(1);
const mapDom = ref(null), barDom = ref(null);
const drillCode = ref(''), drillProv = ref('');
const PM={'11000000':'北京市','12000000':'天津市','13000000':'河北省','14000000':'山西省','15000000':'内蒙古','21000000':'辽宁省','22000000':'吉林省','23000000':'黑龙江省','31000000':'上海市','32000000':'江苏省','33000000':'浙江省','34000000':'安徽省','35000000':'福建省','36000000':'江西省','37000000':'山东省','41000000':'河南省','42000000':'湖北省','43000000':'湖南省','44000000':'广东省','45000000':'广西','46000000':'海南省','50000000':'重庆市','51000000':'四川省','52000000':'贵州省','53000000':'云南省','54000000':'西藏','61000000':'陕西省','62000000':'甘肃省','63000000':'青海省','64000000':'宁夏','65000000':'新疆','71000000':'台湾','81000000':'香港','82000000':'澳门'};
let mapInst = null, barInst = null, nationalGeo = null, geoCache = {};
const chartInstances = [];

const uniqueIps = computed(() => new Set(allVisits.value.map(r => r.ip)).size);
const topCity = computed(() => cities.value[0]?.name || '—');

function esc(s){return s?String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—'}
function fmt(d){if(!d)return'—';try{return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return d}}
function loc(r){return esc([r.geoInfo?.province,r.geoInfo?.city,r.geoInfo?.district].filter(Boolean).join(' '))}
function platform(ua){if(!ua)return'未知';if(ua.includes('iPhone')||ua.includes('iPad'))return'iOS';if(ua.includes('Android'))return'Android';if(ua.includes('Windows'))return'Windows';if(ua.includes('Macintosh')||ua.includes('Mac OS'))return'macOS';if(ua.includes('Linux'))return'Linux';return'其他'}
function browser(ua){if(!ua)return'未知';if(ua.includes('MicroMessenger'))return'微信';if(ua.includes('Edg/'))return'Edge';if(ua.includes('Chrome/')&&!ua.includes('Edg/'))return'Chrome';if(ua.includes('Safari/')&&!ua.includes('Chrome/'))return'Safari';if(ua.includes('Firefox/'))return'Firefox';return'其他'}

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

    // 拉全量访问记录做分布统计
    const allRes = await api.get(`/api/v1/links/${id}/visits?page=1&pageSize=${link.value.visitCount||100}`);
    allVisits.value = allRes.data.list || [];

    await nextTick();
    drawCharts();
    drawPies();
  } catch(e){ console.warn(e); }
}

async function fetchVisits(p){
  page.value=p;
  try{const r=await api.get(`/api/v1/links/${route.params.id}/visits?page=${p}&pageSize=15`);records.value=r.data.list;totalPages.value=r.data.totalPages}catch{}
}

function drawCharts(){
  const el=mapDom.value,be=barDom.value;
  if(!el||!be||!cities.value.length)return;
  if(mapInst)mapInst.dispose();if(barInst)barInst.dispose();
  const gSet=new Set(nationalGeo.features.map(f=>f.properties.name));
  const m=n=>gSet.has(n)?n:gSet.has(n+'市')?n+'市':gSet.has(n+'区')?n+'区':gSet.has(n+'县')?n+'县':n;
  const md=cities.value.map(p=>({name:m(p.name),value:p.value}));
  const mx=Math.max(...cities.value.map(p=>p.value),1);

  mapInst=echarts.init(el);
  mapInst.setOption({
    backgroundColor:'transparent',
    tooltip:{trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>`<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`},
    visualMap:{min:0,max:mx,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
    geo:{map:'link_map',zoom:1.15,center:[104.5,36],roam:true,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:0.5}},
    series:[{name:'访问',type:'map',map:'link_map',geoIndex:0,data:md}],
  });

  // 点击下钻
  const curLevel = () => !drillCode.value ? 'nation' : drillCode.value.length >= 4 ? 'city' : 'prov';
  mapInst.off('click');
  mapInst.on('click', p => {
    if (!p.name) return;
    const lv = curLevel();

    if (lv === 'nation') {
      // 全国 → 省：从 nationalGeo 找城市 id
      const f = nationalGeo?.features.find(fe => fe.properties.name === p.name);
      if (f?.id) drillDown(String(f.id).substring(0, 2), 'prov');
    } else if (lv === 'prov') {
      // 省 → 市/区县：从 nationalGeo 按名称反查 adcode
      const sn = p.name.replace(/市$/, '');
      const f = nationalGeo?.features.find(fe =>
        fe.properties.name === p.name || fe.properties.name === sn
      );
      if (f?.id) drillDown(String(f.id), 'city');
    }
    // city 级不再下钻
  });

  const top10=[...cities.value].sort((a,b)=>b.value-a.value).slice(0,10);
  barInst=echarts.init(be);
  barInst.setOption({
    backgroundColor:'transparent',tooltip:{trigger:'axis',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:13},formatter:p=>`${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次`},
    grid:{left:'4%',right:'18%',top:'8%',bottom:'8%',containLabel:true},
    xAxis:{type:'value',axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:'#111820'}},axisLabel:{color:'#8892a4',fontSize:11}},
    yAxis:{type:'category',data:top10.map(i=>i.name).reverse(),inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#c9cdd4',fontSize:13,fontWeight:600}},
    series:[{type:'bar',data:top10.map(i=>i.value).reverse(),itemStyle:{borderRadius:[0,6,6,0],color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#c9a84c'},{offset:1,color:'#3b5e7a'}])},barWidth:'55%',label:{show:true,position:'right',color:'#c9cdd4',fontSize:12,fontWeight:700}}],
  });
}

async function drillDown(code, level){
  let url, mk, zoom;
  if (level === 'prov') {
    url = `/api/geojson?code=${code}0000`; mk = 'lp_' + code; zoom = 2.5;
  } else {
    url = `/api/geojson?code=${code}`; mk = 'lc_' + code; zoom = 4;
  }
  try{
    if(!geoCache[mk]){const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);geoCache[mk]=await r.json()}
    echarts.registerMap(mk,geoCache[mk]);
    drillCode.value=code;
    const provName=level==='prov'?(PM[code+'000000']||code):(geoCache[mk].features[0]?.properties?.name||code);
    drillProv.value=provName;
    if(mapInst)mapInst.dispose();
    const el=mapDom.value;if(!el)return;
    const mx=Math.max(...cities.value.map(p=>p.value),1);
    const gSet=new Set(geoCache[mk].features.map(f=>f.properties.name));
    const m=n=>gSet.has(n)?n:gSet.has(n+'市')?n+'市':gSet.has(n+'区')?n+'区':gSet.has(n+'县')?n+'县':n;
    mapInst=echarts.init(el);
    mapInst.setOption({
      backgroundColor:'transparent',
      tooltip:{trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>`<strong style="color:#8B6914;">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value||0}</span> 次`},
      visualMap:{min:0,max:mx,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
      geo:{map:mk,zoom,roam:true,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:0.8}},
      series:[{name:'访问',type:'map',map:mk,geoIndex:0,data:cities.value.map(p=>({name:m(p.name),value:p.value}))}],
    });
  }catch(e){console.warn(e)}
}

function backUp(){
  if (!drillCode.value) return;
  if (drillCode.value.length >= 4) {
    // 从城市区县回省份
    const prov = drillCode.value.substring(0, 2);
    drillCode.value = ''; drillProv.value = '';
    drillDown(prov, 'prov');
  } else {
    // 从省份回全国
    drillCode.value = ''; drillProv.value = ''; drawCharts();
  }
}

function drawPies(){
  chartInstances.forEach(ci=>ci.destroy());chartInstances.length=0;
  const data=allVisits.value;
  if(!data.length)return;

  function agg(getField){const m={};data.forEach(d=>{const v=getField(d)||'未知';m[v]=(m[v]||0)+1});const t=Object.values(m).reduce((s,v)=>s+v,0)||1;return Object.entries(m).map(([n,c])=>({name:n,pct:Math.round(c/t*100)})).sort((a,b)=>b.pct-a.pct)}
  const colors=['#C9A84C','#1A1A2E','#8B7355','#D4C5C0','#E8D5C4','#8B6914','#A89070'];

  [{id:'link-platforms',title:'平台',data:agg(d=>platform(d.userAgent))},
   {id:'link-browsers',title:'浏览器',data:agg(d=>browser(d.userAgent))},
   {id:'link-regions',title:'省份',data:agg(d=>d.geoInfo?.province)}].forEach(c=>{
    const cv=document.getElementById(c.id);if(!cv)return;
    chartInstances.push(new Chart(cv,{
      type:'doughnut',
      data:{labels:c.data.map(i=>i.name),datasets:[{data:c.data.map(i=>i.pct),backgroundColor:c.data.map((_,i)=>colors[i%colors.length]),borderColor:'rgba(8,10,15,0.8)',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{color:'#8892a4',padding:16,font:{size:11},usePointStyle:true}}}},
    }));
  });
}

function onResize(){if(mapInst)mapInst.resize();if(barInst)barInst.resize()}
onMounted(async()=>{await load();window.addEventListener('resize',onResize)});
onUnmounted(()=>{window.removeEventListener('resize',onResize);if(mapInst)mapInst.dispose();if(barInst)barInst.dispose();chartInstances.forEach(ci=>ci.destroy())});
</script>

<style scoped>
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.map-box{width:100%;height:500px}
.bar-box{width:100%;height:420px}
.pie-box{max-height:240px}
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr)}.charts-row{grid-template-columns:1fr}.map-box{height:340px}.bar-box{height:280px}.pie-box{max-height:200px}}
</style>
