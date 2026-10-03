[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

# <img src="icon.png" alt="PDFMathReader 应用图标" style="height: 1em; width: auto;"> PDFMathReader（实验性）

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
  <a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
    <img src="https://img.shields.io/badge/contributions-welcome-green"></a>
  <a href="../LICENSE">
    <img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

在任何平台上，通过实时翻译阅读任何语言的科学文档。由 [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) 提供支持。

<img src="demo.gif" alt="演示" width="100%">

## 功能

- 在独立窗口中打开不超过 50 MiB 的 PDF，支持拖放及 macOS Finder/Dock 打开方式。
- 使用缩略图、缩放、适应页面、横向或纵向滚动，以及单页、双页或四页布局阅读。
- 重新打开最近文档时恢复阅读位置和显示设置。
- 选择整份文档或邻近页面翻译，单击已检测段落即可切换原文与译文。
- 在设置中调整翻译语言、并发数和内核选项；界面语言单独设置。

## 最近更新

| 日期 | 功能变更 | 贡献者 |
| --- | --- | --- |
| 2026-10-03 | [新增自定义菜单和左侧红黄绿窗口按钮](https://github.com/PDFMathTranslate/PDFMathReader/commit/b144cbfe577c1e6787b01edafb9cdf2b2043fa4f) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [提供可运行的 CI 安装包，改进阅读界面的布局动画](https://github.com/PDFMathTranslate/PDFMathReader/commit/04f76caf8fe966bb33721ad981d902de8cae62c8) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [缓存依赖、Electron 和图标，加快 CI 构建](https://github.com/PDFMathTranslate/PDFMathReader/commit/a9324f4cc40eb8585d760bda4d56f83bf62b74e2) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [改进 Windows 控件，新增页面适应快捷键](https://github.com/PDFMathTranslate/PDFMathReader/commit/04519de3448b5d707f8ecffd0fdabc695c2155ef) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [新增 Windows PDF 右键菜单和打开方式入口](https://github.com/PDFMathTranslate/PDFMathReader/commit/f4da6ea1d1ec225b333722703ab87b7010538305) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [改进段落分组、预览和文档动画](https://github.com/PDFMathTranslate/PDFMathReader/commit/46cf3fb126102ad507fa203dc4aa707f2c5f7769) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [新增 Intel Mac、32 位 Windows 和 Linux ARMv7 构建](https://github.com/PDFMathTranslate/PDFMathReader/commit/ed4b4567f381123cff49d20a710c2a94c034d81f) | [@reycn](https://github.com/reycn) |

## 快速开始

### 截图

| macOS | Windows | Linux |
| :---: | :---: | :---: |
| <img src="preview.png" alt="PDFMathReader 阅读界面" height="240"> | <img src="preview-windows.png" alt="PDFMathReader 阅读界面" height="240"> | <img src="preview-linux.png" alt="PDFMathReader Linux 阅读界面" height="240"> |

### 安装

从 [GitHub Actions](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml) 下载与你的系统和 CPU 匹配的包。先解压 Actions 下载的 ZIP。

<details>
<summary>macOS</summary>

解压 macOS ZIP，将 `PDFMathReader.app` 移到 `/Applications`，然后打开。

<details>
<summary>macOS 提示应用“已损坏”</summary>

确认应用来自可信来源后，在终端执行以下命令。按提示输入 Mac 登录密码（不会显示），然后重新打开应用：

```zsh
sudo xattr -dr com.apple.quarantine /Applications/PDFMathReader.app
```

</details>

</details>

<details>
<summary>Windows</summary>

双击 `PDFMathReader-win32-x64.exe`（32 位 Windows 使用 `ia32` 版本）。便携版自带运行时，启动后会注册 PDF 的 **Open with PDFMathReader** 右键菜单；移动可执行文件后，再启动一次以更新路径。

</details>

<details>
<summary>Linux</summary>

解压与你的 CPU 匹配的 `.tar.gz`，进入应用目录运行：

```sh
./PDFMathReader
```

</details>

打开 PDF，在 **Settings…** 中保存 OpenAI API 密钥并选择目标语言。阅读无需密钥，翻译需要。**Ultra fast** 已内置；使用 **Fast** 或 **Precise** 前，安装 `uv`，再在设置中点击 **Install kernel with uv**。

## 开发

<details>
<summary>本地开发</summary>

使用 Node.js 22，从源码启动桌面应用：

```sh
npm ci
npm run desktop
```

在对应平台构建：

```sh
# macOS（需要签名证书；可追加 --unsigned 跳过签名）
npm run package:mac
# Windows
npm run package:win
```

浏览器开发：设置 `OPENAI_API_KEY`，运行 `npm run dev`，打开 [127.0.0.1:5173](http://127.0.0.1:5173)。可用 `OPENAI_MODEL` 指定模型。桌面应用可通过 `Launch PDFMathReader.command` 加载环境变量。

```sh
npm test
npm run build
```

</details>

<details>
<summary>技术细节</summary>

PDFMathReader 使用 Vue 3 和 PDF.js 构建阅读界面，Electron 提供桌面运行环境，Express 提供本地后端，Vite 用于前端开发和构建，pdf-lib 用于 PDF 操作。

每个桌面窗口拥有独立渲染进程和运行在 Electron utility process 中的后端。主进程管理窗口、菜单、密钥、最近文档和偏好设置。桌面 IPC 通过沙盒预加载脚本提供，后端请求通过 `127.0.0.1` 上经过身份验证的 HTTP 通信。

渲染、版面分析和翻译独立运行。页面和缩略图按可见区域虚拟化，PDF.js 和版面分析按需加载，渲染缓存有内存上限。每份文档仅上传到本地后端一次，后续请求使用文档 ID。切换文档、语言或内核时取消过时的翻译任务。

| 设置选项 | 引擎 | 输出方式 |
| --- | --- | --- |
| Ultra fast | PDF Inspector | 在原 PDF 上覆盖段落译文 |
| Fast | PDFMathTranslate | 生成保留公式的翻译后 PDF 页面 |
| Precise | PDFMathTranslate-next | 生成排版处理更细致的翻译后 PDF 页面 |

PDF 渲染和版面分析在本地完成。翻译会将文档文本发送给 OpenAI，可能产生 API 费用。Fast 和 Precise 使用通过 `uv` 安装、由应用管理的独立 Python 环境，并通过后端代理访问 OpenAI。API 密钥不会传入渲染进程。

桌面密钥通过 Electron `safeStorage` 和 macOS 钥匙串保护加密保存。保存的密钥优先于 `OPENAI_API_KEY`，清除后恢复使用环境变量。安全存储不可用时禁用保存功能。

桌面数据保存在 `~/Library/Application Support/` 下的应用目录中，包括密钥、最近文档、翻译与版面缓存及内核环境。浏览器开发缓存位于 `.cache/translations/`。缓存和临时 PDF 可能包含文档内容；起始页的 **Clear** 仅清除最近文档历史。

浏览器开发模式在独立 Node.js 进程中运行 Express 和 Vite。原生菜单、桌面 IPC 和安全密钥存储仅在桌面应用中提供。

</details>

## 已知限制

- **平台支持：** 已测试的平台为 macOS。Windows 和 Linux 已有平台专用样式，但原生运行验证仍待完成。打包命令面向 macOS arm64 和 Windows x64。
- **版面保真：** Ultra fast 使用几何规则划分段落，并以文本覆盖层显示译文。复杂表格、旋转文本、特殊背景和较长译文可能无法保留原始排版。数学翻译内核的输出取决于上游版面处理能力。
- **扫描文档：** 扫描 PDF 需要 OCR，本应用尚未实现该功能。
- **翻译要求：** 翻译需要 OpenAI API 密钥和网络连接。Fast 和 Precise 需要通过 `uv` 另行安装数学翻译内核。
- **功能范围：** 这是一款实验性的本地阅读与翻译应用，并非完整的 PDF 编辑或导出工具。
- **验证范围：** 自动化测试覆盖后端和阅读器辅助逻辑。使用模拟服务的检查无法验证真实 OpenAI 翻译质量或 API 密钥是否有效。

## 许可证

PDFMathReader 采用 GNU Affero General Public License 第 3 版。完整条款见 [LICENSE](../LICENSE)。

PDFMathTranslate 和 PDFMathTranslate-next 也采用 AGPL-3.0 许可证。其运行时安装保留上游许可证文件；其他依赖保留各自的许可证。

非常感谢 [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[沉浸式翻译](https://immersivetranslate.com/)和[硅基流动](https://siliconflow.cn/)提供的支持。
