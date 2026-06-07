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
      <div class="map-wrap">
        <div ref="mapDom" class="map-box"></div>
        <canvas ref="gCvs" class="glow-canvas"></canvas>
      </div>
      <div v-if="mapLoading" class="chart-loading">加载地图中...</div>
    </div>

    <div class="charts-row">
      <div class="card"><div class="card-title">城市 TOP10 排行</div><div ref="barDom" class="bar-box"></div></div>
      <div class="card">
        <div class="card-title">最近访问记录</div>
        <div class="table-wrap" v-if="records.length">
          <table><thead><tr><th>IP</th><th>省份/城市/区县</th><th>经纬度</th><th>运营商</th><th>时间</th></tr></thead>
          <tbody><tr v-for="r in records" :key="r.ip+r.createdAt"><td class="mono">{{esc(r.ip)}}</td><td>{{loc(r)}}</td><td class="mono">{{r.latitude?.toFixed(4)||'—'}},{{r.longitude?.toFixed(4)||'—'}}</td><td>{{esc(r.isp)}}</td><td>{{fmt(r.createdAt)}}</td></tr></tbody></table>
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

const overview=ref({}),regions=ref({}),records=ref([]),mapDom=ref(null),barDom=ref(null),mapLoading=ref(false),gCvs=ref(null);
const drillCode=ref(''),drillTitle=ref('全国城市 IP 访问热力分布');
let mapInst=null,barInst=null,nationalGeo=null,geoCache={};
let grAF=null,gData=[];

const cards=computed(()=>{const o=overview.value||{},r=regions.value||{};return[
  {value:o.totalVisits??'—',label:'总访问次数',sub:`近7日 ${o.weekVisits??0} 次`,cls:'accent'},
  {value:o.totalIps??'—',label:'独立 IP 数',sub:`今日 ${o.todayVisits??0} 次`,cls:'green'},
  {value:o.coveredCities??'—',label:'覆盖城市',sub:`境外 ${o.overseasCount??0} 次`,cls:'blue'},
  {value:r.topProvince?.pct!=null?r.topProvince.pct+'%':'—',label:'TOP1 占比',sub:r.topProvince?.name||'暂无',cls:'red'},
]});
function esc(s){return s?String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—'}
function fmt(d){if(!d)return'—';try{return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return d}}
function loc(r){return esc([r.province,r.city,r.district].filter(Boolean).join(' '))}
const PM={'11000000':'北京市','12000000':'天津市','13000000':'河北省','14000000':'山西省','15000000':'内蒙古','21000000':'辽宁省','22000000':'吉林省','23000000':'黑龙江省','31000000':'上海市','32000000':'江苏省','33000000':'浙江省','34000000':'安徽省','35000000':'福建省','36000000':'江西省','37000000':'山东省','41000000':'河南省','42000000':'湖北省','43000000':'湖南省','44000000':'广东省','45000000':'广西','46000000':'海南省','50000000':'重庆市','51000000':'四川省','52000000':'贵州省','53000000':'云南省','54000000':'西藏','61000000':'陕西省','62000000':'甘肃省','63000000':'青海省','64000000':'宁夏','65000000':'新疆','71000000':'台湾','81000000':'香港','82000000':'澳门'};

async function loadNational(){try{const r=await fetch('/china_cities.json');nationalGeo=await r.json();echarts.registerMap('china_city',nationalGeo)}catch(e){console.error(e)}}

async function drillTo(code){
  const len=code.length;let url,mapKey;const pp=code.substring(0,2);
  if(len===2){url=`/api/geojson?code=${code}0000`;mapKey='prov_'+code}
  else if(len>=4){url=`/api/geojson?code=${code}`;mapKey='city_'+code}
  else return;
  mapLoading.value=true;
  try{
    if(!geoCache[mapKey]){const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);geoCache[mapKey]=await r.json()}
    echarts.registerMap(mapKey,geoCache[mapKey]);drillCode.value=code;
    if(len===2){drillTitle.value=PM[code+'000000']||''}
    else{const pn=PM[pp+'000000']||'';const c=nationalGeo?.features.find(f=>String(f.id)===String(code));drillTitle.value=(pn?pn+' — ':'')+(c?.properties.name||'')}
    await nextTick();drawCharts(mapKey);
  }catch(e){console.error(e)}finally{mapLoading.value=false}
}

function backUp(){const c=drillCode.value;if(!c)return;if(c.length<=2){drillCode.value='';drillTitle.value='全国城市 IP 访问热力分布';drawCharts('china_city')}else drillTo(c.substring(0,2))}

function drawCharts(mapName){
  const el=mapDom.value,be=barDom.value;if(!el||!be)return;
  if(mapInst)mapInst.dispose();if(barInst)barInst.dispose();
  const isNation=!drillCode.value,isCity=drillCode.value&&drillCode.value.length>=4;
  // 城市钻入→区县级数据；全国/省→城市级数据
  const rawData=isCity?(regions.value?.districts||regions.value?.provinces||[]):(regions.value?.provinces||[]);
  if(!rawData.length)return;

  // GeoJSON 名称匹配（GeoJSON 可能带 市/区/县 后缀）
  const geo=isNation?nationalGeo:geoCache[mapName];
  const gSet=geo?new Set(geo.features.map(f=>f.properties.name)):new Set();
  const m=n=>gSet.has(n)?n:gSet.has(n+'市')?n+'市':gSet.has(n+'区')?n+'区':gSet.has(n+'县')?n+'县':n;
  const mapData=rawData.map(p=>({name:m(p.name),value:p.value}));

  const maxVal=Math.max(...rawData.map(p=>p.value),1);

  mapInst=echarts.init(el);
  mapInst.setOption({
    backgroundColor:'transparent',
    tooltip:{trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>{if(!p.value)return p.name;return`<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`}},
    visualMap:{min:0,max:maxVal,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
    geo:{map:mapName,zoom:isNation?1.15:2.5,roam:true,center:isNation?[104.5,36]:undefined,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:isNation?0.5:0.8}},
    series:[{name:'访问次数',type:'map',map:mapName,geoIndex:0,data:mapData}],
  });
  currentMapName = mapName;
  setTimeout(glowRefresh, 500);

  // 点击下钻
  const cGeo=isNation?nationalGeo:geoCache[mapName];
  const level=isNation?'nation':(drillCode.value.length<=2?'province':'city');
  mapInst.off('click');
  mapInst.on('click',p=>{if(!p.name||!cGeo)return;const f=cGeo.features.find(fe=>fe.properties.name===p.name);if(!f)return;if(level==='nation'){if(f.id)drillTo(String(f.id).substring(0,2))}else if(level==='province'){const cn=p.name.replace(/市$/,'');const cf=nationalGeo?.features.find(fe=>fe.properties.name===p.name||fe.properties.name===cn);if(cf?.id)drillTo(String(cf.id))}});

  // TOP10
  const top10=[...rawData].sort((a,b)=>b.value-a.value).slice(0,10);
  barInst=echarts.init(be);
  barInst.setOption({
    backgroundColor:'transparent',tooltip:{trigger:'axis',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:13},formatter:p=>`${p[0].name}<br/>访问：<strong>${p[0].value}</strong> 次`},
    grid:{left:'4%',right:'18%',top:'8%',bottom:'8%',containLabel:true},
    xAxis:{type:'value',axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:'#111820'}},axisLabel:{color:'#8892a4',fontSize:11}},
    yAxis:{type:'category',data:top10.map(i=>i.name).reverse(),inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#c9cdd4',fontSize:13,fontWeight:600}},
    series:[{type:'bar',data:top10.map(i=>i.value).reverse(),itemStyle:{borderRadius:[0,6,6,0],color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#c9a84c'},{offset:1,color:'#3b5e7a'}])},barWidth:'55%',label:{show:true,position:'right',color:'#c9cdd4',fontSize:12,fontWeight:700}}],
  });
}
function onResize(){if(mapInst)mapInst.resize();if(barInst)barInst.resize();glowRefresh()}

// ===== 粒子发光效果 =====
function glowRefresh() {
  if (!mapInst || !gCvs.value) return;
  const curMap = currentMapName || 'china_city';
  const isN = !drillCode.value;
  const geo = isN ? nationalGeo : geoCache[curMap];
  if (!geo) return;
  const raw = regions.value?.provinces || [];
  // 读 GeoJSON 里的中心坐标
  const pts = [];
  geo.features.forEach(f => {
    const cp = f.properties?.cp || f.properties?.center;
    if (!cp || cp.length < 2) return;
    const match = raw.find(p => {
      const nm = f.properties.name;
      return p.name === nm || p.name === nm.replace(/市|区|县$/,'') || nm === p.name+'市' || nm === p.name+'区' || nm === p.name+'县';
    });
    if (match) pts.push({ lon: cp[0], lat: cp[1], v: match.value });
  });
  gData = pts;
  if (!grAF) glowLoop();
}
let glowT = 0;
function glowLoop() {
  const cv = gCvs.value; if (!cv || !mapInst) return;
  const mapEl = mapDom.value; if (!mapEl) return;
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
      const px = mapInst.convertToPixel({geoIndex:0}, [d.lon, d.lat]);
      if (!px || isNaN(px[0])) return;
      const x = px[0], y = px[1];
      const ratio = d.v / maxV;
      const r = 8 + ratio * 42;  // 8~50 半径
      const breathe = 0.5 + 0.5 * Math.sin(glowT * 2.5 + d.lat * 0.3); // 呼吸
      const alpha = (0.15 + ratio * 0.35) * breathe;
      // 外圈辉光
      const grd = ctx.createRadialGradient(x, y, r*0.2, x, y, r);
      grd.addColorStop(0, `rgba(245,230,200,${alpha})`);
      grd.addColorStop(0.4, `rgba(212,168,83,${alpha*0.7})`);
      grd.addColorStop(0.8, 'rgba(212,168,83,0.02)');
      grd.addColorStop(1, 'rgba(212,168,83,0)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fillStyle = grd; ctx.fill();
      // 核心亮斑
      const cr = r * 0.15;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, cr);
      cg.addColorStop(0, `rgba(255,245,220,${alpha*1.2})`);
      cg.addColorStop(0.5, `rgba(245,230,200,${alpha*0.6})`);
      cg.addColorStop(1, 'rgba(212,168,83,0)');
      ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI*2);
      ctx.fillStyle = cg; ctx.fill();
    } catch {}
  });
  grAF = requestAnimationFrame(glowLoop);
}
function startGlow() { if (!grAF) { glowT = 0; glowLoop(); } }
function stopGlow() { if (grAF) { cancelAnimationFrame(grAF); grAF = null; } }
let currentMapName = 'china_city';

onMounted(async()=>{try{const[ov,reg]=await Promise.all([api.get('/api/v1/statistics/overview'),api.get('/api/v1/statistics/user-regions')]);overview.value=ov.data;regions.value=reg.data;records.value=(reg.data.recentRecords||[]).slice(0,10);await loadNational();await nextTick();currentMapName='china_city';drawCharts('china_city');setTimeout(glowRefresh, 600)}catch(e){console.error(e)}window.addEventListener('resize',onResize)});
onUnmounted(()=>{window.removeEventListener('resize',onResize);if(mapInst)mapInst.dispose();if(barInst)barInst.dispose();stopGlow()});
</script>

<style scoped>
.map-box{width:100%;height:580px}.bar-box{width:100%;height:420px}.chart-loading{text-align:center;padding:60px;color:var(--muted);font-size:14px}.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.map-wrap{position:relative}.glow-canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5}
</style>
