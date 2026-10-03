[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

# <img src="icon.png" alt="PDFMathReader 应用图标" style="height: 1em; width: auto;"> PDFMathReader（实验性）

在任何平台上，通过实时翻译阅读任何语言的科学文档。由 PDFMathTranslate 提供支持。

<img src="demo.gif" alt="演示" width="100%">

## 快速开始

### 运行桌面应用

<table>
  <tr>
    <th>macOS</th>
    <th>Windows</th>
    <th>Linux</th>
  </tr>
  <tr>
    <td><img src="preview.png" alt="PDFMathReader 阅读界面" height="240"></td>
    <td><img src="preview-windows.png" alt="PDFMathReader 阅读界面" height="240"></td>
    <td><img src="preview.png" alt="PDFMathReader 阅读界面" height="240"></td>
  </tr>
</table>

开发环境需要 Apple Silicon Mac 和 Node.js 22：

```zsh
npm install
npm run desktop
```

打开 PDF 后，通过 **Settings…** 或 **File → Preference** 打开设置。输入 OpenAI API 密钥并点击 **Save key**，再选择目标语言和翻译内核。阅读 PDF 和分析版面无需密钥；翻译需要密钥。

**Ultra fast** 已随应用提供。使用 **Fast** 或 **Precise** 前，请安装 `uv`，在设置中选择内核并点击 **Install kernel with uv**。每个数学翻译内核使用由应用管理的独立 Python 环境。检查可用性不会安装软件包或修改全局工具。

### 构建 macOS 应用

```zsh
npm run package:mac
```

打开 `release/PDFMathReader-darwin-arm64/PDFMathReader.app`。打包后的应用自带运行时和本地后端，无需另行安装 Node.js 或启动开发服务器。该打包命令生成未签名的 Apple Silicon 本地构建。

桌面应用也支持 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。从 Finder 启动通常不会继承终端环境变量。可使用 `Launch PDFMathReader.command`，按登录 shell 的配置启动打包后的应用。

### 浏览器开发

```zsh
read -s 'OPENAI_API_KEY?OpenAI API key: '; export OPENAI_API_KEY
npm run dev
```

打开 [127.0.0.1:5173](http://127.0.0.1:5173)。启动前可设置 `OPENAI_MODEL`，覆盖默认模型 `gpt-4.1-mini`。

检查后端和阅读器辅助逻辑，并构建前端：

```zsh
npm test
npm run build
```

## 功能

- 在独立窗口中打开不超过 50 MiB 的 PDF，支持拖放及 macOS Finder/Dock 打开方式。
- 使用缩略图、缩放、适应页面、横向或纵向滚动，以及单页、双页或四页布局阅读。
- 重新打开最近文档时恢复阅读位置和显示设置。
- 选择整份文档或邻近页面翻译，单击已检测段落即可切换原文与译文。
- 在设置中调整翻译语言、并发数和内核选项；界面语言单独设置。

## 技术细节

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
