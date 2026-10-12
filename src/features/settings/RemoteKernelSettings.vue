<script setup>
import { computed, inject, ref } from 'vue';
import { AppButton, AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Use a remote Precise kernel (experimental)',
    'Translates pages with a zotero-pdf2zh compatible server over HTTP when its health check passes, and with the local kernel otherwise. The server uses its own translation service and credentials; no API key is sent. Pages are uploaded as one-page PDFs and, because the server returns only the PDF, have no reading text layer. Glossaries and native services always use the local kernel.',
    'Server URL',
    'Translation service on the server (optional)',
    'Check connection',
    'Connected',
    'Unavailable',
    'Enter a valid http:// or https:// URL.',
  ],
  'zh-CN': [
    '使用远程精确内核（实验性）',
    '健康检查通过时，通过 HTTP 使用兼容 zotero-pdf2zh 的服务器翻译页面，否则使用本地内核。服务器使用自己的翻译服务和凭据，不会发送任何 API 密钥。页面以单页 PDF 上传；服务器只返回 PDF，因此没有阅读文本层。术语表和原生服务始终使用本地内核。',
    '服务器地址',
    '服务器上的翻译服务（可选）',
    '检查连接',
    '已连接',
    '不可用',
    '请输入有效的 http:// 或 https:// 地址。',
  ],
  'zh-TW': [
    '使用遠端精確核心（實驗性）',
    '健康檢查通過時，透過 HTTP 使用相容 zotero-pdf2zh 的伺服器翻譯頁面，否則使用本機核心。伺服器使用自己的翻譯服務與憑證，不會傳送任何 API 金鑰。頁面以單頁 PDF 上傳；伺服器只回傳 PDF，因此沒有閱讀文字層。詞彙表與原生服務一律使用本機核心。',
    '伺服器位址',
    '伺服器上的翻譯服務（選填）',
    '檢查連線',
    '已連線',
    '無法使用',
    '請輸入有效的 http:// 或 https:// 位址。',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
const checking = ref(false);
const result = ref('');

async function check() {
  checking.value = true;
  result.value = '';
  try {
    const response = await fetch('/api/remote-kernel/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: preferences.remoteKernelUrl.value.trim() }),
    });
    if (response.status === 400) result.value = text.value[7];
    else {
      const body = await response.json();
      result.value = body.ok
        ? `${text.value[5]}${body.version ? ` (${body.version})` : ''}`
        : `${text.value[6]}${body.reason ? `: ${body.reason}` : ''}`;
    }
  } catch {
    result.value = text.value[6];
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div v-if="preferences" class="remote-kernel-settings" data-setting="remote-kernel">
    <div class="setting-row">
      <span id="remote-kernel-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.remoteKernelEnabled.value"
        aria-labelledby="remote-kernel-label"
        aria-describedby="remote-kernel-help"
      />
    </div>
    <p id="remote-kernel-help" class="muted">{{ text[1] }}</p>
    <template v-if="preferences.remoteKernelEnabled.value">
      <label for="remote-kernel-url">{{ text[2] }}</label>
      <input
        id="remote-kernel-url"
        v-model="preferences.remoteKernelUrl.value"
        type="url"
        placeholder="http://127.0.0.1:8890"
        autocomplete="off"
        spellcheck="false"
        maxlength="2048"
      />
      <label for="remote-kernel-service">{{ text[3] }}</label>
      <input
        id="remote-kernel-service"
        v-model="preferences.remoteKernelService.value"
        type="text"
        placeholder="siliconflowfree"
        autocomplete="off"
        spellcheck="false"
        maxlength="100"
      />
      <div class="remote-kernel-check">
        <AppButton
          :disabled="checking || !preferences.remoteKernelUrl.value.trim()"
          @click="check"
          >{{ text[4] }}</AppButton
        >
        <span v-if="result" class="muted" role="status">{{ result }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.remote-kernel-settings {
  display: grid;
  gap: 8px;
}
.remote-kernel-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
input {
  display: block;
  width: 100%;
  box-sizing: border-box;
}
.remote-kernel-check {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
