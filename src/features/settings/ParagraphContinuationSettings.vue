<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Combine interrupted paragraphs with Jev',
    'Send adjoining paragraph fragments to Jev using the shared API Token, and translate confirmed continuations as one paragraph. Failed or uncertain checks keep fragments separate. Available with Ultra fast and Fast; Fast combines fragments within each column before typesetting. Changing this setting updates the current document.',
  ],
  'zh-CN': [
    '使用 Jev 合并被打断的段落',
    '使用共用的 API Token 将相邻段落片段发送给 Jev，确认是续接内容后按完整段落翻译。请求失败或结果不确定时保留独立片段。适用于 Ultra fast 和 Fast；Fast 会在排版前合并同一栏内的续接片段。更改设置后会更新当前文档。',
  ],
  'zh-TW': [
    '使用 Jev 合併被中斷的段落',
    '使用共用的 API Token 將相鄰段落片段傳送給 Jev，確認是續接內容後按完整段落翻譯。請求失敗或結果不確定時保留獨立片段。適用於 Ultra fast 和 Fast；Fast 會在排版前合併同一欄內的續接片段。更改設定後會更新目前文件。',
  ],
  ja: [
    'Jev で途切れた段落を結合',
    '共有 API Token を使って隣接する段落の断片を Jev に送り、続きであることが確認されたものを 1 つの段落として翻訳します。判定に失敗した場合や不確かな場合は断片を分けたままにします。Ultra fast と Fast で利用できます。Fast では組版前に同じ段内の続きの断片を結合します。この設定を変更すると現在の文書が更新されます。',
  ],
  ko: [
    'Jev로 끊긴 단락 결합',
    '공용 API Token을 사용해 인접한 단락 조각을 Jev에 보내고, 이어지는 내용으로 확인된 조각을 하나의 단락으로 번역합니다. 검사에 실패하거나 결과가 불확실하면 조각을 분리된 상태로 둡니다. Ultra fast와 Fast에서 사용할 수 있으며, Fast는 조판 전에 각 열 안의 이어지는 조각을 결합합니다. 이 설정을 변경하면 현재 문서가 업데이트됩니다.',
  ],
  fr: [
    'Combiner les paragraphes interrompus avec Jev',
    'Envoie les fragments de paragraphes adjacents à Jev avec le Token API partagé et traduit les continuations confirmées en un seul paragraphe. Les fragments restent séparés si la vérification échoue ou reste incertaine. Disponible avec Ultra fast et Fast ; Fast combine les fragments qui se suivent dans chaque colonne avant la composition. Modifier ce réglage met à jour le document actuel.',
  ],
  es: [
    'Combinar párrafos interrumpidos con Jev',
    'Envía fragmentos de párrafos contiguos a Jev mediante el Token API compartido y traduce las continuaciones confirmadas como un solo párrafo. Si la comprobación falla o no es concluyente, los fragmentos se mantienen separados. Disponible con Ultra fast y Fast; Fast combina los fragmentos consecutivos de cada columna antes de la composición. Cambiar este ajuste actualiza el documento actual.',
  ],
  de: [
    'Unterbrochene Absätze mit Jev zusammenführen',
    'Sendet benachbarte Absatzfragmente mit dem gemeinsamen API-Token an Jev und übersetzt bestätigte Fortsetzungen als einen Absatz. Bei fehlgeschlagenen oder unsicheren Prüfungen bleiben die Fragmente getrennt. Verfügbar mit Ultra fast und Fast; Fast führt zusammengehörige Fragmente innerhalb jeder Spalte vor dem Setzen zusammen. Eine Änderung dieser Einstellung aktualisiert das aktuelle Dokument.',
  ],
  pt: [
    'Combinar parágrafos interrompidos com o Jev',
    'Envia fragmentos de parágrafos adjacentes para o Jev utilizando o Token de API partilhado e traduz as continuações confirmadas como um único parágrafo. Se a verificação falhar ou for incerta, os fragmentos permanecem separados. Disponível com Ultra fast e Fast; o Fast combina os fragmentos contínuos de cada coluna antes da composição. A alteração desta definição atualiza o documento atual.',
  ],
  ru: [
    'Объединять прерванные абзацы с помощью Jev',
    'Отправляет соседние фрагменты абзацев в Jev с общим токеном API и переводит подтверждённые продолжения как один абзац. При ошибке или неопределённом результате проверки фрагменты остаются разделёнными. Доступно в режимах Ultra fast и Fast; Fast объединяет продолжения в каждой колонке перед вёрсткой. Изменение настройки обновляет текущий документ.',
  ],
  ar: [
    'دمج الفقرات المتقطعة باستخدام Jev',
    'يرسل أجزاء الفقرات المتجاورة إلى Jev باستخدام رمز API المشترك، ويترجم الاستمرارات المؤكدة كفقرة واحدة. تبقى الأجزاء منفصلة عند فشل الفحص أو عدم اليقين في نتيجته. متاح مع Ultra fast وFast؛ يدمج Fast الأجزاء المتتابعة داخل كل عمود قبل التنضيد. يؤدي تغيير هذا الإعداد إلى تحديث المستند الحالي.',
  ],
  arz: [
    'دمج الفقرات المتقطعة باستخدام Jev',
    'بيبعت أجزاء الفقرات اللي جنب بعض لـ Jev باستخدام رمز API المشترك، وبيترجم الاستمرارات المؤكدة كفقرة واحدة. الأجزاء بتفضل منفصلة لو الفحص فشل أو النتيجة مش مؤكدة. متاح مع Ultra fast وFast؛ وFast بيدمج الأجزاء المتصلة جوه كل عمود قبل تنسيق الصفحة. تغيير الإعداد ده بيحدّث المستند الحالي.',
  ],
  hi: [
    'Jev से टूटे हुए अनुच्छेद जोड़ें',
    'साझा API Token का उपयोग करके पास-पास के अनुच्छेद अंश Jev को भेजता है और पुष्टि किए गए अगले अंशों का एक अनुच्छेद के रूप में अनुवाद करता है। जाँच विफल या अनिश्चित होने पर अंश अलग रखे जाते हैं। Ultra fast और Fast में उपलब्ध है; Fast टाइपसेटिंग से पहले हर कॉलम के जुड़े अंशों को जोड़ता है। यह सेटिंग बदलने पर वर्तमान दस्तावेज़ अपडेट होता है।',
  ],
  bn: [
    'Jev দিয়ে বিচ্ছিন্ন অনুচ্ছেদ জোড়া লাগান',
    'শেয়ার করা API Token ব্যবহার করে পাশাপাশি অনুচ্ছেদের অংশ Jev-কে পাঠায় এবং নিশ্চিত হওয়া ধারাবাহিক অংশ এক অনুচ্ছেদ হিসেবে অনুবাদ করে। পরীক্ষা ব্যর্থ বা অনিশ্চিত হলে অংশগুলি আলাদা থাকে। Ultra fast ও Fast-এ পাওয়া যায়; Fast টাইপসেট করার আগে প্রতিটি কলামের ধারাবাহিক অংশ জোড়ে। এই সেটিং বদলালে বর্তমান নথি আপডেট হয়।',
  ],
  ur: [
    'Jev کے ساتھ ٹوٹے ہوئے پیراگراف جوڑیں',
    'مشترکہ API Token استعمال کرتے ہوئے ساتھ والے پیراگراف کے ٹکڑے Jev کو بھیجتا ہے اور تصدیق شدہ تسلسل کا ایک پیراگراف کے طور پر ترجمہ کرتا ہے۔ جانچ ناکام یا غیر یقینی ہو تو ٹکڑے الگ رہتے ہیں۔ Ultra fast اور Fast میں دستیاب ہے؛ Fast ٹائپ سیٹ کرنے سے پہلے ہر کالم کے مسلسل ٹکڑوں کو جوڑتا ہے۔ یہ ترتیب بدلنے سے موجودہ دستاویز اپ ڈیٹ ہوتی ہے۔',
  ],
  pcm: [
    'Join broken paragraphs with Jev',
    'Send paragraph pieces wey dey next to each other to Jev with the shared API Token, then translate the ones wey e confirm say dem continue as one paragraph. If check fail or e no sure, keep the pieces separate. E dey available for Ultra fast and Fast; Fast join pieces wey continue inside each column before typesetting. If you change this setting, current document go update.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div
    v-if="preferences"
    class="paragraph-continuation-settings"
    data-setting="paragraph-continuation-detection"
  >
    <div class="setting-row">
      <span id="paragraph-continuation-detection-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.paragraphContinuationDetection.value"
        aria-labelledby="paragraph-continuation-detection-label"
        aria-describedby="paragraph-continuation-detection-help"
      />
    </div>
    <p id="paragraph-continuation-detection-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.paragraph-continuation-settings {
  display: grid;
  gap: 8px;
}
.paragraph-continuation-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
