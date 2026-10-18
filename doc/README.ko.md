<img src="banner.jpg" alt="데모" width="100%">

[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md) · [한국어](README.ko.md)

# <img src="icon.png" alt="PDFMathReader 앱 아이콘" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

원하는 언어로 모든 플랫폼에서 과학 문서를 실시간으로 읽으세요.<br>
최첨단 인공지능을 활용하는 [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate)로 구동됩니다.

## 기능

- **레이아웃을 유지한 번역 문서 읽기**: 수식, 표 및 기타 필수 콘텐츠를 그대로 유지합니다.
- **기다리지 않고 읽기 시작**: 읽는 동안 레이아웃을 감지하고 콘텐츠를 번역합니다.
- **선호하는 언어로 읽기**: 다양한 인터페이스 언어, 원문 언어 및 대상 언어 중에서 선택하고 추가로 사용자 지정할 수 있습니다.
- **선호하는 번역 서비스 선택**:
  - 주요 AI 공급자에 연결합니다.
  - OpenAI 호환 API를 통해 사용자 지정 서비스를 사용합니다.
  - 파트너십을 통한 무료 번역으로 다국어 독서를 더 쉽게 이용할 수 있습니다.
- **읽으며 메모 유지**: 원문과 번역문에서 구절을 강조하고 주석을 추가합니다.
- **효율적으로 탐색**:
  - 썸네일, 빠른 링크, 검색, 개요, 페이지 번호 및 갤러리 보기로 문서를 살펴봅니다.
  - 여러 읽기 레이아웃 중에서 선택합니다.
  - 창과 탭에서 작업을 정리합니다.
- **읽기 환경 맞춤 설정**:
  - 주제문, 과학적 발견 및 논리적 연결을 자동으로 강조합니다.
  - 작업 흐름에 맞게 번역 동작을 조정합니다.
  - 글꼴, 아이콘, 강조 색상 및 다크 모드를 사용자 지정합니다.
  - 레이아웃 감지 속도와 품질 사이의 균형을 조정합니다.
  - 부드러운 스크롤을 활성화합니다.
- **텍스트를 더 쉽게 따라가기**:
  - TF-IDF 가중치로 특징적인 용어를 강조합니다.
  - 고정 길이 또는 단어 어근 강조를 사용하는 바이오닉 리딩을 활성화합니다.
- **열린 작업 흐름 유지**: 애플리케이션과 기기 간에 파일을 공유하고 편집하세요. 예를 들어 AirDrop으로 모바일 기기에서 계속 읽을 수 있습니다.
- **플랫폼 전반에서 익숙한 인터페이스 사용**: macOS, Windows, Linux 및 iOS에서 읽습니다.

## 한눈에 보기

<img src="demo.gif" alt="데모" width="100%">

## 최근 업데이트

| 날짜       | 기능                                                                                                                                                             | 기여자                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-17 | [동반 기기 페어링 코드를 8자로 단축](https://github.com/PDFMathTranslate/PDFMathReader/commit/5bec25f69a04c0a7cb8811f1faed6ada1a84ba52)                          | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [마우스 전용 옵션을 추가해 부드러운 스크롤 강제](https://github.com/PDFMathTranslate/PDFMathReader/commit/b90ebdd8f2311d1060af6882ea20bc1c90404a8f)              | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [Art 및 Zotero 앱 아이콘을 추가하고 최신 아이콘을 새로 고침](https://github.com/PDFMathTranslate/PDFMathReader/commit/ea8fc7a0787fe67788e6501d5fffba02f6869e76)  | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [창이 최소화된 동안에도 서비스 모드에서 번역 계속](https://github.com/PDFMathTranslate/PDFMathReader/commit/b77dccaaefd92cfd145781c1b9164b67f02adf2b)            | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [원격 기기와 커널을 공유하고 연결된 클라이언트 표시](https://github.com/PDFMathTranslate/PDFMathReader/commit/6ecb48f5759d1eda69470c54d6236cbbe43b8204)          | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [Cmd+C로 선택 영역 또는 포커스된 주석을 복사하고 토스트 표시](https://github.com/PDFMathTranslate/PDFMathReader/commit/b9e5cc82b22dee2ae35160df31db9dadace538ac) | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [모양 설정에 앱 아이콘 선택기 추가](https://github.com/PDFMathTranslate/PDFMathReader/commit/729755524d0e3cf3464d0ebbf0020e8fb9ddf90d)                           | [@reycn](https://github.com/reycn) |

## 빠른 시작

### 데스크톱

<table width="100%">
  <thead>
    <tr>
      <th width="10%">플랫폼</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>스크린샷</td>
      <td><img src="preview.png" alt="PDFMathReader 리더" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader 리더" width="100%"></td>
      <td><img src="preview-linux.png" alt="Linux에서 실행 중인 PDFMathReader 리더" width="100%"></td>
    </tr>
    <tr>
      <td>다운로드 링크</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>설치</td>
      <td>macOS ZIP 파일의 압축을 풀고 <code>PDFMathReader.app</code>을 <code>/Applications</code>로 옮긴 다음 엽니다.</td>
      <td><code>PDFMathReader-win32-x64.exe</code>를 두 번 클릭합니다 (32비트 Windows에서는 <code>ia32</code> 버전).</td>
      <td>CPU에 맞는 <code>.tar.gz</code> 파일의 압축을 푼 다음 해당 폴더에서 <code>./PDFMathReader</code>를 실행합니다.</td>
    </tr>
    <tr>
      <td>추가 참고</td>
      <td>macOS에서 앱이 “damaged”라고 표시되면 다운로드가 신뢰할 수 있는지 확인한 다음 터미널에서 <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code>을 실행합니다. 요청되면 Mac 로그인 암호를 입력하세요(암호는 표시되지 않음). 그런 다음 앱을 다시 엽니다.</td>
      <td>포터블 앱에는 런타임이 포함되어 있습니다. 앱을 실행하면 PDF <strong>Open with PDFMathReader</strong> 메뉴가 등록됩니다. 실행 파일을 옮긴 후 앱을 다시 실행하세요.</td>
      <td>CPU 아키텍처에 맞는 패키지를 선택합니다.</td>
    </tr>
  </tbody>
</table>
  *테스트에 사용할 수 있는 장치가 제한되어 있어 Windows와 Linux의 호환성 검사는 주기적으로 수행됩니다(기여 환영).*

### 모바일

- **iOS**: [이 저장소에서 제공](https://github.com/PDFMathTranslate/PDFMathReader-iOS)되며 데스크톱 클라이언트와 익숙한 디자인을 제공합니다.
- **Android**: (기여 환영)

## 개발

<details>
<summary>기여하기</summary>

- **도구:** Bun이 의존성과 스크립트를 관리하고, Vue/Vite가 UI를 빌드하며, Electron과 Express는 Node.js에서 실행됩니다. 의존성을 변경할 때는 `bun.lock`을 커밋하세요.
- **테스트:** `bun run build`를 실행한 다음 `bun run test`를 실행합니다. CI 스크립트는 `node --test .github/scripts/*.test.*`를 사용합니다. 동작을 변경할 때는 관련 회귀 테스트를 추가하세요. [테스트 우선순위](testing.md)를 참고하세요.
- **CI:** **코드 스타일**은 포맷팅과 린트를 검사하고, **패키징**은 macOS, Windows 및 Linux에서 앱을 빌드하고 실행합니다. **릴리스**는 버전이 올라가면 기본 브랜치의 성공한 패키지를 게시합니다.
- **스타일:** 커밋하기 전에 `bun run style:fix`를 실행하세요. Husky는 스테이징된 파일을 자동으로 포맷하고 검사하며, 해결되지 않은 오류가 있으면 작업을 중단합니다. Prettier/ESLint는 JS와 Vue를, Ruff는 Python을, swift-format은 Swift를 검사합니다. [설정 및 규칙](code-style.md)을 참고하세요.

</details>

<details>
<summary>로컬 개발</summary>

[Bun 1.3.14](https://bun.sh/docs/installation)와 Node.js 22.22.1 이상을 설치하세요. 소스에서 데스크톱 앱을 실행하려면:

```sh
bun install --frozen-lockfile
bun run desktop
```

해당 플랫폼에서 빌드하세요:

```sh
# macOS (서명 ID 필요; 서명을 건너뛰려면 --unsigned 추가)
bun run package:mac
# Windows
bun run package:win
```

프런트엔드 라이브러리(Vue, MacVue 및 Fluent UI)는 빌드 의존성입니다. Vite가 이를 `dist`에 포함합니다. 서버나 Electron 메인 프로세스에서 사용하는 Node 의존성은 런타임 의존성으로 유지됩니다. 빌드하기 전에 `bun install --frozen-lockfile`로 설치하세요. 프로덕션 전용 설치로는 앱을 빌드하거나 패키징할 수 없습니다.

About 페이지에는 GitHub Release 업데이트 상태, 수동 확인 버튼 및 자동 확인 스위치(기본적으로 활성화)가 있습니다. 패키징된 앱은 시작 후와 6시간마다 지연 방식으로 확인합니다. 게시된 릴리스가 없으면 일반적인 빈 상태가 표시됩니다. 안정 버전 태그는 `vX.Y.Z` 또는 `X.Y.Z` 형식이어야 합니다. 해당 릴리스 자산은 macOS의 경우 `PDFMathReader-<platform>-<arch>.zip`, Windows의 경우 `.exe`, Linux의 경우 `.tar.gz`를 사용합니다. 사용 가능한 업데이트가 있으면 해당 다운로드를 열고, 자산이 없으면 릴리스 페이지를 엽니다. 설치는 수동으로 진행합니다.

About 페이지에는 애플리케이션, 설치된 커널 및 UV 버전이 표시됩니다. 각 Vite 빌드는 패키지 버전과 최신 일반 `feat` 커밋 10개(스코프가 지정된 기능 및 주요 변경 기능 포함)를 `dist/build-info.json`에 포함합니다. 릴리스 CI는 전체 Git 기록을 체크아웃합니다. 설치된 앱은 Git이나 네트워크에 접근하지 않고 이 스냅샷을 읽습니다. Git이 없는 소스 아카이브에서 빌드하면 업데이트 목록이 비어 있습니다.

기본 Electron 패키지는 Express와 PDF 유틸리티를 백엔드/메인 스크립트에 번들로 포함하면서 해당 라이선스를 유지합니다. 스테이징된 `node_modules`에는 외부 런타임 모듈만 복사됩니다. 네이티브 PDF Inspector 바인딩과 지원되지 않는 네이티브 대상용 PDF.js/DOMMatrix 폴백은 계속 사용할 수 있습니다. Electron 자체와 패키징 도구는 빌드 도구 체인에서 제공합니다.

브라우저 개발을 위해 `OPENAI_API_KEY`를 설정하고 `bun run dev`를 실행한 다음 [127.0.0.1:5173](http://127.0.0.1:5173)을 여세요. 기본 모델을 재정의하려면 `OPENAI_MODEL`을 사용하세요. 데스크톱 환경 변수는 `Launch PDFMathReader.command`로 불러올 수 있습니다.

```sh
bun run test
bun run build
```

애플리케이션 테스트 모음에는 위험에 초점을 둔 테스트 29개가 포함되어 있습니다. 유지되는 커버리지와 사례 추가 정책은 [테스트 우선순위](testing.md)를 참고하세요.

</details>

<details>
<summary>세부 정보</summary>

PDFMathReader는 리더에 Vue 3와 PDF.js, 데스크톱 앱에 Electron, 로컬 백엔드에 Express를 사용합니다. Vite는 프런트엔드 개발과 빌드를 지원하고, pdf-lib는 PDF 조작을 처리합니다.

각 데스크톱 창에는 고유한 렌더러와 Electron 유틸리티 프로세스에서 실행되는 백엔드가 있습니다. 메인 프로세스는 창, 메뉴, 자격 증명, 최근 문서 및 환경 설정을 관리합니다. 샌드박스 처리된 preload가 데스크톱 IPC를 제공하고, 백엔드 요청은 `127.0.0.1`에서 인증된 HTTP를 사용합니다.

렌더링, 레이아웃 분석 및 번역은 독립적으로 실행됩니다. 페이지와 썸네일은 가상화되고, PDF.js와 레이아웃 분석은 필요할 때 로드되며, 렌더링 캐시는 메모리 사용량이 제한됩니다. 각 문서는 로컬 백엔드에 한 번 업로드되고, 이후 요청은 해당 문서 ID를 사용합니다. 문서, 언어 또는 커널이 변경되면 오래된 번역 작업은 취소됩니다.

번역 텍스트는 문서 간에 그리고 앱을 다시 시작한 후에도 캐시됩니다. 동일한 서비스와 모델에 대한 동일한 요청은 저장된 결과를 재사용하며, 수학 번역 커널에서 발생한 요청도 포함됩니다. 언어, 프롬프트 및 기타 번역 옵션은 캐시 키의 일부로 유지됩니다. 동시에 발생한 동일한 요청은 하나의 서비스 호출을 공유하고, 실패했거나 빈 응답은 캐시되지 않습니다.

| 설정       | 엔진                  | 출력                                    |
| ---------- | --------------------- | --------------------------------------- |
| Ultra fast | PDF Inspector         | 원본 PDF 위의 단락 오버레이             |
| Fast       | PDFMathTranslate      | 수식이 보존된 번역 PDF 페이지           |
| Precise    | PDFMathTranslate-next | 더 자세한 조판을 적용한 번역 PDF 페이지 |

실험적인 Jev 단락 이어짐 감지는 Ultra fast와 Fast에서 사용할 수 있습니다. Fast는 번역과 조판 전에 같은 열에서 이어지는 것으로 확인된 인접 조각을 결합하여 수식의 위치를 유지합니다. 확인이 불확실하거나 실패하면 조각을 분리된 상태로 유지합니다. 이 기능을 활성화하면 별도의 페이지 캐시를 사용하므로 이전에 병합되지 않은 출력이 다시 생성됩니다.

실험적 기능: Settings → Experimental → Generate table of contents는 Edit → Generate Table of Contents를 추가합니다. 이 기능은 책갈피가 없는 문서의 목차를 로컬에서 만들고 Contents 사이드바에 진행 상황을 표시합니다. 인쇄된 목차 페이지(점선 리더와 오른쪽 정렬된 페이지 번호 포함)를 분석하여 페이지 번호를 실제 페이지에 매핑합니다. 목차 페이지가 없으면 글꼴 크기, 번호 매기기 및 간격을 바탕으로 제목을 추론합니다. 어떤 데이터도 외부로 전송되지 않습니다. 텍스트 레이어가 없는 스캔 페이지는 지원되지 않으며, 생성된 목차는 문서와 함께 저장되지 않습니다.

실험적 기능: Precise는 원격 [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) 서버를 통해 HTTP로 번역할 수도 있습니다(Settings → Experimental). PDFMathReader는 해당 서버의 HTTP 프로토콜을 클라이언트로 구현합니다. 서버는 번들에 포함되지 않으며 선택 사항입니다. 서버의 `/health` 확인이 성공한 경우에만 원격 커널을 사용하고, 그렇지 않으면 로컬 Precise 커널을 실행합니다. API 키는 전송되지 않으며 서버는 자체 번역 서비스를 사용합니다. 원격 페이지에는 읽기 텍스트 레이어가 없고, 선택한 번역 서비스와 용어집은 원격으로 번역된 페이지에 사용되지 않습니다.

PDF 렌더링과 레이아웃 분석은 로컬에서 수행됩니다. 번역을 위해 문서 텍스트가 OpenAI로 전송되며 API 요금이 발생할 수 있습니다. Fast와 Precise는 `uv`로 설치된 앱 관리형 개별 Python 환경에서 실행되고 백엔드 프록시를 통해 OpenAI에 접근합니다. API 키는 렌더러 외부에 유지됩니다.

저장된 데스크톱 키는 Electron `safeStorage`로 암호화되고 macOS Keychain으로 보호됩니다. 저장된 키는 `OPENAI_API_KEY`를 재정의하며, 키를 지우면 환경 변수 폴백이 복원됩니다. 보안 저장소를 사용할 수 없으면 저장이 비활성화됩니다.

데스크톱 데이터는 `~/Library/Application Support/` 아래의 앱 디렉터리에 저장됩니다. 여기에는 자격 증명, 최근 문서, 번역/레이아웃 캐시 및 커널 환경이 포함됩니다. 브라우저 개발 캐시는 `.cache/translations/`를 사용합니다. 캐시와 임시 PDF에는 문서 내용이 포함될 수 있습니다. 시작 페이지의 **Clear**는 최근 문서 기록만 삭제합니다.

브라우저 개발에서는 Express와 Vite가 독립된 Node.js 프로세스에서 실행됩니다. 네이티브 메뉴, 데스크톱 IPC 및 보안 데스크톱 키 저장은 데스크톱 앱에서만 사용할 수 있습니다.

</details>

<details>
<summary>제한 사항</summary>

- **플랫폼 지원:** macOS가 테스트된 플랫폼입니다. Windows와 Linux에는 플랫폼별 스타일이 있지만 네이티브 런타임 검증은 아직 진행 중입니다. 패키징 명령은 macOS arm64와 Windows x64를 대상으로 합니다.
- **레이아웃 충실도:** Ultra fast는 기하학적 단락 그룹화와 텍스트 오버레이를 사용합니다. 복잡한 표, 회전된 텍스트, 특이한 배경 및 긴 번역은 원래 타이포그래피를 유지하지 못할 수 있습니다. 수학 커널의 출력은 업스트림 레이아웃 처리에 따라 달라집니다.
- **스캔 문서:** 스캔된 PDF에는 OCR이 필요하지만 이 앱은 OCR을 구현하지 않습니다.
- **번역 요구 사항:** 번역에는 OpenAI API 키와 네트워크 액세스가 필요합니다. Fast와 Precise에는 `uv`를 통해 별도로 설치한 수학 커널이 필요합니다.
- **범위:** 이 앱은 로컬 리더이자 번역 앱이며, 완전한 PDF 편집 또는 내보내기 도구는 아닙니다.
- **검증:** [핵심 회귀 테스트 30개](core-tests.md)가 백엔드와 리더 지원 로직을 다룹니다. 모의 제공자 검사는 실제 OpenAI 번역 품질이나 API 키의 유효성을 입증하지 않습니다.

</details>

## 논문

이 작업의 커널은 [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) (EMNLP 2025)에 채택되었습니다.

인용:

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

## 라이선스

PDFMathReader는 GNU Affero General Public License, version 3에 따라 라이선스가 부여됩니다. 전체 내용은 [LICENSE](../LICENSE)에서 확인하세요. 의존성은 각각의 라이선스를 유지하며, [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate), [PDFMathTranslate-next](https://github.com/PDFMathTranslate-next/PDFMathTranslate-next) 및 [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh)(AGPL-3.0, 선택적 원격 커널 프로토콜)가 포함됩니다.

## 감사의 말

지원해 주신 [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/) 및 [SiliconFlow](https://siliconflow.cn/)에 진심으로 감사드립니다.
