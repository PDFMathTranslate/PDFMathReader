import { uiLanguage } from '../../i18n/index.mjs';

// English remains the fallback for unsupported language codes.
const labels = {
  en: {
    setting: 'Emphasize document-specific terms',
    hint: 'Uses TF-IDF: words that are frequent in the document but rare across your other documents are drawn bolder, in three steps. Applies to original pages only and starts once at least three other documents have been opened. Each opened document adds the words of a few random pages to a local cache on this Mac; no text leaves it.',
  },
  'zh-CN': {
    setting: '强调文档特有词汇',
    hint: '使用 TF-IDF：在本篇文档中出现频繁、但在你其他文档中少见的词会分三档加粗显示。仅作用于原文页面，至少打开过另外三份文档后开始生效。每份打开的文档会把若干随机页面中的词语记入本机的本地缓存，不会上传任何文本。',
  },
  'zh-TW': {
    setting: '強調文件特有詞彙',
    hint: '使用 TF-IDF：在本篇文件中出現頻繁、但在你其他文件中少見的詞會分三檔加粗顯示。僅作用於原文頁面，至少開啟過另外三份文件後開始生效。每份開啟的文件會把若干隨機頁面中的詞語記入本機的本地快取，不會上傳任何文字。',
  },
  ja: {
    setting: '文書固有の用語を強調',
    hint: 'TF-IDF を使用します。文書内では頻出し、他の文書ではまれな単語を 3 段階で太字にします。原文ページのみが対象で、他に少なくとも 3 件の文書を開くと有効になります。開いた文書ごとに、数ページから選んだ単語をこの Mac のローカルキャッシュに追加します。テキストが外部に送信されることはありません。',
  },
  ko: {
    setting: '문서 고유 용어 강조',
    hint: 'TF-IDF를 사용합니다. 문서에서는 자주 나오지만 다른 문서에서는 드문 단어를 3단계로 굵게 표시합니다. 원문 페이지에만 적용되며 다른 문서를 3개 이상 열면 시작됩니다. 문서를 열 때마다 무작위로 고른 몇 페이지의 단어가 이 Mac의 로컬 캐시에 추가되고 텍스트는 외부로 전송되지 않습니다.',
  },
  fr: {
    setting: 'Mettre en évidence les termes propres au document',
    hint: 'Utilise le TF-IDF : les mots fréquents dans le document mais rares dans vos autres documents sont affichés en gras selon trois niveaux. S’applique uniquement aux pages originales et commence après l’ouverture d’au moins trois autres documents. Chaque document ouvert ajoute les mots de quelques pages choisies au hasard à un cache local sur ce Mac ; aucun texte ne quitte l’ordinateur.',
  },
  es: {
    setting: 'Destacar términos propios del documento',
    hint: 'Usa TF-IDF: las palabras frecuentes en el documento pero poco habituales en tus otros documentos se muestran en negrita en tres niveles. Solo se aplica a las páginas originales y empieza después de abrir al menos otros tres documentos. Cada documento abierto añade al caché local de este Mac las palabras de algunas páginas aleatorias; ningún texto sale del equipo.',
  },
  de: {
    setting: 'Dokumentspezifische Begriffe hervorheben',
    hint: 'Verwendet TF-IDF: Wörter, die im Dokument häufig, in Ihren anderen Dokumenten aber selten vorkommen, werden in drei Stufen fetter dargestellt. Gilt nur für Originalseiten und beginnt, sobald mindestens drei weitere Dokumente geöffnet wurden. Bei jedem geöffneten Dokument werden die Wörter einiger zufälliger Seiten in einen lokalen Cache auf diesem Mac aufgenommen; kein Text verlässt das Gerät.',
  },
  pt: {
    setting: 'Destacar termos específicos do documento',
    hint: 'Utiliza TF-IDF: as palavras frequentes no documento mas raras nos seus outros documentos são apresentadas a negrito em três níveis. Aplica-se apenas às páginas originais e começa depois de abrir pelo menos três outros documentos. Cada documento aberto adiciona ao cache local deste Mac as palavras de algumas páginas aleatórias; nenhum texto sai do dispositivo.',
  },
  ru: {
    setting: 'Выделять термины, характерные для документа',
    hint: 'Использует TF-IDF: слова, часто встречающиеся в документе, но редкие в других документах, выделяются полужирным в три этапа. Работает только на исходных страницах и включается после открытия как минимум трёх других документов. При открытии каждого документа слова с нескольких случайных страниц добавляются в локальный кэш на этом Mac; текст никуда не отправляется.',
  },
  ar: {
    setting: 'إبراز المصطلحات الخاصة بالمستند',
    hint: 'يستخدم TF-IDF: تُعرض الكلمات المتكررة في المستند والنادرة في مستنداتك الأخرى بخط أكثر سماكة على ثلاث درجات. ينطبق على الصفحات الأصلية فقط ويبدأ بعد فتح ثلاثة مستندات أخرى على الأقل. يضيف كل مستند مفتوح كلمات من بضع صفحات عشوائية إلى ذاكرة تخزين مؤقت محلية على هذا الـ Mac؛ لا يغادر أي نص الجهاز.',
  },
  arz: {
    setting: 'إبراز المصطلحات الخاصة بالمستند',
    hint: 'بيستخدم TF-IDF: الكلمات اللي بتتكرر كتير في المستند ونادرة في مستنداتك التانية بتظهر بخط أتقل على 3 درجات. الخاصية للصفحات الأصلية بس وبتبدأ بعد ما تفتح 3 مستندات تانية على الأقل. كل مستند بتفتحه بيضيف كلمات من كام صفحة عشوائية للكاش المحلي على الـ Mac ده؛ ولا أي نص بيطلع برّه الجهاز.',
  },
  hi: {
    setting: 'दस्तावेज़-विशिष्ट शब्दों पर ज़ोर दें',
    hint: 'TF-IDF का उपयोग करता है: दस्तावेज़ में बार-बार आने वाले लेकिन आपके अन्य दस्तावेज़ों में दुर्लभ शब्दों को तीन स्तरों में अधिक गाढ़ा दिखाया जाता है। यह केवल मूल पेजों पर लागू होता है और कम से कम तीन अन्य दस्तावेज़ खोलने के बाद शुरू होता है। हर खोला गया दस्तावेज़ कुछ यादृच्छिक पेजों के शब्द इस Mac के स्थानीय कैश में जोड़ता है; कोई टेक्स्ट बाहर नहीं भेजा जाता।',
  },
  bn: {
    setting: 'নথি-নির্দিষ্ট শব্দে জোর দিন',
    hint: 'TF-IDF ব্যবহার করে: নথিতে ঘন ঘন কিন্তু আপনার অন্য নথিতে বিরল শব্দ তিন স্তরে গাঢ় করে দেখানো হয়। এটি শুধু মূল পেজে প্রযোজ্য এবং অন্তত তিনটি অন্য নথি খোলার পর শুরু হয়। খোলা প্রতিটি নথি থেকে কয়েকটি এলোমেলো পেজের শব্দ এই Mac-এর স্থানীয় ক্যাশে যোগ হয়; কোনো লেখা বাইরে যায় না।',
  },
  ur: {
    setting: 'دستاویز سے مخصوص اصطلاحات نمایاں کریں',
    hint: 'TF-IDF استعمال کرتا ہے: دستاویز میں عام مگر آپ کی دیگر دستاویزات میں نایاب الفاظ کو تین درجوں میں زیادہ موٹا دکھایا جاتا ہے۔ یہ صرف اصل صفحات پر لاگو ہوتا ہے اور کم از کم تین دیگر دستاویزات کھولنے کے بعد شروع ہوتا ہے۔ ہر کھولی گئی دستاویز کے چند بے ترتیب صفحات کے الفاظ اس Mac کے مقامی کیش میں شامل ہوتے ہیں؛ کوئی متن باہر نہیں بھیجا جاتا۔',
  },
  pcm: {
    setting: 'Make words wey belong to document stand out',
    hint: 'E use TF-IDF: words wey plenty for this document but rare for your other documents go bold for three levels. E work for original pages only and start after you don open at least three other documents. Every document wey you open add words from some random pages to local cache for this Mac; no text leave the device.',
  },
};

export function tfidfWeightingLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
