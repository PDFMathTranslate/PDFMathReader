import { computed, inject, unref } from 'vue';
import { uiLanguage } from '../../i18n/index.mjs';
import { topicSentenceLength } from './topic-sentences.mjs';

function textValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function revisionValue(classifier) {
  const revision = classifier?.revision;
  if (revision && typeof revision === 'object' && 'value' in revision) return revision.value;
  return revision;
}

/**
 * Resolve the topic sentence boundary while allowing an optional async
 * classifier to override the local heuristic. The classifier owns request
 * deduplication and returns true while a decision is pending or unavailable.
 */
export function useTopicSentenceDecision(text, enabled, locale = uiLanguage) {
  const classifier = inject('topicSentenceClassifier', null);
  const source = computed(() => textValue(unref(text)));
  const active = computed(() => Boolean(unref(enabled)));
  const topicEnd = computed(() => {
    if (!active.value) return 0;
    // Read the revision so completed async decisions refresh this computed
    // boundary without coupling renderers to the classifier implementation.
    revisionValue(classifier);
    const end = topicSentenceLength(source.value, textValue(unref(locale)) || 'en');
    if (!end) return 0;
    let decision = true;
    if (typeof classifier?.isTopicSentence === 'function') {
      try {
        decision = classifier.isTopicSentence(source.value, source.value.slice(0, end));
      } catch {
        decision = true;
      }
    }
    return decision === false ? 0 : end;
  });
  return { topicEnd };
}
