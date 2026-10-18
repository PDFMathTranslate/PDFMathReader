import { getDocument, GlobalWorkerOptions } from "./assets/demo-pdfjs/pdf.mjs";

GlobalWorkerOptions.workerSrc = "./assets/demo-pdfjs/pdf.worker.mjs";

const SAMPLE_URL = "./demo/sample.json";
const DEFAULT_TARGET_LANGUAGE = "zh-CN";
const SUPPORTED_LANGUAGES = ["en", "zh-CN", "ja", "ko", "fr", "es", "hi", "bn"];
const ZOOM_MIN = 0.45;
const ZOOM_MAX = 2.6;
const ZOOM_STEP = 0.1;

const COPY = {
  en: {
    documentLabel: "Reader demo",
    documentStatus: "Prepared local sample",
    documentHeading: "Loading sample PDF…",
    preparedNotice:
      "Prepared translations are bundled with this demo. Nothing is sent online.",
    controls: "Reader controls",
    zoom: "Zoom",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fit: "Fit",
    language: "Translation language",
    showOriginal: "Show original",
    download: "Download original",
    page: (current, total) => `Page ${current} of ${total}`,
    empty: "Loading…",
    footer: "Static demo · one bundled page",
    footerHint: "Click a paragraph to switch between translation and original.",
    errorTitle: "The sample could not be opened.",
    errorFetch: "The local sample data is missing or could not be read.",
    errorRender: "The PDF page could not be rendered.",
    retry: "Try again",
    paragraph: (id) => `Toggle prepared translation for ${id}`,
    original: "Original",
    translated: "Translated",
  },
  "zh-CN": {
    documentLabel: "阅读器演示",
    documentStatus: "本地预置示例",
    documentHeading: "正在加载示例 PDF…",
    preparedNotice: "翻译内容已随示例提供，不会向网络发送数据。",
    controls: "阅读器控制项",
    zoom: "缩放",
    zoomOut: "缩小",
    zoomIn: "放大",
    fit: "适合",
    language: "翻译语言",
    showOriginal: "显示原文",
    download: "下载原始文件",
    page: (current, total) => `第 ${current} 页，共 ${total} 页`,
    empty: "正在加载…",
    footer: "静态演示 · 一个内置页面",
    footerHint: "点击段落，在翻译和原文之间切换。",
    errorTitle: "无法打开示例。",
    errorFetch: "本地示例数据缺失或无法读取。",
    errorRender: "PDF 页面无法渲染。",
    retry: "重试",
    paragraph: (id) => `切换 ${id} 的预置翻译`,
    original: "原文",
    translated: "译文",
  },
  ja: {
    documentLabel: "リーダーデモ",
    documentStatus: "ローカルサンプル",
    documentHeading: "サンプル PDF を読み込み中…",
    preparedNotice: "翻訳はこのデモに含まれています。データは送信されません。",
    controls: "リーダー操作",
    zoom: "ズーム",
    zoomOut: "縮小",
    zoomIn: "拡大",
    fit: "合わせる",
    language: "翻訳言語",
    showOriginal: "原文を表示",
    download: "原文をダウンロード",
    page: (current, total) => `${current} / ${total} ページ`,
    empty: "読み込み中…",
    footer: "静的デモ · 1 ページ",
    footerHint: "段落をクリックして翻訳と原文を切り替えます。",
    errorTitle: "サンプルを開けませんでした。",
    errorFetch: "ローカルサンプルを読み込めません。",
    errorRender: "PDF ページを描画できません。",
    retry: "再試行",
    paragraph: (id) => `${id} の翻訳を切り替え`,
    original: "原文",
    translated: "翻訳",
  },
  ko: {
    documentLabel: "리더 데모",
    documentStatus: "로컬 샘플",
    documentHeading: "샘플 PDF 로드 중…",
    preparedNotice:
      "번역이 데모에 포함되어 있습니다. 데이터가 전송되지 않습니다.",
    controls: "리더 제어",
    zoom: "확대/축소",
    zoomOut: "축소",
    zoomIn: "확대",
    fit: "맞춤",
    language: "번역 언어",
    showOriginal: "원문 표시",
    download: "원본 다운로드",
    page: (current, total) => `${current} / ${total} 페이지`,
    empty: "로드 중…",
    footer: "정적 데모 · 한 페이지",
    footerHint: "단락을 클릭하여 번역과 원문을 전환하세요.",
    errorTitle: "샘플을 열 수 없습니다.",
    errorFetch: "로컬 샘플 데이터를 읽을 수 없습니다.",
    errorRender: "PDF 페이지를 렌더링할 수 없습니다.",
    retry: "다시 시도",
    paragraph: (id) => `${id} 번역 전환`,
    original: "원문",
    translated: "번역",
  },
  fr: {
    documentLabel: "Démo du lecteur",
    documentStatus: "Exemple local préparé",
    documentHeading: "Chargement du PDF…",
    preparedNotice:
      "Les traductions sont incluses dans cette démo. Aucune donnée n’est envoyée.",
    controls: "Commandes du lecteur",
    zoom: "Zoom",
    zoomOut: "Réduire",
    zoomIn: "Agrandir",
    fit: "Ajuster",
    language: "Langue de traduction",
    showOriginal: "Afficher l’original",
    download: "Télécharger l’original",
    page: (current, total) => `Page ${current} sur ${total}`,
    empty: "Chargement…",
    footer: "Démo statique · une page incluse",
    footerHint:
      "Cliquez sur un paragraphe pour alterner entre traduction et original.",
    errorTitle: "Impossible d’ouvrir l’exemple.",
    errorFetch: "Les données locales ne sont pas disponibles.",
    errorRender: "La page PDF n’a pas pu être rendue.",
    retry: "Réessayer",
    paragraph: (id) => `Afficher la traduction de ${id}`,
    original: "Original",
    translated: "Traduit",
  },
  es: {
    documentLabel: "Demo del lector",
    documentStatus: "Muestra local preparada",
    documentHeading: "Cargando PDF de muestra…",
    preparedNotice:
      "Las traducciones están incluidas en esta demo. No se envían datos.",
    controls: "Controles del lector",
    zoom: "Zoom",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    fit: "Ajustar",
    language: "Idioma de traducción",
    showOriginal: "Mostrar original",
    download: "Descargar original",
    page: (current, total) => `Página ${current} de ${total}`,
    empty: "Cargando…",
    footer: "Demo estática · una página incluida",
    footerHint:
      "Haz clic en un párrafo para alternar entre traducción y original.",
    errorTitle: "No se pudo abrir la muestra.",
    errorFetch: "No se pueden leer los datos locales de la muestra.",
    errorRender: "No se pudo renderizar la página PDF.",
    retry: "Reintentar",
    paragraph: (id) => `Alternar traducción de ${id}`,
    original: "Original",
    translated: "Traducido",
  },
  hi: {
    documentLabel: "रीडर डेमो",
    documentStatus: "तैयार स्थानीय नमूना",
    documentHeading: "नमूना PDF लोड हो रहा है…",
    preparedNotice:
      "अनुवाद इस डेमो में शामिल हैं। कोई डेटा ऑनलाइन नहीं भेजा जाता।",
    controls: "रीडर नियंत्रण",
    zoom: "ज़ूम",
    zoomOut: "छोटा करें",
    zoomIn: "बड़ा करें",
    fit: "फ़िट",
    language: "अनुवाद भाषा",
    showOriginal: "मूल दिखाएँ",
    download: "मूल डाउनलोड करें",
    page: (current, total) => `पृष्ठ ${current} / ${total}`,
    empty: "लोड हो रहा है…",
    footer: "स्थिर डेमो · एक पृष्ठ",
    footerHint: "अनुवाद और मूल के बीच बदलने के लिए पैराग्राफ़ पर क्लिक करें।",
    errorTitle: "नमूना नहीं खुल सका।",
    errorFetch: "स्थानीय नमूना डेटा पढ़ा नहीं जा सका।",
    errorRender: "PDF पृष्ठ रेंडर नहीं हो सका।",
    retry: "फिर कोशिश करें",
    paragraph: (id) => `${id} का अनुवाद बदलें`,
    original: "मूल",
    translated: "अनुवाद",
  },
  bn: {
    documentLabel: "রিডার ডেমো",
    documentStatus: "প্রস্তুত স্থানীয় নমুনা",
    documentHeading: "নমুনা PDF লোড হচ্ছে…",
    preparedNotice:
      "অনুবাদ এই ডেমোর সঙ্গে দেওয়া হয়েছে। কোনো ডেটা অনলাইনে পাঠানো হয় না।",
    controls: "রিডার নিয়ন্ত্রণ",
    zoom: "জুম",
    zoomOut: "ছোট করুন",
    zoomIn: "বড় করুন",
    fit: "ফিট",
    language: "অনুবাদের ভাষা",
    showOriginal: "মূল দেখান",
    download: "মূল ডাউনলোড করুন",
    page: (current, total) => `পৃষ্ঠা ${current} / ${total}`,
    empty: "লোড হচ্ছে…",
    footer: "স্ট্যাটিক ডেমো · একটি পৃষ্ঠা",
    footerHint: "অনুবাদ ও মূলের মধ্যে বদলাতে অনুচ্ছেদে ক্লিক করুন।",
    errorTitle: "নমুনা খোলা যায়নি।",
    errorFetch: "স্থানীয় নমুনা ডেটা পড়া যায়নি।",
    errorRender: "PDF পৃষ্ঠা রেন্ডার করা যায়নি।",
    retry: "আবার চেষ্টা করুন",
    paragraph: (id) => `${id}-এর অনুবাদ বদলান`,
    original: "মূল",
    translated: "অনুবাদ",
  },
};

const dom = {
  app: document.querySelector("#reader-app"),
  documentLabel: document.querySelector("#document-label"),
  documentStatus: document.querySelector("#document-status"),
  documentHeading: document.querySelector("#document-heading"),
  preparedNotice: document.querySelector("#prepared-notice"),
  documentScroller: document.querySelector("#document-scroller"),
  pageStage: document.querySelector("#page-stage"),
  pageCanvas: document.querySelector("#page-canvas"),
  translationLayer: document.querySelector("#translation-layer"),
  emptyState: document.querySelector("#empty-state"),
  pageCount: document.querySelector("#page-count"),
  errorPanel: document.querySelector("#error-panel"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  retryButton: document.querySelector("#retry-button"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomFit: document.querySelector("#zoom-fit"),
  zoomValue: document.querySelector("#zoom-value"),
  targetLanguage: document.querySelector("#target-language"),
  showOriginal: document.querySelector("#show-original"),
  downloadOriginal: document.querySelector("#download-original"),
  downloadLabel: document.querySelector("#download-label"),
  languageLabel: document.querySelector("#language-label"),
  showOriginalLabel: document.querySelector("#show-original-label"),
  footerCopy: document.querySelector("#footer-copy"),
  footerHint: document.querySelector("#footer-hint"),
};

const params = new URLSearchParams(window.location.search);
const requestedLocale = normalizeLanguage(params.get("locale"));
const uiLanguage = requestedLocale || "en";
const targetLanguage =
  requestedLocale && requestedLocale !== "en"
    ? requestedLocale
    : DEFAULT_TARGET_LANGUAGE;
const copy = COPY[uiLanguage] || COPY.en;

const state = {
  config: null,
  pdfDocument: null,
  page: null,
  zoom: 1,
  fitZoom: 1,
  useFit: true,
  showOriginal: false,
  paragraphStates: new Map(),
  currentRenderTask: null,
  renderQueue: Promise.resolve(),
  renderGeneration: 0,
  loadingGeneration: 0,
  resizeFrame: 0,
};

function normalizeLanguage(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (SUPPORTED_LANGUAGES.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === "zh" || lower === "zh-cn") return "zh-CN";
  const match = SUPPORTED_LANGUAGES.find(
    (language) => language.toLowerCase() === lower,
  );
  return match || null;
}

function setText() {
  document.documentElement.lang = uiLanguage;
  dom.app?.setAttribute("data-locale", uiLanguage);
  document
    .querySelector(".reader-toolbar")
    ?.setAttribute("aria-label", copy.documentLabel);
  document
    .querySelector(".toolbar-actions")
    ?.setAttribute("aria-label", copy.controls);
  document
    .querySelector(".zoom-controls")
    ?.setAttribute("aria-label", copy.zoom);
  dom.documentLabel.textContent = copy.documentLabel;
  dom.documentStatus.textContent = copy.documentStatus;
  dom.documentHeading.textContent = copy.documentHeading;
  dom.preparedNotice.textContent = copy.preparedNotice;
  dom.zoomOut.setAttribute("aria-label", copy.zoomOut);
  dom.zoomOut.title = copy.zoomOut;
  dom.zoomIn.setAttribute("aria-label", copy.zoomIn);
  dom.zoomIn.title = copy.zoomIn;
  dom.zoomFit.textContent = copy.fit;
  dom.zoomValue.setAttribute("aria-label", copy.zoom);
  dom.languageLabel.textContent = copy.language;
  dom.targetLanguage.setAttribute("aria-label", copy.language);
  dom.showOriginalLabel.textContent = copy.showOriginal;
  dom.downloadLabel.textContent = copy.download;
  dom.footerCopy.textContent = copy.footer;
  dom.footerHint.textContent = copy.footerHint;
  dom.errorTitle.textContent = copy.errorTitle;
  dom.retryButton.textContent = copy.retry;
  dom.emptyState.textContent = copy.empty;
}

function setControlsEnabled(enabled) {
  [
    dom.zoomOut,
    dom.zoomIn,
    dom.zoomFit,
    dom.targetLanguage,
    dom.showOriginal,
  ].forEach((element) => {
    element.disabled = !enabled;
  });
  if (enabled) {
    dom.downloadOriginal.removeAttribute("aria-disabled");
  } else {
    dom.downloadOriginal.setAttribute("aria-disabled", "true");
  }
}

function setError(error, phase = "fetch") {
  const detail = error instanceof Error ? error.message : String(error || "");
  const message = phase === "render" ? copy.errorRender : copy.errorFetch;
  dom.errorMessage.textContent = detail ? `${message} ${detail}` : message;
  dom.errorPanel.hidden = false;
  dom.emptyState.hidden = true;
  dom.documentScroller.setAttribute("aria-busy", "false");
  dom.documentHeading.textContent = copy.errorTitle;
  dom.pageStage.hidden = true;
  setControlsEnabled(false);
}

function clearError() {
  dom.errorPanel.hidden = true;
  dom.errorMessage.textContent = "";
}

function setZoomValue() {
  const percentage = Math.round(state.zoom * 100);
  dom.zoomValue.textContent = `${percentage}%`;
}

function setPageDimensions(viewport) {
  dom.pageStage.style.setProperty("--page-width", `${viewport.width}px`);
  dom.pageStage.style.setProperty("--page-height", `${viewport.height}px`);
  dom.pageStage.style.width = `${viewport.width}px`;
  dom.pageStage.style.height = `${viewport.height}px`;
}

function getMetadataSize() {
  return {
    width:
      Number(state.config?.width) > 0
        ? Number(state.config.width)
        : state.page?.view[2] || 595,
    height:
      Number(state.config?.height) > 0
        ? Number(state.config.height)
        : state.page?.view[3] || 842,
  };
}

function computeFitZoom() {
  if (!state.page) return 1;
  const pageView = state.page.getViewport({ scale: 1 });
  const style = getComputedStyle(dom.documentScroller);
  const horizontalPadding =
    parseFloat(style.paddingLeft || "0") +
    parseFloat(style.paddingRight || "0");
  const verticalPadding =
    parseFloat(style.paddingTop || "0") +
    parseFloat(style.paddingBottom || "0");
  const availableWidth = Math.max(
    160,
    dom.documentScroller.clientWidth - horizontalPadding,
  );
  const availableHeight = Math.max(
    260,
    dom.documentScroller.clientHeight - verticalPadding,
  );
  const widthFit = availableWidth / pageView.width;
  const heightFit = availableHeight / pageView.height;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(widthFit, heightFit)));
}

function updateZoom(nextZoom, { fit = false, render = true } = {}) {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(nextZoom) || 1));
  state.zoom = clamped;
  state.useFit = fit;
  setZoomValue();
  if (render && state.page) renderPage();
}

function updateFitZoom() {
  if (!state.page || !state.useFit) return;
  const fitZoom = computeFitZoom();
  state.fitZoom = fitZoom;
  updateZoom(fitZoom, { fit: true });
}

function scheduleFitOnResize() {
  if (!state.useFit || !state.page || state.resizeFrame) return;
  const requestFrame =
    window.requestAnimationFrame ||
    ((callback) => window.setTimeout(callback, 0));
  state.resizeFrame = requestFrame(() => {
    state.resizeFrame = 0;
    updateFitZoom();
  });
}

function getTextForParagraph(paragraph, translated) {
  if (!translated) return paragraph.text;
  return (
    paragraph.translations?.[state.config.targetLanguage] ||
    paragraph.translations?.[DEFAULT_TARGET_LANGUAGE] ||
    paragraph.text
  );
}

function safeParagraphId(paragraph, index) {
  const id = String(paragraph?.id || `paragraph-${index + 1}`);
  return id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function renderTranslationButtons() {
  if (!state.config || !state.page) return;
  const metadataSize = getMetadataSize();
  const paragraphs = Array.isArray(state.config.paragraphs)
    ? state.config.paragraphs
    : [];
  dom.translationLayer.replaceChildren();

  paragraphs.forEach((paragraph, index) => {
    if (!paragraph || typeof paragraph !== "object") return;
    const id = safeParagraphId(paragraph, index);
    if (!state.paragraphStates.has(id)) state.paragraphStates.set(id, true);
    const translated = state.paragraphStates.get(id) && !state.showOriginal;
    const button = document.createElement("button");
    const text = document.createElement("span");
    const x = finiteNumber(paragraph.x, 0);
    const y = finiteNumber(paragraph.y, 0);
    const width = Math.max(1, finiteNumber(paragraph.width, 1));
    const height = Math.max(1, finiteNumber(paragraph.height, 1));
    const fontSize = Math.max(6, finiteNumber(paragraph.fontSize, 12));
    const paragraphLabel = paragraph.id || `paragraph ${index + 1}`;

    button.type = "button";
    button.className = `translation-button${translated ? "" : " is-original"}`;
    button.dataset.paragraphId = id;
    button.dataset.state = translated ? "translated" : "original";
    button.style.left = `${(x / metadataSize.width) * 100}%`;
    button.style.top = `${(y / metadataSize.height) * 100}%`;
    button.style.width = `${(width / metadataSize.width) * 100}%`;
    button.style.height = `${(height / metadataSize.height) * 100}%`;
    button.style.setProperty("--metadata-font-size", `${fontSize}px`);
    button.setAttribute(
      "aria-label",
      `${copy.paragraph(paragraphLabel)} — ${translated ? copy.translated : copy.original}`,
    );
    text.textContent = getTextForParagraph(paragraph, translated);
    button.append(text);
    button.addEventListener("click", () => {
      state.paragraphStates.set(id, !state.paragraphStates.get(id));
      renderTranslationButtons();
    });
    dom.translationLayer.append(button);
  });

  const requestFrame =
    window.requestAnimationFrame ||
    ((callback) => window.setTimeout(callback, 0));
  requestFrame(fitTranslationText);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fitTranslationText() {
  const metadataSize = getMetadataSize();
  const stageWidth = dom.pageStage.clientWidth || metadataSize.width;
  const scale = stageWidth / metadataSize.width;
  dom.translationLayer
    .querySelectorAll(".translation-button")
    .forEach((button) => {
      const span = button.firstElementChild;
      if (!span) return;
      const sourceSize = finiteNumber(
        button.style.getPropertyValue("--metadata-font-size").replace("px", ""),
        12,
      );
      const maxSize = Math.max(7, sourceSize * scale);
      const minSize = Math.max(3, maxSize * 0.4);
      let size = maxSize;
      span.style.fontSize = `${size}px`;
      span.style.lineHeight = "1.18";
      let attempts = 0;
      while (
        attempts < 18 &&
        (span.scrollHeight > button.clientHeight - 2 ||
          span.scrollWidth > span.clientWidth + 1) &&
        size > minSize
      ) {
        size = Math.max(minSize, size - Math.max(0.35, maxSize * 0.055));
        span.style.fontSize = `${size}px`;
        attempts += 1;
      }
    });
}

function isCurrentRender(generation) {
  return generation === state.renderGeneration;
}

async function renderPage() {
  if (!state.page) return;
  const generation = ++state.renderGeneration;
  if (state.currentRenderTask) {
    try {
      state.currentRenderTask.cancel();
    } catch {
      // A finished render task can throw when cancelled; the generation check still wins.
    }
  }

  const draw = async () => {
    if (!isCurrentRender(generation) || !state.page) return;
    const viewport = state.page.getViewport({ scale: state.zoom });
    setPageDimensions(viewport);
    const outputScale = window.devicePixelRatio || 1;
    const canvas = dom.pageCanvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      setError(new Error("Canvas 2D is unavailable."), "render");
      return;
    }
    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.save();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    const renderContext = {
      canvasContext: context,
      viewport,
      transform:
        outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    };

    try {
      const task = state.page.render(renderContext);
      state.currentRenderTask = task;
      await task.promise;
      if (!isCurrentRender(generation)) return;
      state.currentRenderTask = null;
      dom.pageStage.hidden = false;
      dom.emptyState.hidden = true;
      dom.documentScroller.setAttribute("aria-busy", "false");
      renderTranslationButtons();
    } catch (error) {
      if (!isCurrentRender(generation)) return;
      state.currentRenderTask = null;
      if (error?.name === "RenderingCancelledException") return;
      setError(error, "render");
    }
  };

  const queued = state.renderQueue.then(draw, draw);
  state.renderQueue = queued.catch(() => {});
  return queued;
}

function validateConfig(config) {
  if (!config || typeof config !== "object")
    throw new Error("The sample data is not valid JSON.");
  if (typeof config.pdf !== "string" || !config.pdf)
    throw new Error("The sample PDF path is missing.");
  if (!Array.isArray(config.paragraphs))
    throw new Error("The sample paragraph list is missing.");
}

async function loadSample() {
  const generation = ++state.loadingGeneration;
  clearError();
  setControlsEnabled(false);
  dom.pageStage.hidden = true;
  dom.emptyState.hidden = false;
  dom.emptyState.textContent = copy.empty;
  dom.documentScroller.setAttribute("aria-busy", "true");
  dom.documentHeading.textContent = copy.documentHeading;
  if (state.currentRenderTask) {
    try {
      state.currentRenderTask.cancel();
    } catch {
      // Ignore a completed task while replacing the sample.
    }
  }
  state.renderGeneration += 1;
  state.currentRenderTask = null;
  state.pdfDocument?.cleanup?.();
  state.pdfDocument = null;
  state.page = null;
  state.config = null;

  try {
    const response = await fetch(SAMPLE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    validateConfig(config);
    const pdfUrl = new URL(config.pdf, new URL("./", window.location.href))
      .href;
    const loadingTask = getDocument({
      url: pdfUrl,
      wasmUrl: "./assets/demo-pdfjs/wasm/",
      standardFontDataUrl: "./assets/demo-pdfjs/standard_fonts/",
      isEvalSupported: false,
    });
    const pdfDocument = await loadingTask.promise;
    if (generation !== state.loadingGeneration) {
      pdfDocument.cleanup?.();
      return;
    }
    const page = await pdfDocument.getPage(1);
    if (generation !== state.loadingGeneration) {
      pdfDocument.cleanup?.();
      return;
    }
    state.config = { ...config, targetLanguage };
    state.pdfDocument = pdfDocument;
    state.page = page;
    state.paragraphStates = new Map();
    dom.targetLanguage.value = targetLanguage;
    const displayName =
      config.title || config.pdf.split("/").pop() || "Sample PDF";
    dom.documentHeading.textContent = displayName;
    dom.pageCount.textContent = copy.page(1, pdfDocument.numPages);
    const downloadUrl = new URL(config.pdf, new URL("./", window.location.href))
      .href;
    dom.downloadOriginal.href = downloadUrl;
    dom.downloadOriginal.download = config.pdf.split("/").pop() || "sample.pdf";
    dom.downloadOriginal.setAttribute("aria-label", copy.download);
    setControlsEnabled(true);
    state.fitZoom = computeFitZoom();
    state.zoom = state.fitZoom;
    state.useFit = true;
    setZoomValue();
    await renderPage();
  } catch (error) {
    if (generation !== state.loadingGeneration) return;
    setError(error, "fetch");
  }
}

function handleTargetLanguageChange(event) {
  const next = normalizeLanguage(event.target.value) || DEFAULT_TARGET_LANGUAGE;
  state.config.targetLanguage = next;
  renderTranslationButtons();
}

function handleOriginalChange(event) {
  state.showOriginal = event.target.checked;
  renderTranslationButtons();
}

dom.zoomOut.addEventListener("click", () => updateZoom(state.zoom - ZOOM_STEP));
dom.zoomIn.addEventListener("click", () => updateZoom(state.zoom + ZOOM_STEP));
dom.zoomFit.addEventListener("click", () => {
  state.fitZoom = computeFitZoom();
  updateZoom(state.fitZoom, { fit: true });
});
dom.targetLanguage.addEventListener("change", handleTargetLanguageChange);
dom.showOriginal.addEventListener("change", handleOriginalChange);
dom.retryButton.addEventListener("click", loadSample);
window.addEventListener("resize", scheduleFitOnResize, { passive: true });

setText();
setControlsEnabled(false);
loadSample();
