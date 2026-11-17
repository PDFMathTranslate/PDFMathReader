import { uiLanguage } from '../../i18n/index.mjs';

// English remains the fallback for unsupported language codes.
const labels = {
  en: {
    setting: 'Force smooth scrolling',
    mouseOnly: 'Only for mouse',
    hint: 'Pages glide to every wheel movement instead of jumping, even with a notched mouse wheel or uneven trackpad input. Movement eases in over a fraction of a second; turned off while Reduce Motion is on.',
  },
  'zh-CN': {
    setting: '强制平滑滚动',
    mouseOnly: '仅用于鼠标',
    hint: '即使使用有段落感的鼠标滚轮或输入不均匀的触控板，页面也会随每次滚动平滑滑动，而不是跳动。移动会有不到一秒的缓动；开启“减少动态效果”时不生效。',
  },
  'zh-TW': {
    setting: '強制平滑捲動',
    mouseOnly: '僅用於滑鼠',
    hint: '即使使用有段落感的滑鼠滾輪或輸入不均勻的觸控板，頁面也會隨每次捲動平滑滑動，而不是跳動。移動會有不到一秒的緩動；開啟「減少動態效果」時不生效。',
  },
  ja: {
    setting: 'スムーズスクロールを強制',
    mouseOnly: 'マウスのみ',
    hint: '段階のあるマウスホイールや不均一なトラックパッド入力でも、ページがジャンプせず、ホイール操作ごとに滑らかに移動します。動きは一瞬かけて緩やかに変化し、「視差効果を減らす」がオンのときは無効です。',
  },
  ko: {
    setting: '부드러운 스크롤 강제',
    mouseOnly: '마우스만',
    hint: '단계가 있는 마우스 휠이나 고르지 않은 트랙패드 입력에서도 페이지가 튀지 않고 휠 움직임마다 부드럽게 이동합니다. 이동은 짧은 순간에 걸쳐 완화되며 동작 줄이기가 켜져 있으면 사용하지 않습니다.',
  },
  fr: {
    setting: 'Forcer le défilement fluide',
    mouseOnly: 'Souris uniquement',
    hint: 'Les pages glissent à chaque mouvement de la molette au lieu de sauter, même avec une molette crantée ou des entrées irrégulières du trackpad. Le mouvement s’accélère progressivement en une fraction de seconde et est désactivé lorsque Réduire les animations est activé.',
  },
  es: {
    setting: 'Forzar desplazamiento suave',
    mouseOnly: 'Solo con el ratón',
    hint: 'Las páginas se deslizan con cada movimiento de la rueda en lugar de saltar, incluso con una rueda con pasos o una entrada irregular del trackpad. El movimiento se suaviza durante una fracción de segundo y se desactiva cuando Reducir movimiento está activado.',
  },
  de: {
    setting: 'Sanftes Scrollen erzwingen',
    mouseOnly: 'Nur für die Maus',
    hint: 'Seiten gleiten bei jeder Bewegung des Mausrads, statt zu springen – auch bei einem Mausrad mit Rasterung oder ungleichmäßigen Trackpad-Eingaben. Die Bewegung wird innerhalb eines Sekundenbruchteils sanft beschleunigt und bei aktivierter Bewegungsreduzierung deaktiviert.',
  },
  pt: {
    setting: 'Forçar deslocamento suave',
    mouseOnly: 'Apenas para o rato',
    hint: 'As páginas deslizam a cada movimento da roda em vez de saltarem, mesmo com uma roda com entalhes ou entradas irregulares do trackpad. O movimento suaviza-se numa fração de segundo e é desativado quando a redução de movimento está ativa.',
  },
  ru: {
    setting: 'Принудительно включить плавную прокрутку',
    mouseOnly: 'Только для мыши',
    hint: 'Страницы плавно перемещаются при каждом движении колеса, а не перескакивают, даже при ступенчатом колесе мыши или неравномерном вводе трекпада. Движение плавно начинается за долю секунды и отключается при включённом уменьшении движения.',
  },
  ar: {
    setting: 'فرض التمرير السلس',
    mouseOnly: 'للماوس فقط',
    hint: 'تنزلق الصفحات مع كل حركة لعجلة التمرير بدلًا من القفز، حتى مع عجلة ماوس متدرجة أو إدخال غير منتظم من لوحة التتبع. تتدرج الحركة خلال جزء من الثانية، وتتوقف عند تفعيل تقليل الحركة.',
  },
  arz: {
    setting: 'فرض التمرير السلس',
    mouseOnly: 'للماوس بس',
    hint: 'الصفحات بتتحرك بسلاسة مع كل حركة في العجلة بدل ما تنط، حتى مع عجلة ماوس متدرجة أو إدخال مش منتظم من لوحة اللمس. الحركة بتبدأ تدريجيًا في جزء من الثانية وبتتوقف لما تقليل الحركة يكون شغّال.',
  },
  hi: {
    setting: 'स्मूद स्क्रॉलिंग लागू करें',
    mouseOnly: 'केवल माउस के लिए',
    hint: 'नॉच वाले माउस व्हील या असमान ट्रैकपैड इनपुट के साथ भी पेज हर व्हील गति पर उछलने के बजाय आसानी से सरकते हैं। गति एक सेकंड के छोटे अंश में धीरे-धीरे बढ़ती है और गति कम करना चालू होने पर बंद रहती है।',
  },
  bn: {
    setting: 'মসৃণ স্ক্রলিং জোর করে চালু করুন',
    mouseOnly: 'শুধু মাউসের জন্য',
    hint: 'খাঁজযুক্ত মাউস হুইল বা অসম ট্র্যাকপ্যাড ইনপুট হলেও পেজ লাফ না দিয়ে প্রতিটি হুইল নড়াচড়ায় মসৃণভাবে সরে। এক সেকেন্ডের ক্ষুদ্র অংশে গতি ধীরে আসে এবং গতি কমানো চালু থাকলে এটি বন্ধ থাকে।',
  },
  ur: {
    setting: 'ہموار اسکرولنگ زبردستی فعال کریں',
    mouseOnly: 'صرف ماؤس کے لیے',
    hint: 'نشان دار ماؤس وہیل یا غیر ہموار ٹریک پیڈ ان پٹ کے باوجود صفحات ہر وہیل حرکت پر اچھلنے کے بجائے ہمواری سے سرکتے ہیں۔ حرکت ایک لمحے میں بتدریج شروع ہوتی ہے اور حرکت کم کریں فعال ہونے پر بند رہتی ہے۔',
  },
  pcm: {
    setting: 'Make scrolling smooth by force',
    mouseOnly: 'Na mouse only',
    hint: 'Pages go smooth with every wheel movement instead of jumping, even if mouse wheel get steps or trackpad input no even. Movement dey enter softly for small part of second; e stop when Reduce Motion dey on.',
  },
};

export function smoothScrollingLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
