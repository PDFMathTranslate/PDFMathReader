<script setup>
import { t } from '../../i18n/index.mjs';
import SidebarNavigation from './SidebarNavigation.vue';
import { AppButton } from '../../ui/controls.mjs';
import ReaderPage from './ReaderPage.vue';
defineProps([
  'bindWorkspace',
  'documentOpening',
  'documentClosing',
  'sidebarWidth',
  'observeThumbnails',
  'resizeFit',
  'sidebar',
  'pages',
  'loading',
  'restoringView',
  'sidebarKeyboard',
  'focusSidebarItem',
  'documentOutline',
  'readChapters',
  'annotations',
  'selectedAnnotation',
  'reduceMotion',
  'sidebarReady',
  'navigateFromSidebar',
  'showScrollbar',
  'bindThumbnailList',
  'thumbnailScrolling',
  'thumbnailLayout',
  'desktopCredentials',
  'thumbnailHighlight',
  'thumbnailItems',
  'active',
  'bindThumbnail',
  'resizeSidebarStart',
  'resizeSidebarMove',
  'resizeSidebarEnd',
  'resizeSidebarKey',
  'bindReader',
  'pinching',
  'fitMode',
  'scrolling',
  'interruptPageScroll',
  'immersiveIntent',
  'dismissKernelFailureFromDocument',
  'recentDocuments',
  'fileInput',
  'sample',
  'clearRecent',
  'openRecent',
  'recentContextMenu',
  'bindLayoutElement',
  'direction',
  'columns',
  'pageLayout',
  'mountedPages',
  'pageCrop',
  'zoom',
  'showTranslations',
  'layoutVisible',
  'engine',
  'foreground',
  'interactionMode',
  'emphasizeTopicSentences',
  'emphasizeInformation',
  'informationCategories',
  'pdf',
  'quickLinkButtons',
  'followQuickLink',
  'showAnnotations',
  'followReference',
  'saveAnnotations',
  'annotationNotice',
  'readerAction',
  'bindPage',
  'bindCanvas',
  'nativeSource',
  'mathSource',
  'searchHit',
  'toggle',
  'processPage',
  'referenceReturn',
  'returnFromReference',
  'searchOpen',
  'createQuickReturn',
]);
const sidebarLeaving = defineModel('sidebarLeaving');
const sidebarMode = defineModel('sidebarMode');
const sidebarDrag = defineModel('sidebarDrag');
const hoveredParagraph = defineModel('hoveredParagraph');
</script>

<template>
  <div
    :ref="bindWorkspace"
    class="workspace"
    :style="sidebarWidth ? { '--sidebar-width': sidebarWidth + 'px' } : undefined"
    :class="{
      'document-transitioning': documentOpening || documentClosing,
      'document-opening': documentOpening,
      'document-closing': documentClosing,
    }"
  >
    <Transition
      :css="!documentOpening && !documentClosing"
      name="sidebar-motion"
      @after-enter="observeThumbnails"
      @after-leave="
        sidebarLeaving = false;
        resizeFit();
      "
      @leave-cancelled="sidebarLeaving = false"
      ><aside
        v-if="sidebar && pages.length"
        class="sidebar sidebar-resizable"
        @keydown="sidebarKeyboard"
        @click="focusSidebarItem"
        :style="sidebarWidth ? { flexBasis: sidebarWidth + 'px' } : undefined"
        :class="{ 'without-motion': restoringView }"
      >
        <div v-if="pages.length" class="sidebar-heading">{{ t('sidebar.' + sidebarMode) }}</div>
        <SidebarNavigation
          v-model:mode="sidebarMode"
          :outline="documentOutline"
          :read-chapters="readChapters"
          :annotations="annotations"
          :selected="selectedAnnotation"
          :reduced-motion="reduceMotion"
          @ready="sidebarReady"
          @page="navigateFromSidebar"
          @annotation="navigateFromSidebar"
          @scroll="showScrollbar"
        >
          <div
            v-if="pages.length"
            :ref="bindThumbnailList"
            class="thumbnail-list"
            @scroll.passive="thumbnailScrolling"
          >
            <div class="thumbnail-inner" :style="{ height: thumbnailLayout.height + 'px' }">
              <div
                v-if="desktopCredentials && thumbnailHighlight"
                class="thumbnail-highlight"
                :class="{ 'without-motion': restoringView }"
                :style="thumbnailHighlight"
                aria-hidden="true"
              ></div>
              <button
                v-for="item in thumbnailItems"
                :key="item.number"
                class="thumb"
                :data-page-number="item.number"
                :style="{
                  top: item.offset + 'px',
                  height: item.height + 'px',
                  '--thumbnail-width': item.width + 'px',
                }"
                :class="{ selected: item.number === active }"
                :aria-current="item.number === active ? 'page' : undefined"
                :aria-label="t('sidebar.goToPage', { page: item.number })"
                @click="navigateFromSidebar(item.number)"
              >
                <canvas
                  :ref="(el) => bindThumbnail(item.number, el)"
                  :width="0"
                  :height="0"
                  :style="{ width: item.width + 'px', height: item.imageHeight + 'px' }"
                ></canvas
                ><span>{{ item.number }}</span
                ><small
                  :style="{
                    visibility:
                      pages[item.number - 1].mathDocument ||
                      pages[item.number - 1].blocks.some((b) => b.translation)
                        ? 'visible'
                        : 'hidden',
                  }"
                  >{{ t('sidebar.translated') }}</small
                >
              </button>
            </div>
          </div>
        </SidebarNavigation>
        <div
          class="sidebar-resize-handle"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('sidebar.resize')"
          :aria-valuenow="Math.round(sidebarWidth || 238)"
          aria-valuemin="200"
          :aria-valuemax="640"
          tabindex="0"
          @pointerdown="resizeSidebarStart"
          @pointermove="resizeSidebarMove"
          @pointerup="resizeSidebarEnd"
          @pointercancel="resizeSidebarEnd"
          @lostpointercapture="sidebarDrag = null"
          @keydown="resizeSidebarKey"
        ></div></aside
    ></Transition>
    <div class="reader-viewport">
      <main
        :ref="bindReader"
        class="reader"
        :class="{
          pinching,
          'manual-zoom': fitMode === 'manual',
          'restoring-view': restoringView,
          'document-opening': documentOpening,
        }"
        @scroll.passive="scrolling"
        @wheel.passive="
          interruptPageScroll();
          immersiveIntent($event);
        "
        @pointerdown.capture="dismissKernelFailureFromDocument"
        @pointerdown="
          interruptPageScroll();
          immersiveIntent($event);
        "
      >
        <div v-if="!pages.length && loading" class="document-loading" role="status">
          <i class="status-dot" :class="{ busy: !reduceMotion }" aria-hidden="true"></i>
          <span>{{ t('status.openingPDF') }}</span>
        </div>
        <div
          v-else-if="!pages.length"
          class="empty"
          :class="{ 'has-recents': recentDocuments.length }"
        >
          <div class="document-symbol">
            <span
              class="system-icon"
              aria-hidden="true"
              data-symbol="doc.text"
              style="--symbol: url('/symbols/doc.text.png')"
            ></span>
          </div>
          <AppButton variant="prominent" size="large" class="primary" @click="fileInput.click()"
            ><span class="open-pdf-content"
              ><span
                class="system-icon"
                aria-hidden="true"
                data-symbol="doc.badge.plus"
                style="--symbol: url('/symbols/doc.badge.plus.png')"
              ></span
              ><span>{{ t('startup.openPDF') }}</span></span
            ></AppButton
          >
          <p class="startup-description">{{ t('startup.description') }}</p>
          <AppButton v-if="!recentDocuments.length" class="sample-button" @click="sample">{{
            t('startup.sample')
          }}</AppButton>
          <section
            v-if="recentDocuments.length"
            class="recent-documents"
            :aria-label="t('startup.recentDocuments')"
          >
            <div class="recent-heading">
              <h2>{{ t('startup.recentDocuments') }}</h2>
              <AppButton size="large" @click="clearRecent">{{ t('startup.clear') }}</AppButton>
            </div>
            <div class="recent-gallery">
              <button
                v-for="document in recentDocuments"
                :key="document.id"
                class="recent-document"
                :data-recent-id="document.id"
                :title="document.name"
                :aria-label="t('startup.openDocument', { name: document.name })"
                @click="openRecent(document.id)"
                @contextmenu.prevent="recentContextMenu(document.id)"
                @keydown.shift.f10.prevent="recentContextMenu(document.id)"
              >
                <img
                  v-if="document.thumbnail"
                  :src="document.thumbnail"
                  alt=""
                  draggable="false"
                /><span
                  v-else
                  class="recent-placeholder"
                  :class="{ 'is-loading': !document.previewUnavailable }"
                  aria-hidden="true"
                  ><span class="system-icon" style="--symbol: url('/symbols/doc.text.png')"></span
                  ><span v-if="document.previewUnavailable">{{
                    t('startup.previewUnavailable')
                  }}</span></span
                >
                <span
                  v-if="document.pinned"
                  class="system-icon recent-pin"
                  style="--symbol: url('/symbols/pin.fill.png')"
                  aria-hidden="true"
                ></span>
              </button>
            </div>
          </section>
        </div>
        <div
          v-if="pages.length"
          :ref="bindLayoutElement"
          class="page-layout virtual-layout"
          :class="direction"
          :style="{
            '--page-columns': columns,
            width: pageLayout.width + 'px',
            height: pageLayout.height + 'px',
          }"
        >
          <ReaderPage
            v-for="p in mountedPages"
            :key="p.number"
            :page="p"
            :crop="pageCrop"
            :frame="pageLayout.frames[p.number - 1]"
            :zoom="zoom"
            :translations="showTranslations"
            :outlined="layoutVisible"
            :engine="engine"
            :foreground="foreground"
            :interaction-mode="interactionMode"
            :emphasize-topic-sentences="emphasizeTopicSentences"
            :emphasize-information="emphasizeInformation"
            :information-categories="informationCategories"
            :pdf-document="p.mathDocument && showTranslations ? p.mathDocument : pdf"
            :pdf-page-number="p.mathDocument && showTranslations ? 1 : p.number"
            :quick-links="quickLinkButtons(p.number)"
            @quick-link="followQuickLink"
            :annotations="annotations"
            :selected-annotation="selectedAnnotation"
            :show-annotations="showAnnotations"
            @navigate="followReference"
            @annotations="saveAnnotations"
            @notice="annotationNotice"
            @search-document="readerAction('search-selection', $event)"
            :register-host="bindPage"
            :register-canvas="bindCanvas"
            :native-source="nativeSource"
            :math-source="mathSource"
            :search-boxes="searchHit?.page === p.number ? searchHit.boxes : []"
            @hover="hoveredParagraph = $event"
            @toggle="toggle"
            @retry="processPage(pages[$event.number - 1], true)"
          />
        </div>
      </main>
      <Transition name="reference-return"
        ><div v-if="referenceReturn && pages.length" class="reference-return-actions">
          <button
            class="page-navigator reference-return-button"
            :title="t('navigator.returnToPosition') + ' (⌘⌫)'"
            :aria-label="t('navigator.returnToPosition')"
            aria-keyshortcuts="Meta+Backspace"
            @click="returnFromReference"
          >
            <svg
              class="reference-return-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 8 2 11l3 3M2 11h10a5 5 0 0 0 5-5" /></svg
            ><span>{{
              t('navigator.returnToPage', { page: referenceReturn.origin.page })
            }}</span></button
          ><button
            v-if="searchOpen && searchHit"
            class="quick-return-create"
            title="创建双向快捷返回链接"
            aria-label="创建双向快捷返回链接"
            @click="createQuickReturn"
          >
            <span
              class="system-icon"
              aria-hidden="true"
              data-symbol="link"
              style="--symbol: url('/symbols/link.png')"
            ></span>
          </button></div
      ></Transition>
    </div>
  </div>
</template>
