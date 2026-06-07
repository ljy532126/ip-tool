<template>
  <div class="welcome">
    <h1>IP TRACK</h1>
    <p>生成加密跳转链接，追踪每一次访问的 IP、位置、设备信息。数据可视化分析，精确掌握流量来源。</p>
    <div class="actions">
      <router-link class="btn btn-primary" to="/login">登录</router-link>
      <router-link class="btn btn-outline" to="/register">注册</router-link>
    </div>
    <p style="margin-top:32px;font-size:13px;color:var(--muted)">
      <router-link to="/docs">查看 API 文档</router-link> — 6 组接口 · 复制即可用
    </p>
  </div>
</template>
