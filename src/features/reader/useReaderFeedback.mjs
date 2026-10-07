import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { t } from '../../i18n/index.mjs';

export function useReaderFeedback(interactionMode) {
  const hoveredParagraph = shallowRef(null),
    copyToast = ref('');
  let copyToastTimer;
  function notifyCopy(message, duration = 1800) {
    clearTimeout(copyToastTimer);
    copyToast.value = message;
    copyToastTimer = setTimeout(() => (copyToast.value = ''), duration);
  }
  let fallbackToastShown = false;
  function noteTranslationService(response) {
    if (
      response.headers.get('X-Translation-Service') !== 'siliconflow-free' ||
      response.headers.get('X-Free-Service-Notice') !== '1'
    )
      return;
    const sessionId = response.headers.get('X-Translation-Session');
    if (!sessionId) return;
    const key = `pdfmathreader.translation-service.${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) {
        fallbackToastShown = true;
        return;
      }
      sessionStorage.setItem(key, '1');
    } catch {
      if (fallbackToastShown) return;
    }
    fallbackToastShown = true;
    notifyCopy(t('translation.siliconflowFreeFallback'), 5000);
  }
  async function copyHoveredParagraph() {
    const focused = document.activeElement;
    if (
      interactionMode.value === 'reading' ||
      !hoveredParagraph.value ||
      focused?.matches('input,textarea,[contenteditable="true"]') ||
      String(window.getSelection() || '').trim()
    ) {
      document.execCommand('copy');
      return;
    }
    const block = hoveredParagraph.value,
      text = block.translation && block.translated ? block.translation : block.text;
    if (!text) return;
    try {
      if (window.previewClipboard) await window.previewClipboard.writeText(text);
      else await window.navigator.clipboard.writeText(text);
      notifyCopy(t('copy.paragraphCopied'));
    } catch {
      notifyCopy(t('copy.failed'));
    }
  }

  onBeforeUnmount(() => clearTimeout(copyToastTimer));
  return { hoveredParagraph, copyToast, notifyCopy, noteTranslationService, copyHoveredParagraph };
}
