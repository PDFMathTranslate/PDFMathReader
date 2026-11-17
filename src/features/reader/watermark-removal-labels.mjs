import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English remains the fallback for unsupported language codes.
const labels = {
  en: {
    setting: 'Remove watermarks',
    hint: 'Hides text and images that are unusually large for the page and also diagonal, translucent, pale or repeated on many pages, and layers named watermark. Applied when pages are drawn; the file is never changed. Watermarks drawn as plain shapes, and opaque full-page background images, are not detected.',
  },
  'zh-CN': {
    setting: '去除水印',
    hint: '隐藏字号或图片尺寸相对页面异常偏大，且呈斜向、半透明、颜色很浅或在多页重复出现的文字和图片，以及名为水印的图层。仅在绘制页面时生效，不会修改文件。以普通图形绘制的水印和不透明的整页背景图不会被识别。',
  },
  'zh-TW': {
    setting: '移除浮水印',
    hint: '隱藏字級或圖片尺寸相對頁面異常偏大，且呈斜向、半透明、顏色很淺或在多頁重複出現的文字與圖片，以及名為浮水印的圖層。僅在繪製頁面時生效，不會修改檔案。以一般圖形繪製的浮水印和不透明的整頁背景圖不會被辨識。',
  },
  ja: {
    setting: '透かしを削除',
    hint: 'ページに対して異常に大きく、斜め・半透明・薄い色・複数ページでの繰り返しのいずれかに当てはまるテキストと画像、および「watermark」という名前のレイヤーを隠します。ページの描画時に適用され、ファイルは変更しません。単純な図形として描かれた透かしや、不透明なページ全体の背景画像は検出されません。',
  },
  ko: {
    setting: '워터마크 제거',
    hint: '페이지에 비해 비정상적으로 크고 기울어졌거나 반투명하거나 옅거나 여러 페이지에 반복되는 텍스트와 이미지, 그리고 watermark라는 이름의 레이어를 숨깁니다. 페이지를 그릴 때 적용되며 파일은 변경하지 않습니다. 단순한 도형으로 그린 워터마크와 불투명한 전체 페이지 배경 이미지는 감지하지 않습니다.',
  },
  fr: {
    setting: 'Supprimer les filigranes',
    hint: 'Masque les textes et images anormalement grands par rapport à la page et qui sont diagonaux, translucides, pâles ou répétés sur plusieurs pages, ainsi que les calques nommés watermark. S’applique lors du rendu des pages ; le fichier n’est jamais modifié. Les filigranes dessinés comme de simples formes et les images d’arrière-plan opaques couvrant toute la page ne sont pas détectés.',
  },
  es: {
    setting: 'Eliminar marcas de agua',
    hint: 'Oculta textos e imágenes inusualmente grandes para la página que además sean diagonales, translúcidos, pálidos o repetidos en varias páginas, así como las capas llamadas watermark. Se aplica al dibujar las páginas; el archivo nunca se modifica. No se detectan las marcas de agua dibujadas como formas simples ni las imágenes de fondo opacas de página completa.',
  },
  de: {
    setting: 'Wasserzeichen entfernen',
    hint: 'Blendet Text und Bilder aus, die im Verhältnis zur Seite ungewöhnlich groß und außerdem diagonal, durchscheinend, blass oder auf vielen Seiten wiederholt sind, sowie Ebenen mit dem Namen watermark. Wird beim Zeichnen der Seiten angewendet; die Datei wird nie geändert. Als einfache Formen gezeichnete Wasserzeichen und deckende Hintergrundbilder über die ganze Seite werden nicht erkannt.',
  },
  pt: {
    setting: 'Remover marcas de água',
    hint: 'Oculta texto e imagens anormalmente grandes em relação à página que também sejam diagonais, translúcidos, pálidos ou repetidos em várias páginas, bem como camadas com o nome watermark. Aplica-se ao desenhar as páginas; o ficheiro nunca é alterado. Não deteta marcas de água desenhadas como formas simples nem imagens de fundo opacas que cubram toda a página.',
  },
  ru: {
    setting: 'Удалять водяные знаки',
    hint: 'Скрывает текст и изображения, необычно большие для страницы и одновременно наклонные, полупрозрачные, бледные или повторяющиеся на многих страницах, а также слои с именем watermark. Применяется при отрисовке страниц; файл не изменяется. Водяные знаки в виде обычных фигур и непрозрачные фоновые изображения на всю страницу не обнаруживаются.',
  },
  ar: {
    setting: 'إزالة العلامات المائية',
    hint: 'يخفي النصوص والصور الكبيرة بشكل غير معتاد بالنسبة إلى الصفحة، إذا كانت مائلة أو شبه شفافة أو باهتة أو متكررة في صفحات عديدة، وكذلك الطبقات التي تحمل اسم watermark. يُطبَّق عند رسم الصفحات ولا يغيّر الملف. لا يكتشف العلامات المائية المرسومة كأشكال بسيطة أو صور الخلفية المعتمة التي تغطي الصفحة كاملة.',
  },
  arz: {
    setting: 'إزالة العلامات المائية',
    hint: 'بيخفي النصوص والصور الكبيرة بشكل غير عادي بالنسبة للصفحة لو كانت مائلة أو شبه شفافة أو باهتة أو متكررة في صفحات كتير، وكمان الطبقات اللي اسمها watermark. بيتطبق وقت رسم الصفحات والملف ما بيتغيرش. العلامات المائية المرسومة كأشكال عادية وصور الخلفية المعتمة اللي مغطيّة الصفحة كلها مش بتتكتشف.',
  },
  hi: {
    setting: 'वॉटरमार्क हटाएँ',
    hint: 'ऐसे टेक्स्ट और चित्र छिपाता है जो पेज की तुलना में असामान्य रूप से बड़े हों और तिरछे, पारदर्शी, हल्के रंग के या कई पेजों पर दोहराए गए हों, तथा watermark नाम वाली परतें भी। यह पेज बनाते समय लागू होता है; फ़ाइल कभी बदली नहीं जाती। साधारण आकृतियों के रूप में बनाए गए वॉटरमार्क और अपारदर्शी पूरे-पेज पृष्ठभूमि चित्र पहचाने नहीं जाते।',
  },
  bn: {
    setting: 'ওয়াটারমার্ক সরান',
    hint: 'পেজের তুলনায় অস্বাভাবিক বড় এবং তির্যক, স্বচ্ছ, ফ্যাকাশে বা অনেক পেজে পুনরাবৃত্ত টেক্সট ও ছবি, এবং watermark নামের স্তর লুকিয়ে দেয়। পেজ আঁকার সময় প্রয়োগ হয়; ফাইল কখনও বদলায় না। সাধারণ আকৃতি হিসেবে আঁকা ওয়াটারমার্ক এবং অস্বচ্ছ পুরো-পেজ ব্যাকগ্রাউন্ড ছবি শনাক্ত হয় না।',
  },
  ur: {
    setting: 'واٹر مارک ہٹائیں',
    hint: 'ایسے متن اور تصاویر چھپاتا ہے جو صفحے کے لحاظ سے غیر معمولی طور پر بڑے ہوں اور ترچھے، نیم شفاف، مدھم یا کئی صفحات پر دہرائے گئے ہوں، نیز watermark نام والی تہیں بھی۔ صفحات بناتے وقت لاگو ہوتا ہے؛ فائل کبھی تبدیل نہیں ہوتی۔ سادہ اشکال کے طور پر بنائے گئے واٹر مارک اور پورے صفحے کی غیر شفاف پس منظر کی تصاویر شناخت نہیں ہوتیں۔',
  },
  pcm: {
    setting: 'Remove watermark',
    hint: 'E hide text and pictures wey too big for the page and also dey slant, see-through, pale or repeat for many pages, plus layers wey dem name watermark. E apply when page dey draw; file no ever change. Watermark wey dem draw as ordinary shape and opaque background picture wey cover full page no dey detect.',
  },
};

export function watermarkRemovalLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
