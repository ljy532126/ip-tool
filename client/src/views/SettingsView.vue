<template>
  <div>
    <div class="section-head"><h2>系统设置</h2></div>

    <div class="card">
      <div class="card-title">uapis.cn API 配置</div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:16px">
        用于 IP 归属地查询。免费额度无需 Key，商业版填入 Key 获得更完整数据。
      </p>

      <div class="field">
        <label>API Key（付费账号）</label>
        <div class="input-row">
          <input v-model="apiKey" placeholder="留空使用免费版本" />
        </div>
        <div class="hint">填入后请求会带 <code>Authorization: Bearer YOUR_KEY</code></div>
      </div>

      <div class="field">
        <label>API Key（免费账号）</label>
        <div class="input-row">
          <input v-model="apiKeyFree" placeholder="免费 api key" />
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存设置' }}</button>
        <button class="btn btn-outline" :disabled="testing" @click="testKey">
          {{ testing ? '测试中...' : '测试连通性' }}
        </button>
      </div>

      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'success' : 'fail'">
        <strong>{{ testResult.ok ? '成功' : '失败' }}</strong>
        <span v-if="testResult.ok">
          — {{ testResult.elapsed }} {{ testResult.sample ? '| ' + testResult.sample.region + ' · ' + testResult.sample.isp : '' }}
        </span>
        <span v-else>— {{ testResult.msg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/index.js';
import { useToast } from '../stores/toast.js';

const { add: toast } = useToast();
const apiKey = ref('');
const apiKeyFree = ref('');
const saving = ref(false);
const testing = ref(false);
const testResult = ref(null);

async function load() {
  try {
    const res = await api.get('/api/v1/admin/settings');
    apiKey.value = res.data.uapisApiKey || '';
    apiKeyFree.value = res.data.uapisApiKeyFree || '';
  } catch {}
}

async function save() {
  saving.value = true;
  try {
    await api.put('/api/v1/admin/settings', {
      uapisApiKey: apiKey.value,
      uapisApiKeyFree: apiKeyFree.value,
    });
    toast('保存成功');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    saving.value = false;
  }
}

async function testKey() {
  const key = apiKey.value.trim() || apiKeyFree.value.trim();
  if (!key) return toast('请先填入 API Key', 'error');

  testing.value = true;
  testResult.value = null;
  try {
    const res = await api.post('/api/v1/admin/test-api', { key });
    testResult.value = {
      ok: true,
      elapsed: res.data.elapsed,
      sample: res.data.sample,
    };
  } catch (e) {
    testResult.value = { ok: false, msg: e.message };
  } finally {
    testing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.input-row { display: flex; gap: 8px; }
.input-row input { flex: 1; height: 42px; padding: 0 14px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); color: var(--heading); font-size: 14px; font-family: var(--font-ui); }
.input-row input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
.hint code { background: var(--surface2); padding: 1px 6px; border-radius: 3px; font-family: var(--font-data); font-size: 11px; }
.btn-row { display: flex; gap: 10px; margin-top: 6px; }
.test-result { margin-top: 14px; padding: 12px 16px; border-radius: var(--radius); font-size: 13px; }
.test-result.success { background: var(--green-dim); color: var(--green); }
.test-result.fail { background: var(--red-dim); color: var(--red); }
</style>
