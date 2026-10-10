[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md)

# <img src="icon.png" alt="PDFMathReader 应用图标" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

在任何平台上，通过实时翻译阅读任何语言的科学文档。由 [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) 提供支持。

<img src="demo.gif" alt="演示" width="100%">

## 功能

- **保留排版**：保留公式、表格和关键信息，同时让翻译后的页面尽可能接近原始布局。
- **实时翻译**：阅读时检测版面并进行翻译，无需等待整份文档处理完成。
- **界面语言**：支持 16 种语言，按英文国家名称排序，默认使用英语。包括阿拉伯语、埃及阿拉伯语、印地语、孟加拉语、俄语、葡萄牙语、乌尔都语、德语和尼日利亚皮钦语。
- **翻译选项**：选择翻译引擎、服务和语言，以及整份文档或邻近页面翻译。
- **双语阅读**：点击检测出的段落即可在原文与译文之间切换。
- **灵活导航**：支持缩略图、缩放、纵向或横向滚动，以及单页、双页或四页布局。
- **多个文档**：在独立窗口中打开 PDF，重新打开时恢复阅读位置和显示设置。
- **阅读链接**：保存搜索结果与其阅读来源之间的双向链接，方便查阅。
- **高亮和批注**：高亮重点段落并添加批注，记录阅读笔记。
- **文件操作**：在 macOS 上在 Finder 中显示原始或完整翻译后的 PDF，并通过 AirDrop 发送；在 Windows 上在文件资源管理器中显示原始或完整翻译后的 PDF，并打开原生 Windows 共享面板。

## 最近更新

| 日期       | 功能                                                                                                                                            | 贡献者                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-10 | [新增九种界面语言](https://github.com/PDFMathTranslate/PDFMathReader/commit/041a09d7d9bb1035715bcc2adbb74e6fae8b391e)                           | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [在 macOS 上新增 Finder 和 AirDrop 文件操作](https://github.com/PDFMathTranslate/PDFMathReader/commit/218541d7ad70ba7fb42ed4321b8d470492391073) | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [新增实验性的 Jev 文档语言检查](https://github.com/PDFMathTranslate/PDFMathReader/commit/00d5afbfe58b4ef689c6619c8b6c6f0faf671031)              | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [在内核启动前恢复翻译页面](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386)                   | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [改进阅读布局和翻译行为](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe)                     | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [新增液态玻璃和翻译重新聚焦](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)                 | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [自定义快捷键并优化阅读器交互](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1)               | [@reycn](https://github.com/reycn) |

## 快速开始

<table width="100%">
  <thead>
    <tr>
      <th width="10%">平台</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>截图</td>
      <td><img src="preview.png" alt="PDFMathReader 阅读器" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader 阅读器" width="100%"></td>
      <td><img src="preview-linux.png" alt="Linux 上的 PDFMathReader 阅读器" width="100%"></td>
    </tr>
    <tr>
      <td>下载链接</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>安装</td>
      <td>解压 macOS ZIP，将 <code>PDFMathReader.app</code> 移到 <code>/Applications</code>，然后打开。</td>
      <td>双击 <code>PDFMathReader-win32-x64.exe</code>（32 位 Windows 使用 <code>ia32</code> 版本）。</td>
      <td>解压与你的 CPU 匹配的 <code>.tar.gz</code>，然后在其文件夹中运行 <code>./PDFMathReader</code>。</td>
    </tr>
    <tr>
      <td>补充说明</td>
      <td>若 macOS 提示应用“已损坏”，确认下载来源可信后，在终端运行 <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code>。按提示输入 Mac 登录密码（不会显示），然后重新打开应用。</td>
      <td>便携版包含运行时。启动它会注册 PDF 的 <strong>Open with PDFMathReader</strong> 菜单；移动可执行文件后，再次启动它。</td>
      <td>选择与你的 CPU 架构匹配的软件包。</td>
    </tr>
  </tbody>
</table>
  *由于用于测试的设备有限，Windows 和 Linux 的兼容性检查会定期进行。*

## 开发

<details>
<summary>贡献</summary>

- **工具链：** Bun 管理依赖和脚本；Vue/Vite 构建 UI，Electron 和 Express 在 Node.js 上运行。更改依赖时提交 `bun.lock`。
- **测试：** 运行 `bun run build`，然后运行 `bun run test`；CI 脚本使用 `node --test .github/scripts/*.test.*`。行为变更应增加有针对性的回归覆盖；参见[测试重点](testing.md)。
- **CI：** **代码风格**检查格式和 lint；**打包**在 macOS、Windows 和 Linux 上构建并启动应用。**发布**在版本增加时发布默认分支构建成功的软件包。
- **代码风格：** 提交前运行 `bun run style:fix`。Husky 会自动格式化并检查暂存文件，阻止未解决的错误。Prettier/ESLint 覆盖 JS 和 Vue，Ruff 覆盖 Python，swift-format 覆盖 Swift；参见[设置与规则](code-style.md)。

</details>

<details>
<summary>本地开发</summary>

安装 [Bun 1.3.14](https://bun.sh/docs/installation) 和 Node.js 22.22.1 或更高版本。要从源码运行桌面应用：

```sh
bun install --frozen-lockfile
bun run desktop
```

在匹配的平台上构建：

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
bun run package:mac
# Windows
bun run package:win
```

前端库（Vue、MacVue 和 Fluent UI）是构建依赖：Vite 会将它们包含在 `dist` 中。服务器或 Electron 主进程使用的 Node 依赖仍是运行时依赖。构建前请使用 `bun install --frozen-lockfile` 安装；仅安装生产依赖无法构建或打包应用。

“关于”页面包含 GitHub Release 更新状态、手动检查按钮和自动检查开关（默认启用）。打包后的应用会在启动后延迟检查，并每六小时检查一次；没有已发布版本时会显示正常的空状态。稳定版本标签必须使用 `vX.Y.Z` 或 `X.Y.Z`。匹配的发布资源使用 `PDFMathReader-<platform>-<arch>.zip`（macOS）、`.exe`（Windows）或 `.tar.gz`（Linux）。有可用更新时会打开匹配的下载；若缺少该资源，则打开发布页面；安装仍需手动完成。

“关于”页面显示应用、已安装内核和 UV 版本。每次 Vite 构建都会将软件包版本和最新 10 个约定式 `feat` 提交（包括带作用域和破坏性特性的提交）写入 `dist/build-info.json`；发布 CI 会检出完整 Git 历史。已安装的应用无需 Git 或网络访问即可读取此快照。从不含 Git 的源代码归档构建时，更新列表为空。

默认 Electron 软件包会将 Express 和 PDF 工具打包进后端/主进程脚本，并保留其许可证。它只会将外部运行时模块复制到暂存的 `node_modules` 中；PDF Inspector 原生绑定，以及不受支持的原生目标所需的 PDF.js/DOMMatrix 回退仍可用。Electron 本身和打包工具由构建工具链提供。

进行浏览器开发时，设置 `OPENAI_API_KEY`，运行 `bun run dev`，然后打开 [127.0.0.1:5173](http://127.0.0.1:5173)。使用 `OPENAI_MODEL` 覆盖默认模型。桌面环境变量可以通过 `Launch PDFMathReader.command` 加载。

```sh
bun run test
bun run build
```

应用套件包含 29 个以风险为重点的测试。有关保留的覆盖范围和添加测试用例的政策，请参见[测试重点](testing.md)。

</details>

<details>
<summary>详情</summary>

PDFMathReader 使用 Vue 3 和 PDF.js 构建阅读器，使用 Electron 构建桌面应用，并使用 Express 提供本地后端。Vite 支持前端开发和构建；pdf-lib 负责 PDF 操作。

每个桌面窗口都有自己的渲染器和运行在 Electron utility process 中的后端。主进程管理窗口、菜单、凭据、最近文档和偏好设置。沙盒化的 preload 提供桌面 IPC；后端请求在 `127.0.0.1` 上使用经过身份验证的 HTTP。

渲染、版面分析和翻译独立运行。页面和缩略图经过虚拟化，PDF.js 和版面分析按需加载，渲染缓存的内存使用有上限。每份文档只上传到本地后端一次；后续请求使用其文档 ID。当文档、语言或内核发生变化时，过时的翻译工作会被取消。

翻译文本会跨文档和应用重启进行缓存。对同一服务和模型的相同请求会复用已保存的结果，包括数学翻译内核发出的请求。语言、提示词和其他翻译选项都会成为缓存键的一部分。并发的相同请求会共享一次服务调用；失败或空响应不会被缓存。

| 设置       | 引擎                  | 输出                        |
| ---------- | --------------------- | --------------------------- |
| Ultra fast | PDF Inspector         | 在原始 PDF 上覆盖段落译文   |
| Fast       | PDFMathTranslate      | 保留公式的翻译后 PDF 页面   |
| Precise    | PDFMathTranslate-next | 排版更细致的翻译后 PDF 页面 |

PDF 渲染和版面分析保持在本地。翻译会将文档文本发送给 OpenAI，可能产生 API 费用。Fast 和 Precise 在通过 `uv` 安装、由应用管理的独立 Python 环境中运行，并通过后端代理访问 OpenAI。API 密钥不会进入渲染器。

保存的桌面密钥使用 Electron `safeStorage` 和 macOS 钥匙串保护进行加密。保存的密钥会覆盖 `OPENAI_API_KEY`；清除它后会恢复使用环境变量回退值。安全存储不可用时，保存功能会被禁用。

桌面数据存储在 `~/Library/Application Support/` 下的应用目录中，包括凭据、最近文档、翻译和版面缓存以及内核环境。浏览器开发缓存使用 `.cache/translations/`。缓存和临时 PDF 可能包含文档内容；起始页上的 **Clear** 只会移除最近文档历史。

浏览器开发模式下，Express 和 Vite 在独立的 Node.js 进程中运行。原生菜单、桌面 IPC 和安全的桌面密钥存储仅在桌面应用中可用。

</details>

<details>
<summary>限制</summary>

- **平台支持：** macOS 是经过测试的平台。Windows 和 Linux 具有平台专用样式，但原生运行时验证仍在等待。打包命令面向 macOS arm64 和 Windows x64。
- **版面保真度：** Ultra fast 使用几何段落分组和文本覆盖层。复杂表格、旋转文本、特殊背景和较长的翻译可能无法保留原始排版。数学内核的输出取决于上游的版面处理。
- **扫描文档：** 扫描 PDF 需要 OCR，而本应用尚未实现 OCR。
- **翻译要求：** 翻译需要 OpenAI API 密钥和网络访问。Fast 和 Precise 需要通过 `uv` 单独安装数学内核。
- **范围：** 这是本地阅读和翻译应用，不是完整的 PDF 编辑或导出工具。
- **验证：** [30 个核心回归测试](core-tests.md)覆盖后端和阅读器支持逻辑。模拟服务提供方的检查无法证明真实的 OpenAI 翻译质量或 API 密钥有效性。

</details>

## 论文

本项目内核的相关工作已被 [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) 接收（EMNLP 2025）。

引用：

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

## 许可证

PDFMathReader 根据 GNU Affero General Public License 第 3 版授权。完整文本见 [LICENSE](../LICENSE)。依赖项保留各自的许可证。

## 致谢

感谢 [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[Immersive Translate](https://immersivetranslate.com/) 和 [SiliconFlow](https://siliconflow.cn/) 提供支持。
