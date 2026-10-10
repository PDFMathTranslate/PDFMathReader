<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AppButton, AppPopUpButton, AppPopUpButtonItem } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { chatGPTSubscriptionLabel } from '../../i18n/chatgpt-subscription-labels.mjs';

const USAGE_URL = 'https://chatgpt.com/settings/usage';

const props = defineProps({
  accountOnly: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'auth-change', 'model-validity']);

const status = ref({ signedIn: false, pending: false, activeClientId: '', accounts: [] });
const statusBusy = ref(false);
const statusError = ref('');
const actionError = ref('');
const actionBusy = ref(false);
const signingIn = ref(false);
const cancelling = ref(false);
const models = ref([]);
const modelsBusy = ref(false);
const modelsLoaded = ref(false);
const modelsError = ref('');
let statusGeneration = 0;
let modelsGeneration = 0;
let stopChanged;
let cancelRequested = false;

const bridge = () => globalThis.window?.previewChatGPTSubscription;
const bridgeAvailable = computed(() => {
  const value = bridge();
  return !!value && typeof value.status === 'function';
});
const signedIn = computed(() => status.value.signedIn === true);
const authPending = computed(() => signingIn.value || status.value.pending === true);
const accounts = computed(() => status.value.accounts || []);
const selectedAccountId = computed(
  () => status.value.activeClientId || accounts.value[0]?.clientId || '',
);
const currentModelUnavailable = computed(() => {
  const model = String(props.modelValue || '').trim();
  return (
    !props.accountOnly &&
    signedIn.value &&
    modelsLoaded.value &&
    !!model &&
    !models.value.some((item) => item.slug === model)
  );
});
const modelValid = computed(() => {
  if (props.accountOnly) return true;
  if (
    !signedIn.value ||
    authPending.value ||
    modelsBusy.value ||
    !modelsLoaded.value ||
    modelsError.value
  )
    return false;
  const model = String(props.modelValue || '').trim();
  return !!model && models.value.some((item) => item.slug === model);
});

function label(key, params) {
  return chatGPTSubscriptionLabel(key, uiLanguage.value, params);
}
function errorText(error, fallback) {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error.message === 'string' && error.message.trim())
    return error.message.trim();
  return fallback;
}
function valueText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function normalizeStatus(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const activeClientId = valueText(source.activeClientId);
  const rawAccounts = Array.isArray(source.accounts) ? source.accounts : [];
  const seen = new Set();
  const normalizedAccounts = rawAccounts
    .map((account) => {
      if (!account || typeof account !== 'object') return null;
      return {
        clientId: valueText(account.clientId),
        email: valueText(account.email),
      };
    })
    .filter((account) => account?.clientId && !seen.has(account.clientId))
    .filter((account) => {
      seen.add(account.clientId);
      return true;
    });
  return {
    signedIn: source.signedIn === true,
    pending: source.pending === true,
    activeClientId,
    accounts: normalizedAccounts,
    error: errorText(source.error || source.message, ''),
  };
}
function clientSuffix(clientId) {
  const value = String(clientId || '');
  return value.length > 8 ? `…${value.slice(-8)}` : value;
}
function accountLabel(account) {
  const suffix = clientSuffix(account.clientId);
  return account.email ? `${account.email} · ${suffix}` : suffix || label('accountUnavailable');
}
function normalizeModels(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  return source
    .map((model) => {
      if (!model || typeof model !== 'object') return null;
      const slug = valueText(model.slug);
      return { slug, displayName: valueText(model.display_name) || slug };
    })
    .filter((model) => model?.slug && !seen.has(model.slug))
    .filter((model) => {
      seen.add(model.slug);
      return true;
    });
}
async function loadModels() {
  if (props.accountOnly) return;
  const api = bridge();
  if (!api || typeof api.models !== 'function') {
    models.value = [];
    modelsLoaded.value = false;
    modelsError.value = label('unavailable');
    return;
  }
  const token = ++modelsGeneration;
  modelsBusy.value = true;
  modelsLoaded.value = false;
  modelsError.value = '';
  try {
    const result = normalizeModels(await api.models());
    if (token !== modelsGeneration) return;
    models.value = result;
    modelsLoaded.value = true;
  } catch (error) {
    if (token !== modelsGeneration) return;
    models.value = [];
    modelsError.value = errorText(error, label('modelsError'));
  } finally {
    if (token === modelsGeneration) modelsBusy.value = false;
  }
}
async function refreshStatus({ fetchModels = true } = {}) {
  const api = bridge();
  if (!api || typeof api.status !== 'function') {
    status.value = { signedIn: false, pending: false, activeClientId: '', accounts: [] };
    statusError.value = label('unavailable');
    models.value = [];
    modelsLoaded.value = false;
    return;
  }
  const token = ++statusGeneration;
  statusBusy.value = true;
  statusError.value = '';
  try {
    const result = normalizeStatus(await api.status());
    if (token !== statusGeneration) return;
    status.value = result;
    statusError.value = result.error || '';
    if (result.signedIn && !result.pending && fetchModels && !props.accountOnly) await loadModels();
    else if (!result.signedIn) {
      ++modelsGeneration;
      models.value = [];
      modelsLoaded.value = false;
      modelsError.value = '';
      modelsBusy.value = false;
    }
  } catch (error) {
    if (token !== statusGeneration) return;
    statusError.value = errorText(error, label('unavailable'));
  } finally {
    if (token === statusGeneration) statusBusy.value = false;
  }
}
async function signIn(clientId) {
  const api = bridge();
  if (!api || typeof api.signIn !== 'function' || authPending.value) return;
  signingIn.value = true;
  actionError.value = '';
  cancelRequested = false;
  try {
    if (clientId !== undefined) await api.signIn({ clientId });
    else await api.signIn();
    await refreshStatus();
    emit('auth-change');
  } catch (error) {
    if (!cancelRequested) actionError.value = errorText(error, label('actionError'));
  } finally {
    signingIn.value = false;
    cancelling.value = false;
  }
}
async function cancelSignIn() {
  const api = bridge();
  if (!api || typeof api.cancel !== 'function' || !authPending.value || cancelling.value) return;
  cancelRequested = true;
  cancelling.value = true;
  actionError.value = '';
  try {
    await api.cancel();
    await refreshStatus();
    emit('auth-change');
  } catch (error) {
    actionError.value = errorText(error, label('actionError'));
  } finally {
    cancelling.value = false;
  }
}
async function selectAccount(clientId) {
  const api = bridge();
  if (
    !clientId ||
    clientId === selectedAccountId.value ||
    authPending.value ||
    !api ||
    typeof api.select !== 'function'
  )
    return;
  actionBusy.value = true;
  actionError.value = '';
  try {
    await api.select(clientId);
    await refreshStatus();
    emit('auth-change');
  } catch (error) {
    actionError.value = errorText(error, label('actionError'));
  } finally {
    actionBusy.value = false;
  }
}
async function signOut() {
  const api = bridge();
  const clientId = selectedAccountId.value;
  if (!clientId || authPending.value || !api || typeof api.signOut !== 'function') return;
  actionBusy.value = true;
  actionError.value = '';
  try {
    await api.signOut(clientId);
    await refreshStatus();
    emit('auth-change');
  } catch (error) {
    actionError.value = errorText(error, label('actionError'));
  } finally {
    actionBusy.value = false;
  }
}
async function openUsage(event) {
  const openExternal = globalThis.window?.previewWindow?.openExternal;
  if (typeof openExternal !== 'function') return;
  event.preventDefault();
  try {
    await openExternal(USAGE_URL);
  } catch (error) {
    actionError.value = errorText(error, label('actionError'));
  }
}

watch(modelValid, (value) => emit('model-validity', value), { immediate: true });
onMounted(() => {
  const api = bridge();
  if (api && typeof api.onChanged === 'function') {
    const unsubscribe = api.onChanged(() => {
      emit('auth-change');
      void refreshStatus();
    });
    if (typeof unsubscribe === 'function') stopChanged = unsubscribe;
  }
  void refreshStatus();
});
onBeforeUnmount(() => {
  ++statusGeneration;
  ++modelsGeneration;
  stopChanged?.();
});
</script>

<template>
  <div class="chatgpt-subscription-settings" :class="{ 'is-account-only': accountOnly }">
    <div class="subscription-heading setting-row">
      <div class="subscription-title">
        <h4>{{ label('title') }}</h4>
      </div>
      <span class="subscription-status" :class="{ 'is-signed-in': signedIn }">
        {{ label(signedIn ? 'signedIn' : 'signedOut') }}
      </span>
    </div>
    <div class="subscription-guidance" :class="{ 'is-pending': authPending }" role="status">
      <p class="subscription-description">
        {{ label(authPending ? 'signingIn' : signedIn ? 'signedInHint' : 'signedOutHint') }}
      </p>
      <AppButton v-if="authPending" size="small" :disabled="cancelling" @click="cancelSignIn">{{
        label('cancel')
      }}</AppButton>
    </div>
    <p v-if="!bridgeAvailable" class="subscription-message" role="status">
      {{ label('unavailable') }}
    </p>
    <p v-if="statusError" class="subscription-message" role="status">
      {{ statusError }}
      <AppButton v-if="!statusBusy" size="small" :disabled="authPending" @click="refreshStatus()">{{
        label('retry')
      }}</AppButton>
    </p>
    <div v-if="signedIn || accounts.length" class="subscription-account">
      <div class="subscription-account-heading">
        <span>{{ label('account') }}</span>
        <a :href="USAGE_URL" target="_blank" rel="noopener noreferrer" @click="openUsage">{{
          label('usage')
        }}</a>
      </div>
      <AppPopUpButton
        v-if="accounts.length"
        :model-value="selectedAccountId"
        :disabled="actionBusy || authPending || statusBusy"
        teleport-to="body"
        :aria-label="label('account')"
        @update:model-value="selectAccount"
        ><AppPopUpButtonItem
          v-for="account in accounts"
          :key="account.clientId"
          :value="account.clientId"
          >{{ accountLabel(account) }}</AppPopUpButtonItem
        ></AppPopUpButton
      >
      <p v-else class="subscription-muted">{{ label('accountUnavailable') }}</p>
      <div class="subscription-account-actions">
        <AppButton
          :disabled="actionBusy || authPending || !selectedAccountId"
          @click="signIn(selectedAccountId)"
          >{{ label('reauthorize') }}</AppButton
        >
        <AppButton :disabled="actionBusy || authPending" @click="signIn('')">{{
          label('addAccount')
        }}</AppButton>
        <AppButton
          :disabled="actionBusy || authPending || !signedIn || !selectedAccountId"
          @click="signOut"
          >{{ label('signOut') }}</AppButton
        >
      </div>
    </div>
    <AppButton
      v-if="!signedIn && !authPending"
      variant="prominent"
      :disabled="authPending || !bridgeAvailable"
      @click="signIn(selectedAccountId || undefined)"
      >{{ label('continueWithChatGPT') }}</AppButton
    >
    <p v-if="actionError" class="subscription-message" role="alert">{{ actionError }}</p>
    <div v-if="!accountOnly && signedIn" class="subscription-model">
      <label id="chatgpt-subscription-model-label">{{ label('model') }}</label>
      <p v-if="modelsBusy" class="subscription-muted" role="status">{{ label('loadingModels') }}</p>
      <template v-else-if="models.length">
        <AppPopUpButton
          :model-value="String(modelValue || '')"
          :disabled="modelsBusy || actionBusy || authPending"
          teleport-to="body"
          aria-labelledby="chatgpt-subscription-model-label"
          @update:model-value="emit('update:modelValue', $event)"
          ><AppPopUpButtonItem v-for="model in models" :key="model.slug" :value="model.slug">{{
            model.displayName
          }}</AppPopUpButtonItem></AppPopUpButton
        >
      </template>
      <p v-else-if="modelsError" class="subscription-message" role="status">
        {{ modelsError }}
        <AppButton size="small" :disabled="authPending" @click="loadModels">{{
          label('retry')
        }}</AppButton>
      </p>
      <p v-else class="subscription-muted" role="status">{{ label('noModels') }}</p>
      <p v-if="currentModelUnavailable" class="subscription-warning" role="alert">
        {{ label('modelUnavailable', { model: modelValue }) }}
        <AppButton size="small" :disabled="authPending" @click="emit('update:modelValue', '')">{{
          label('clearModel')
        }}</AppButton>
      </p>
    </div>
  </div>
</template>

<style scoped>
.chatgpt-subscription-settings {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.subscription-heading,
.subscription-account-heading,
.subscription-account-actions,
.subscription-guidance {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subscription-heading,
.subscription-account-heading {
  justify-content: space-between;
}
.subscription-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}
.subscription-title h4 {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.subscription-status {
  flex: none;
  color: var(--text-tertiary);
  font-size: 11px;
}
.subscription-status.is-signed-in {
  color: var(--accent);
}
.subscription-description,
.subscription-muted,
.subscription-message,
.subscription-warning {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
.subscription-message,
.subscription-warning {
  color: var(--danger, #c93434);
}
.subscription-message :deep(button),
.subscription-warning :deep(button) {
  margin-inline-start: 6px;
}
.subscription-account {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--chrome-border);
  border-radius: var(--radius-sm);
  background: var(--chrome-softer, var(--accent-softer));
}
.subscription-account-heading > span {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}
.subscription-account-heading a {
  color: var(--accent);
  font-size: 11px;
}
.subscription-account :deep(.macvue-pop-up-button-anchor) {
  justify-content: flex-start;
  min-width: 0;
}
.subscription-account-actions {
  flex-wrap: wrap;
}
.subscription-account-actions :deep(button) {
  flex: 1 1 auto;
}
.subscription-guidance.is-pending {
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--chrome-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--chrome-softer, var(--accent-softer));
  font-size: 12px;
}
.subscription-model {
  display: grid;
  gap: 7px;
  padding-top: 3px;
}
.subscription-model > label {
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
}
.subscription-model :deep(.macvue-pop-up-button-anchor) {
  justify-content: flex-start;
  min-width: 0;
}
@media (max-width: 520px) {
  .subscription-account-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
