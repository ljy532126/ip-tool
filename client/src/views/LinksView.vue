<template>
  <div>
    <div class="section-head"><h2>链接管理</h2></div>
    <div class="card">
      <div class="card-title">+ 创建新链接</div>
      <div class="inline-form">
        <input v-model="newUrl" placeholder="输入目标网址，如 example.com/promo" @keyup.enter="create" />
        <button class="btn btn-primary" :disabled="creating" @click="create">{{ creating ? '生成中...' : '生成链接' }}</button>
      </div>
      <div v-if="createdUrl" class="url-display">{{ createdUrl }} <button @click="cp(createdUrl)">复制</button></div>
    </div>

    <div class="card">
      <div class="card-title">链接列表 <span style="font-weight:400;color:var(--muted);font-size:12px">共 {{ total }} 条</span></div>
      <div class="table-wrap" v-if="list.length">
        <table><thead><tr><th>短链 Key</th><th>目标 URL</th><th>访问量</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody><tr v-for="l in list" :key="l._id">
          <td class="mono">{{ esc(l.key) }}</td><td class="url-cell">{{ esc(l.targetUrl) }}</td><td><span class="tag tag-green">{{ l.visitCount }}</span></td><td>{{ fmt(l.createdAt) }}</td>
          <td class="td-actions">
            <button class="btn btn-outline btn-sm" @click="cp(loc(l.key))">复制</button>
            <button class="btn btn-outline btn-sm" @click="openMap(l)">分布</button>
            <button class="btn btn-outline btn-sm" @click="openVisits(l)">详情</button>
            <button class="btn btn-danger btn-sm" @click="del(l._id)">删除</button>
          </td>
        </tr></tbody></table>
      </div>
      <div v-else class="empty"><p>还没有链接，创建一个吧</p></div>
      <div class="pagination" v-if="totalPages>1">
        <button :disabled="page<=1" @click="fetch(page-1)">上一页</button><span class="page-info">{{page}}/{{totalPages}}</span><button :disabled="page>=totalPages" @click="fetch(page+1)">下一页</button>
      </div>
    </div>

    <!-- 访问明细弹窗 -->
    <div class="modal-mask" v-if="modal" @click.self="modal=false">
      <div class="modal-box"><div class="modal-hd"><h2>访问明细 · {{modalKey}}</h2><button class="modal-x" @click="modal=false">&times;</button></div>
      <div class="modal-bd">
        <div class="table-wrap" v-if="visits.length"><table><thead><tr><th>IP</th><th>国家</th><th>省份</th><th>城市</th><th>运营商</th><th>时间</th></tr></thead>
        <tbody><tr v-for="v in visits" :key="v._id"><td class="mono">{{esc(v.ip)}}</td><td>{{esc(v.geoInfo?.country)}}</td><td>{{esc(v.geoInfo?.province)}}</td><td>{{esc(v.geoInfo?.city)}}</td><td>{{esc(v.geoInfo?.isp)}}</td><td>{{fmt(v.createdAt)}}</td></tr></tbody></table></div>
        <div v-else class="empty"><p>暂无访问记录</p></div>
        <div class="pagination" v-if="vTotalPages>1" style="margin-top:12px"><button :disabled="vPage<=1" @click="loadVisits(vPage-1)">上一页</button><span class="page-info">{{vPage}}/{{vTotalPages}}</span><button :disabled="vPage>=vTotalPages" @click="loadVisits(vPage+1)">下一页</button></div>
      </div></div>
    </div>

    <!-- 单链接热力分布弹窗 -->
    <div class="modal-mask" v-if="mapModal" @click.self="mapModal=false">
      <div class="modal-box" style="max-width:860px">
        <div class="modal-hd"><h2>热力分布 · {{mapKey}}</h2><button class="modal-x" @click="mapModal=false">&times;</button></div>
        <div class="modal-bd">
          <div ref="linkMapDom" class="link-map-box"></div>
          <div v-if="mapCities.length" class="link-cities">
            <table><thead><tr><th>#</th><th>城市</th><th>次数</th><th>占比</th></tr></thead>
            <tbody><tr v-for="(c,i) in mapCities" :key="c.name"><td>{{i+1}}</td><td>{{esc(c.name)}}</td><td><span class="tag tag-accent">{{c.value}}</span></td><td>{{c.pct}}%</td></tr></tbody></table>
          </div>
          <div v-else class="empty"><p>暂无访问记录</p></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import api from '../api/index.js';
import { useToast } from '../stores/toast.js';

const { add: toast } = useToast();
const newUrl=ref(''),createdUrl=ref(''),creating=ref(false);
const list=ref([]),page=ref(1),total=ref(0),totalPages=ref(1);
const modal=ref(false),modalKey=ref(''),modalId=ref(''),visits=ref([]),vPage=ref(1),vTotalPages=ref(1);
const mapModal=ref(false),mapKey=ref(''),mapCities=ref([]),linkMapDom=ref(null);
let linkMapInst=null,nationalGeo=null;
function esc(s){return s?String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'):'—'}
function fmt(d){if(!d)return'—';try{return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return d}}
function cp(t){navigator.clipboard.writeText(t).then(()=>toast('已复制')).catch(()=>toast('复制失败','error'))}
function loc(k){return `${location.protocol}//${location.host}/r/${k}`}

async function fetch(p=1){page.value=p;try{const r=await api.get(`/api/v1/links?page=${p}&pageSize=15`);list.value=r.data.list;total.value=r.data.total;totalPages.value=r.data.totalPages}catch{}}
async function create(){const u=newUrl.value.trim();if(!u)return toast('请输入URL','error');creating.value=true;try{const r=await api.post('/api/v1/links',{targetUrl:u});createdUrl.value=r.data.redirectUrl;newUrl.value='';toast('链接已生成');fetch(page.value)}catch(e){toast(e.message,'error')}finally{creating.value=false}}
async function del(id){if(!confirm('确定删除？不可恢复。'))return;try{await api.del(`/api/v1/links/${id}`);toast('已删除');fetch(page.value)}catch(e){toast(e.message,'error')}}
async function openVisits(l){modal.value=true;modalKey.value=l.key;modalId.value=l._id;await loadVisits(1)}
async function loadVisits(p=vPage.value){vPage.value=p;try{const r=await api.get(`/api/v1/links/${modalId.value}/visits?page=${p}&pageSize=15`);visits.value=r.data.list;vTotalPages.value=r.data.totalPages}catch{}}

async function openMap(l){
  mapModal.value=true;mapKey.value=l.key;
  mapCities.value=[];
  try{
    if(!nationalGeo){const r=await fetch('/china_cities.json');nationalGeo=await r.json();echarts.registerMap('china_link',nationalGeo)}
    const r=await api.get(`/api/v1/links/${l._id}/regions`);
    mapCities.value=r.data.cities||[];
    await nextTick();
    if(linkMapInst)linkMapInst.dispose();
    const el=linkMapDom.value;if(!el)return;
    const gSet=new Set(nationalGeo.features.map(f=>f.properties.name));
    const m=n=>gSet.has(n)?n:gSet.has(n+'市')?n+'市':gSet.has(n+'区')?n+'区':gSet.has(n+'县')?n+'县':n;
    const mapData=mapCities.value.map(p=>({name:m(p.name),value:p.value}));
    const mx=Math.max(...mapCities.value.map(p=>p.value),1);
    linkMapInst=echarts.init(el);
    linkMapInst.setOption({
      backgroundColor:'transparent',
      tooltip:{trigger:'item',backgroundColor:'rgba(8,10,15,0.95)',borderColor:'#d4a853',textStyle:{color:'#8B6914',fontSize:14},formatter:p=>`<strong style="color:#8B6914;font-size:16px">${p.name}</strong><br/>访问：<span style="color:#8B6914;font-size:18px;font-weight:700">${p.value}</span> 次`},
      visualMap:{min:0,max:mx,left:10,bottom:20,text:['高','低'],calculable:true,textStyle:{color:'#c9cdd4',fontSize:13},inRange:{color:['#101520','#3b5e7a','#8B7355','#c9a84c','#e6a23c']}},
      geo:{map:'china_link',zoom:1.15,center:[104.5,36],roam:true,label:{show:false},emphasis:{label:{color:'#8B6914',fontSize:12,fontWeight:'bold',show:true},itemStyle:{areaColor:'#f5e6c8'}},itemStyle:{areaColor:'#0d1117',borderColor:'#2a3345',borderWidth:0.5}},
      series:[{name:'访问次数',type:'map',map:'china_link',geoIndex:0,data:mapData}],
    });
  }catch(e){console.warn(e)}
}

onMounted(()=>fetch());
</script>

<style scoped>
.link-map-box{width:100%;height:480px}
.link-cities{margin-top:16px}
.td-actions{display:flex;gap:4px;flex-wrap:wrap}
</style>
