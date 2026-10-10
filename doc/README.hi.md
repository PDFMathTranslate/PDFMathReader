[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md)

# <img src="icon.png" alt="PDFMathReader ऐप आइकन" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

किसी भी प्लेटफ़ॉर्म पर रीयलटाइम अनुवाद के साथ किसी भी भाषा में वैज्ञानिक दस्तावेज़ पढ़ें। [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) द्वारा संचालित।

<img src="demo.gif" alt="डेमो" width="100%">

## सुविधाएँ

- **लेआउट संरक्षण**: सूत्रों, तालिकाओं और मुख्य जानकारी को सुरक्षित रखते हुए अनूदित पृष्ठों को मूल लेआउट के करीब रखें।
- **रीयलटाइम अनुवाद**: पूरे दस्तावेज़ के समाप्त होने की प्रतीक्षा किए बिना पढ़ते समय लेआउट पहचानें और अनुवाद करें।
- **इंटरफ़ेस भाषाएँ**: 16 भाषाएँ, अंग्रेज़ी देश-नाम के क्रम में, और डिफ़ॉल्ट रूप से अंग्रेज़ी। इनमें अरबी, मिस्री अरबी, हिंदी, बंगाली, रूसी, पुर्तगाली, उर्दू, जर्मन और नाइजीरियाई पिजिन शामिल हैं।
- **अनुवाद विकल्प**: अनुवाद इंजन, सेवाएँ, भाषाएँ और पूरे दस्तावेज़ या आसपास के पृष्ठ का अनुवाद चुनें।
- **द्विभाषी पठन**: मूल पाठ और अनुवाद के बीच स्विच करने के लिए पहचाने गए पैराग्राफ़ पर क्लिक करें।
- **लचीला नेविगेशन**: थंबनेल, ज़ूम, लंबवत या क्षैतिज स्क्रॉलिंग और एक, दो या चार पृष्ठों के लेआउट के साथ पढ़ें।
- **एकाधिक दस्तावेज़**: PDF को स्वतंत्र विंडो में खोलें और दोबारा खोलने पर पढ़ने की स्थिति तथा प्रदर्शन सेटिंग पुनर्स्थापित करें।
- **पठन लिंक**: आसान संदर्भ के लिए खोज परिणामों और उनके पठन स्रोतों के बीच द्विदिश लिंक सहेजें।
- **हाइलाइट और टिप्पणियाँ**: महत्वपूर्ण अंशों को हाइलाइट करें और पढ़ने के नोट दर्ज करने के लिए टिप्पणियाँ जोड़ें।
- **फ़ाइल कार्रवाइयाँ**: macOS पर Finder में मूल या पूरी तरह अनूदित PDF दिखाएँ और उन्हें AirDrop से भेजें; Windows पर उन्हें File Explorer में दिखाएँ और Windows का नेटिव साझाकरण पैनल खोलें।

## हाल के अपडेट

| तारीख      | सुविधा                                                                                                                                                       | योगदानकर्ता                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 2026-10-10 | [नौ इंटरफ़ेस भाषाएँ जोड़ें](https://github.com/PDFMathTranslate/PDFMathReader/commit/041a09d7d9bb1035715bcc2adbb74e6fae8b391e)                               | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [macOS पर Finder और AirDrop फ़ाइल कार्रवाइयाँ जोड़ें](https://github.com/PDFMathTranslate/PDFMathReader/commit/218541d7ad70ba7fb42ed4321b8d470492391073)     | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [प्रायोगिक Jev दस्तावेज़ भाषा जाँच जोड़ें](https://github.com/PDFMathTranslate/PDFMathReader/commit/00d5afbfe58b4ef689c6619c8b6c6f0faf671031)                | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [कर्नेल शुरू होने से पहले अनूदित पृष्ठ पुनर्स्थापित करें](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386) | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [पठन लेआउट और अनुवाद व्यवहार सुधारें](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe)                     | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [लिक्विड ग्लास और अनुवाद रिफोकस जोड़ें](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)                   | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [शॉर्टकट अनुकूलित करें और रीडर इंटरैक्शन बेहतर करें](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1)      | [@reycn](https://github.com/reycn) |

## त्वरित शुरुआत

<table width="100%">
  <thead>
    <tr>
      <th width="10%">प्लेटफ़ॉर्म</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>स्क्रीनशॉट</td>
      <td><img src="preview.png" alt="PDFMathReader रीडर" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader रीडर" width="100%"></td>
      <td><img src="preview-linux.png" alt="Linux पर PDFMathReader रीडर" width="100%"></td>
    </tr>
    <tr>
      <td>डाउनलोड लिंक</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>स्थापना</td>
      <td>macOS ZIP निकालें, <code>PDFMathReader.app</code> को <code>/Applications</code> में ले जाएँ और खोलें।</td>
      <td><code>PDFMathReader-win32-x64.exe</code> पर डबल-क्लिक करें (या 32-बिट Windows के लिए <code>ia32</code> संस्करण पर)।</td>
      <td>अपने CPU के लिए <code>.tar.gz</code> निकालें, फिर उसके फ़ोल्डर से <code>./PDFMathReader</code> चलाएँ।</td>
    </tr>
    <tr>
      <td>अतिरिक्त टिप्पणियाँ</td>
      <td>यदि macOS कहता है कि ऐप “damaged” है, तो डाउनलोड विश्वसनीय है इसकी पुष्टि करें, फिर Terminal में <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> चलाएँ। संकेत मिलने पर अपना Mac लॉगिन पासवर्ड दर्ज करें (यह प्रदर्शित नहीं होगा), फिर ऐप दोबारा खोलें।</td>
      <td>पोर्टेबल ऐप में उसका runtime शामिल है। इसे लॉन्च करने पर PDF <strong>Open with PDFMathReader</strong> मेनू पंजीकृत होता है; executable को स्थानांतरित करने के बाद इसे फिर लॉन्च करें।</td>
      <td>अपने CPU architecture से मेल खाने वाला package चुनें।</td>
    </tr>
  </tbody>
</table>
  *परीक्षण के लिए सीमित उपकरणों के कारण, Windows और Linux पर संगतता जाँच समय-समय पर की जाती है।*

## विकास

<details>
<summary>योगदान</summary>

- **उपकरण:** Bun निर्भरताओं और स्क्रिप्ट का प्रबंधन करता है; Vue/Vite UI बनाते हैं, जबकि Electron और Express Node.js पर चलते हैं। निर्भरताएँ बदलते समय `bun.lock` को कमिट करें।
- **परीक्षण:** `bun run build` चलाएँ, फिर `bun run test`; CI स्क्रिप्ट `node --test .github/scripts/*.test.*` का उपयोग करती हैं। व्यवहार में बदलावों के लिए लक्षित प्रतिगमन परीक्षण कवरेज जोड़ें; [परीक्षण प्राथमिकताएँ](testing.md) देखें।
- **CI:** **कोड शैली** फ़ॉर्मैटिंग और लिंट की जाँच करती है; **पैकेजिंग** macOS, Windows और Linux पर ऐप तैयार कर चलाती है। **रिलीज़** संस्करण बढ़ने पर सफल डिफ़ॉल्ट शाखा के पैकेज प्रकाशित करती है।
- **शैली:** कमिट करने से पहले `bun run style:fix` चलाएँ। Husky स्टेज की गई फ़ाइलों को अपने-आप फ़ॉर्मैट और जाँच करता है तथा अनसुलझी त्रुटियों को रोकता है। Prettier/ESLint JS और Vue, Ruff Python तथा swift-format Swift की जाँच करते हैं; [सेटअप और नियम](code-style.md) देखें।

</details>

<details>
<summary>स्थानीय विकास</summary>

[Bun 1.3.14](https://bun.sh/docs/installation) और Node.js 22.22.1 या उसके बाद का संस्करण स्थापित करें। स्रोत से डेस्कटॉप ऐप चलाने के लिए:

```sh
bun install --frozen-lockfile
bun run desktop
```

उपयुक्त प्लेटफ़ॉर्म पर बिल्ड करें:

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
bun run package:mac
# Windows
bun run package:win
```

फ़्रंटएंड लाइब्रेरी (Vue, MacVue और Fluent UI) बिल्ड निर्भरताएँ हैं: Vite उन्हें `dist` में शामिल करता है। सर्वर या Electron की मुख्य प्रक्रिया जिन Node निर्भरताओं का उपयोग करती है, वे रनटाइम निर्भरताएँ बनी रहती हैं। बिल्ड करने से पहले `bun install --frozen-lockfile` से इंस्टॉल करें; केवल उत्पादन निर्भरताओं वाला इंस्टॉल ऐप को बिल्ड या पैकेज नहीं कर सकता।

परिचय पृष्ठ पर GitHub Release की अद्यतन स्थिति, मैन्युअल जाँच बटन और स्वचालित जाँच स्विच (डिफ़ॉल्ट रूप से सक्षम) होते हैं। पैकेज किए गए ऐप स्टार्टअप के बाद और हर छह घंटे में विलंबित रूप से जाँच करते हैं; कोई प्रकाशित रिलीज़ न होने पर सामान्य रिक्त स्थिति दिखाई देती है। स्थिर संस्करण टैगों में `vX.Y.Z` या `X.Y.Z` का उपयोग होना चाहिए। संबंधित रिलीज़ फ़ाइलों में macOS के लिए `PDFMathReader-<platform>-<arch>.zip`, Windows के लिए `.exe` या Linux के लिए `.tar.gz` होते हैं। उपलब्ध अद्यतन संबंधित डाउनलोड खोलते हैं, या संसाधन न होने पर रिलीज़ पृष्ठ खोलते हैं; इंस्टॉलेशन उपयोगकर्ता को स्वयं करना होता है।

परिचय पृष्ठ ऐप्लिकेशन, इंस्टॉल किए गए कर्नेल और UV संस्करण दिखाता है। प्रत्येक Vite बिल्ड में `dist/build-info.json` पैकेज संस्करण और नवीनतम दस कन्वेंशनल `feat` कमिट (स्कोप किए गए और पीछे की संगतता तोड़ने वाले फ़ीचर सहित) शामिल करता है; रिलीज़ CI पूरा Git इतिहास चेकआउट करती है। इंस्टॉल किया गया ऐप इस स्नैपशॉट को Git या नेटवर्क ऐक्सेस के बिना पढ़ता है। Git के बिना स्रोत संग्रह से बनाए गए बिल्ड में अद्यतन सूची खाली होती है।

डिफ़ॉल्ट Electron पैकेज Express और PDF उपयोगिताओं को बैकएंड/मुख्य स्क्रिप्ट में बंडल करता है और उनके लाइसेंस सुरक्षित रखता है। स्टेज किए गए `node_modules` में केवल बाहरी रनटाइम मॉड्यूल कॉपी किए जाते हैं; नेटिव PDF Inspector बाइंडिंग और असमर्थित नेटिव लक्ष्यों के लिए PDF.js/DOMMatrix फ़ॉलबैक उपलब्ध रहते हैं। Electron स्वयं और पैकेजिंग टूल बिल्ड टूलचेन उपलब्ध कराता है।

ब्राउज़र विकास के लिए `OPENAI_API_KEY` सेट करें, `bun run dev` चलाएँ और [127.0.0.1:5173](http://127.0.0.1:5173) खोलें। डिफ़ॉल्ट मॉडल को बदलने के लिए `OPENAI_MODEL` का उपयोग करें। डेस्कटॉप पर्यावरण चर `Launch PDFMathReader.command` से लोड किए जा सकते हैं।

```sh
bun run test
bun run build
```

ऐप्लिकेशन सूट में 29 जोखिम-केंद्रित परीक्षण हैं। रखे गए कवरेज और नए मामले जोड़ने की नीति के लिए [परीक्षण प्राथमिकताएँ](testing.md) देखें।

</details>

<details>
<summary>विवरण</summary>

PDFMathReader रीडर के लिए Vue 3 और PDF.js, डेस्कटॉप ऐप के लिए Electron और स्थानीय बैकएंड के लिए Express का उपयोग करता है। Vite फ़्रंटएंड विकास और बिल्ड का समर्थन करता है; pdf-lib PDF संशोधन संभालता है।

हर डेस्कटॉप विंडो में अपना रेंडरर और Electron यूटिलिटी प्रक्रिया में चलने वाला बैकएंड होता है। मुख्य प्रक्रिया विंडो, मेनू, क्रेडेंशियल, हाल के दस्तावेज़ और प्राथमिकताएँ संभालती है। सैंडबॉक्स किया हुआ preload डेस्कटॉप IPC उपलब्ध कराता है; बैकएंड अनुरोध `127.0.0.1` पर प्रमाणित HTTP का उपयोग करते हैं।

रेंडरिंग, लेआउट विश्लेषण और अनुवाद स्वतंत्र रूप से चलते हैं। पृष्ठ और थंबनेल वर्चुअलाइज़ किए जाते हैं, PDF.js और लेआउट विश्लेषण आवश्यकता पड़ने पर लोड होते हैं, और रेंडरिंग कैश का मेमोरी उपयोग सीमित रहता है। प्रत्येक दस्तावेज़ उसके स्थानीय बैकएंड पर एक बार अपलोड होता है; बाद के अनुरोध उसकी दस्तावेज़ ID का उपयोग करते हैं। दस्तावेज़, भाषा या कर्नेल बदलने पर पुराना अनुवाद कार्य रद्द कर दिया जाता है।

अनुवादित पाठ दस्तावेज़ों और ऐप के पुनः आरंभ होने के बाद भी कैश में रहता है। उसी सेवा और मॉडल के लिए एक जैसे अनुरोध सहेजे गए परिणाम का पुनः उपयोग करते हैं, जिनमें गणित-अनुवाद कर्नेल से आने वाले अनुरोध भी शामिल हैं। भाषाएँ, प्रॉम्प्ट और अनुवाद के अन्य विकल्प कैश कुंजी का हिस्सा रहते हैं। एक साथ आने वाले एक जैसे अनुरोध एक ही सेवा कॉल साझा करते हैं; विफल या रिक्त प्रतिक्रियाएँ कैश नहीं की जातीं।

| सेटिंग   | इंजन                  | आउटपुट                                         |
| -------- | --------------------- | ---------------------------------------------- |
| अति तेज़ | PDF Inspector         | मूल PDF पर पैराग्राफ़ ओवरले                    |
| तेज़     | PDFMathTranslate      | सूत्रों को सुरक्षित रखने वाले अनूदित PDF पृष्ठ |
| सटीक     | PDFMathTranslate-next | अधिक विस्तृत टाइपसेटिंग वाले अनूदित PDF पृष्ठ  |

PDF रेंडरिंग और लेआउट विश्लेषण स्थानीय रहते हैं। अनुवाद दस्तावेज़ का पाठ OpenAI को भेजता है और API शुल्क लग सकते हैं। तेज़ और सटीक मोड अलग-अलग ऐप-प्रबंधित Python वातावरण में चलते हैं, जिन्हें `uv` से इंस्टॉल किया जाता है और जो बैकएंड प्रॉक्सी के माध्यम से OpenAI तक पहुँचते हैं। API कुंजियाँ रेंडरर के बाहर रहती हैं।

सहेजी गई डेस्कटॉप कुंजियाँ Electron `safeStorage` और macOS Keychain सुरक्षा से एन्क्रिप्ट की जाती हैं। सहेजी गई कुंजी `OPENAI_API_KEY` को अधिलेखित करती है; उसे साफ़ करने पर पर्यावरणीय फ़ॉलबैक बहाल हो जाता है। सुरक्षित स्टोरेज उपलब्ध न होने पर सहेजना अक्षम रहता है।

डेस्कटॉप डेटा ऐप निर्देशिका में `~/Library/Application Support/` के अंतर्गत रखा जाता है: क्रेडेंशियल, हाल के दस्तावेज़, अनुवाद/लेआउट कैश और कर्नेल वातावरण। ब्राउज़र-विकास कैश `.cache/translations/` का उपयोग करते हैं। कैश और अस्थायी PDF में दस्तावेज़ की सामग्री हो सकती है; आरंभ पृष्ठ पर **Clear** केवल हाल के दस्तावेज़ों का इतिहास हटाता है।

ब्राउज़र विकास में Express और Vite एक स्वतंत्र Node.js प्रक्रिया में चलते हैं। नेटिव मेनू, डेस्कटॉप IPC और सुरक्षित डेस्कटॉप कुंजी संग्रहण केवल डेस्कटॉप ऐप में उपलब्ध हैं।

</details>

<details>
<summary>सीमाएँ</summary>

- **प्लेटफ़ॉर्म समर्थन:** macOS परीक्षित प्लेटफ़ॉर्म है। Windows और Linux में प्लेटफ़ॉर्म-विशिष्ट शैलियाँ हैं, लेकिन नेटिव रनटाइम सत्यापन लंबित है। पैकेजिंग कमांड macOS arm64 और Windows x64 को लक्ष्य बनाते हैं।
- **लेआउट की सटीकता:** अति तेज़ मोड ज्यामितीय पैराग्राफ़ समूहकरण और पाठ ओवरले का उपयोग करता है। जटिल तालिकाएँ, घुमाया हुआ पाठ, असामान्य पृष्ठभूमियाँ और लंबे अनुवाद मूल टाइपोग्राफ़ी बनाए न रख सकें। गणित-कर्नेल का आउटपुट अपस्ट्रीम लेआउट प्रबंधन पर निर्भर करता है।
- **स्कैन किए गए दस्तावेज़:** स्कैन किए गए PDF के लिए OCR चाहिए, जिसे यह ऐप लागू नहीं करता।
- **अनुवाद की आवश्यकताएँ:** अनुवाद के लिए OpenAI API कुंजी और नेटवर्क ऐक्सेस चाहिए। तेज़ और सटीक मोड के लिए `uv` के माध्यम से अलग गणित कर्नेल इंस्टॉल करने पड़ते हैं।
- **दायरा:** यह स्थानीय रीडर और अनुवाद ऐप है, पूर्ण PDF संपादन या निर्यात टूल नहीं है।
- **सत्यापन:** [30 मुख्य प्रतिगमन परीक्षण](core-tests.md) बैकएंड और रीडर सहायता तर्क को कवर करते हैं। मॉक-प्रदाता जाँचें लाइव OpenAI अनुवाद गुणवत्ता या API-कुंजी की वैधता सिद्ध नहीं करती हैं।

</details>

## शोध-पत्र

इस कार्य के kernel को [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) (EMNLP 2025) में स्वीकार किया गया है।

उद्धरण:

```
@inproceedings{ouyang-etal-2025-pdfmathtranslate,
	    title = "{PDFM}ath{T}ranslate: Scientific Document Translation Preserving Layouts",
	    author = "Ouyang, Rongxin  and
	      Chu, Chang  and
	      Xin, Zhikuang  and
	      Ma, Xiangyao",
	    editor = {Habernal, Ivan  and
	      Schulam, Peter  and
	      Tiedemann, J{\"o}rg},
	    booktitle = "Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations",
	    month = nov,
	    year = "2025",
	    address = "Suzhou, China",
	    publisher = "Association for Computational Linguistics",
	    url = "https://aclanthology.org/2025.emnlp-demos.71/",
	    pages = "918--924",
	    ISBN = "979-8-89176-334-0",
	    abstract = "Language barriers in scientific documents hinder the diffusion and development of science and technologies. However, prior efforts in translating such documents largely overlooked the information in layouts. To bridge the gap, we introduce PDFMathTranslate, the world{'}s first open-source software for translating scientific documents while preserving layouts. Leveraging the most recent advances in large language models and precise layout detection, we contribute to the community with key improvements in precision, flexibility, and efficiency. The work is open-sourced at https://github.com/byaidu/pdfmathtranslate with more than 222k downloads."
	}
```

## लाइसेंस

PDFMathReader GNU Affero General Public License, version 3 के अंतर्गत licensed है। पूरी जानकारी के लिए [LICENSE](../LICENSE) देखें। Dependencies अपने-अपने licenses बनाए रखती हैं।

## आभार

सहयोग के लिए [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/) और [SiliconFlow](https://siliconflow.cn/) का बहुत-बहुत धन्यवाद।
