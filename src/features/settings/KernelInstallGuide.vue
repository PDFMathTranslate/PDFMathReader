<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { uiLanguage } from '../../i18n/index.mjs';
import { AppButton } from '../../ui/controls.mjs';
const props = defineProps({ engine: String, request: Function, disabled: Boolean });
const emit = defineEmits(['ready', 'busy']);
const busy = ref(false),
  failure = ref(''),
  failedStep = ref(-1),
  ready = ref(false);
const states = ref(['pending', 'pending', 'pending', 'pending']);
const chinese = computed(() => /^zh/.test(uiLanguage.value));
const copy = computed(() =>
  chinese.value
    ? {
        title: '安装引导',
        intro: '无需输入命令。按下开始，我们会检测环境并安装缺少的组件。',
        steps: ['检测运行环境', '准备 uv 安装工具', '安装所选翻译内核', '验证内核可以启动'],
        descriptions: [
          '检查本机已有的安装。',
          'uv 用来下载 Python 和内核依赖；已有安装会自动跳过。',
          '首次安装需要联网下载，可能需要几分钟，请保持应用打开。',
          '完成后可在翻译服务中配置服务，再打开 PDF 阅读。',
        ],
        start: '开始安装',
        retry: '重试当前步骤',
        running: '正在处理，请稍候…',
        done: '安装完成，可以使用了',
        pending: '待处理',
        working: '进行中',
        complete: '已完成',
        failed: '失败',
        help: '查看 uv 安装帮助',
        network: '请检查网络连接、磁盘空间和目录写入权限后重试。已完成的步骤不会重复安装。',
      }
    : {
        title: 'Installation guide',
        intro: 'No commands needed. Check your environment and install missing components.',
        steps: ['Check environment', 'Prepare uv', 'Install selected kernel', 'Verify the kernel'],
        descriptions: [
          'Detect existing installations.',
          'uv downloads Python and dependencies. Existing installations are reused.',
          'Downloads may take several minutes. Keep the app open.',
          'Configure a translation service, then open a PDF.',
        ],
        start: 'Start installation',
        retry: 'Retry this step',
        running: 'Working…',
        done: 'Ready to use',
        pending: 'Pending',
        working: 'In progress',
        complete: 'Complete',
        failed: 'Failed',
        help: 'uv installation help',
        network:
          'Check your connection, disk space and write permissions, then retry. Completed installations are reused.',
      },
);
async function detect() {
  const startup = await props.request('/api/engines');
  const kernel = startup.engines.find((item) => item.id === props.engine);
  states.value[0] = 'complete';
  states.value[1] = startup.uv?.available ? 'complete' : 'pending';
  states.value[2] = kernel?.available ? 'complete' : 'pending';
  states.value[3] = kernel?.available ? 'complete' : 'pending';
  ready.value = !!kernel?.available;
  return { uv: startup.uv, kernel };
}
async function start() {
  if (busy.value || props.disabled) return;
  busy.value = true;
  emit('busy', true);
  failure.value = '';
  failedStep.value = -1;
  let step = 0;
  try {
    states.value[0] = 'working';
    const detected = await detect();
    if (!detected.uv?.available) {
      step = 1;
      states.value[1] = 'working';
      await props.request('/api/runtime/uv/install', { method: 'POST' });
      states.value[1] = 'complete';
    }
    if (!detected.kernel?.available) {
      step = 2;
      states.value[2] = 'working';
      await props.request(`/api/engines/${props.engine}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'release' }),
      });
      states.value[2] = 'complete';
    }
    step = 3;
    states.value[3] = 'working';
    const verified = await detect();
    if (!verified.kernel?.available)
      throw Error(verified.kernel?.reason || 'Kernel verification failed');
    states.value[3] = 'complete';
    ready.value = true;
    emit('ready');
  } catch (error) {
    ready.value = false;
    failedStep.value = step;
    states.value[step] = 'failed';
    failure.value = error.message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
async function inspect() {
  if (busy.value) return;
  states.value = ['working', 'pending', 'pending', 'pending'];
  failure.value = '';
  ready.value = false;
  try {
    await detect();
  } catch (error) {
    states.value[0] = 'failed';
    failedStep.value = 0;
    failure.value = error.message;
  }
}
onMounted(inspect);
watch(() => props.engine, inspect);
</script>
<template>
  <section
    v-if="!ready || busy || failure"
    class="kernel-install-guide"
    :aria-label="copy.title"
    :aria-busy="busy"
  >
    <h4>{{ copy.title }}</h4>
    <p>{{ copy.intro }}</p>
    <ol>
      <li v-for="(label, index) in copy.steps" :key="index" :data-state="states[index]">
        <span class="install-step-number" aria-hidden="true">{{
          states[index] === 'complete' ? '✓' : index + 1
        }}</span>
        <div>
          <strong>{{ label }}</strong>
          <p>{{ copy.descriptions[index] }}</p>
        </div>
        <span class="install-step-state">{{ copy[states[index]] }}</span>
      </li>
    </ol>
    <div v-if="failure" class="install-error" role="alert">
      <p>{{ failure }}</p>
      <p>{{ copy.network }}</p>
      <a
        v-if="failedStep <= 1"
        href="https://docs.astral.sh/uv/getting-started/installation/"
        target="_blank"
        rel="noopener noreferrer"
        >{{ copy.help }} ↗</a
      >
    </div>
    <p v-if="ready" class="install-ready" role="status">{{ copy.done }}</p>
    <AppButton v-else variant="prominent" size="large" :disabled="busy || disabled" @click="start">
      {{ busy ? copy.running : failure ? copy.retry : copy.start }}
    </AppButton>
  </section>
</template>
<style scoped>
.kernel-install-guide {
  padding: 20px;
  color: var(--text, #1d1d1f);
  background: var(--chrome-raised, #fff);
  border: 1px solid var(--chrome-divider, #00000014);
  border-radius: 20px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
h4 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.2px;
}
p {
  margin: 5px 0 0;
  color: var(--text-secondary, #68686d);
  line-height: 1.5;
  font-size: 12px;
}
ol {
  list-style: none;
  margin: 18px 0;
  padding: 0;
}
li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
}
li + li {
  border-top: 1px solid var(--chrome-divider, #00000014);
}
li > div {
  flex: 1;
  min-width: 0;
}
strong {
  font-weight: 550;
  font-size: 13px;
}
.install-step-number {
  border-radius: 50%;
  background: var(--chrome-hover, #00000008);
  color: var(--text-secondary, #68686d);
  width: 28px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
[data-state='complete'] .install-step-number {
  color: var(--success, #248a3d);
  background: color-mix(in srgb, var(--success, #248a3d) 10%, transparent);
}
[data-state='working'] .install-step-number {
  color: var(--accent, #007aff);
  background: var(--accent-soft, #007aff15);
  outline: 2px solid var(--accent-soft, #007aff15);
  outline-offset: 2px;
}
[data-state='failed'] .install-step-number {
  color: var(--danger, #d92d20);
  background: var(--danger-soft, #d92d201a);
}
.install-step-state {
  padding-top: 2px;
  font-size: 11px;
  color: var(--text-tertiary, #8c8c91);
  white-space: nowrap;
}
[data-state='working'] .install-step-state {
  color: var(--accent, #007aff);
}
[data-state='failed'] .install-step-state {
  color: var(--danger, #d92d20);
}
.install-error {
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--danger-soft, #d92d201a);
  overflow-wrap: anywhere;
}
.install-error p:first-child {
  margin-top: 0;
  color: var(--danger, #d92d20);
}
.install-ready {
  color: var(--success, #248a3d);
  font-weight: 550;
}
a {
  display: inline-block;
  margin-top: 8px;
  color: var(--accent, #007aff);
}
a:focus-visible {
  outline: 2px solid var(--accent, #007aff);
  outline-offset: 3px;
}
@media (max-width: 420px) {
  .kernel-install-guide {
    padding: 16px;
  }
  li {
    flex-wrap: wrap;
  }
  .install-step-state {
    width: 100%;
    padding-left: 40px;
  }
}
</style>
