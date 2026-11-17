import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English remains the fallback for unsupported language codes.
const labels = {
  en: {
    setting: 'Magic zoom for recent documents',
    hint: 'Covers in the Recents gallery grow as the pointer moves over them, like the macOS Dock, and their neighbours make room. Applies to the gallery view only and is skipped when Reduce Motion is on.',
  },
  'zh-CN': {
    setting: '最近文档魔法缩放',
    hint: '指针移过“最近文档”画廊中的封面时，封面会像 macOS 程序坞一样放大，相邻封面自动让位。仅适用于画廊视图，开启“减少动态效果”时不生效。',
  },
  'zh-TW': {
    setting: '最近文件魔法縮放',
    hint: '指標移過「最近文件」圖庫中的封面時，封面會像 macOS 程式塢一樣放大，相鄰封面自動讓位。僅適用於圖庫檢視，開啟「減少動態效果」時不生效。',
  },
  ja: {
    setting: '最近の文書のマジックズーム',
    hint: 'ポインタを移動すると、「最近の文書」ギャラリーの表紙が macOS の Dock のように拡大し、隣の表紙が場所を空けます。ギャラリー表示のみ対象で、「視差効果を減らす」がオンのときは無効です。',
  },
  ko: {
    setting: '최근 문서 매직 확대',
    hint: '포인터를 움직이면 최근 문서 갤러리의 표지가 macOS Dock처럼 커지고 주변 표지가 자리를 비켜 줍니다. 갤러리 보기에서만 적용되며 동작 줄이기가 켜져 있으면 사용하지 않습니다.',
  },
  fr: {
    setting: 'Zoom magique des documents récents',
    hint: 'Lorsque le pointeur passe sur les couvertures de la galerie des documents récents, elles s’agrandissent comme dans le Dock de macOS et leurs voisines leur font de la place. S’applique uniquement à la vue galerie et est désactivé lorsque Réduire les animations est activé.',
  },
  es: {
    setting: 'Zoom mágico de documentos recientes',
    hint: 'Al pasar el puntero sobre las portadas de la galería de documentos recientes, se amplían como en el Dock de macOS y las portadas vecinas dejan espacio. Solo se aplica a la vista de galería y se omite cuando Reducir movimiento está activado.',
  },
  de: {
    setting: 'Magischer Zoom für zuletzt verwendete Dokumente',
    hint: 'Wenn der Zeiger über die Titelbilder in der Galerie der zuletzt verwendeten Dokumente bewegt wird, werden sie wie im macOS-Dock vergrößert und die benachbarten Titelbilder machen Platz. Gilt nur für die Galerieansicht und wird bei aktivierter Bewegungsreduzierung übersprungen.',
  },
  pt: {
    setting: 'Zoom mágico dos documentos recentes',
    hint: 'Quando o ponteiro passa sobre as capas na galeria de documentos recentes, elas aumentam como no Dock do macOS e as capas vizinhas abrem espaço. Aplica-se apenas à vista de galeria e é ignorado quando a redução de movimento está ativa.',
  },
  ru: {
    setting: 'Магическое увеличение недавних документов',
    hint: 'При наведении указателя на обложки в галерее недавних документов они увеличиваются, как в Dock macOS, а соседние обложки освобождают место. Работает только в режиме галереи и отключается при включённом уменьшении движения.',
  },
  ar: {
    setting: 'تكبير سحري للمستندات الأخيرة',
    hint: 'تكبر أغلفة المستندات الأخيرة في المعرض عند مرور المؤشر فوقها، مثل Dock في macOS، وتفسح الأغلفة المجاورة لها مكانًا. ينطبق ذلك على عرض المعرض فقط، ويتوقف عند تفعيل تقليل الحركة.',
  },
  arz: {
    setting: 'تكبير سحري للمستندات الأخيرة',
    hint: 'أغلفة المستندات الأخيرة في المعرض بتكبر لما المؤشر يعدّي عليها، زي Dock بتاع macOS، والأغلفة اللي جنبها بتوسّع لها مكان. الخاصية شغالة في عرض المعرض بس وبتتوقف لما تقليل الحركة يكون شغّال.',
  },
  hi: {
    setting: 'हाल के दस्तावेज़ों के लिए मैजिक ज़ूम',
    hint: 'पॉइंटर हाल के दस्तावेज़ों की गैलरी में कवर पर ले जाने पर वे macOS Dock की तरह बड़े हो जाते हैं और पड़ोसी कवर जगह बना लेते हैं। यह केवल गैलरी दृश्य पर लागू होता है और गति कम करना चालू होने पर निष्क्रिय रहता है।',
  },
  bn: {
    setting: 'সাম্প্রতিক নথির জন্য ম্যাজিক জুম',
    hint: 'সাম্প্রতিক নথির গ্যালারিতে কভারের ওপর পয়েন্টার নিলে সেগুলি macOS Dock-এর মতো বড় হয় এবং পাশের কভারগুলি জায়গা করে দেয়। এটি শুধু গ্যালারি দৃশ্যে প্রযোজ্য এবং গতি কমানো চালু থাকলে বন্ধ থাকে।',
  },
  ur: {
    setting: 'حالیہ دستاویزات کے لیے میجک زوم',
    hint: 'حالیہ دستاویزات کی گیلری میں پوائنٹر کور پر لے جانے سے وہ macOS Dock کی طرح بڑے ہو جاتے ہیں اور ساتھ والے کور جگہ بنا لیتے ہیں۔ یہ صرف گیلری منظر پر لاگو ہوتا ہے اور حرکت کم کریں فعال ہونے پر بند رہتا ہے۔',
  },
  pcm: {
    setting: 'Magic zoom for documents wey you open lately',
    hint: 'When pointer move over covers for documents wey you open lately, the covers go big like macOS Dock and the covers near dem make space. E work for gallery view only and e no work when Reduce Motion dey on.',
  },
};

export function recentMagicZoomLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
