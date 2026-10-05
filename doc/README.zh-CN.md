[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

# <img src="icon.png" alt="PDFMathReader 应用图标" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

在任何平台上，通过实时翻译阅读任何语言的科学文档。由 [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) 提供支持。

<img src="demo.gif" alt="演示" width="100%">

## 功能

- **保留排版**: 翻译时尽可能保留 PDF 的公式、表格和原有布局，保留关键信息。
- **实时翻译**: 阅读时实时检测布局并翻译，无须等待整份文档处理完成。
- **翻译配置**: 自由选择翻译内核、服务和语言，支持整份文档或邻近页面翻译。
- **双语阅读**: 单击已检测段落即可切换原文与译文，方便对照阅读。
- **灵活阅读**: 支持缩略图导航、缩放、横纵滚动及单页、双页、四页布局。
- **多文档管理**: 在独立窗口中打开 PDF，重新打开时恢复阅读位置和显示设置。
- **阅读链接**: 保存搜索结果与阅读起点之间的双向链接，方便往返查阅。
- **高亮和批注**: 高亮重点段落并添加批注，记录阅读笔记。

## 最近更新

| 日期       | 功能变更                                                                                                                                               | 贡献者                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 2026-10-03 | [新增自定义菜单和左侧红黄绿窗口按钮](https://github.com/PDFMathTranslate/PDFMathReader/commit/b144cbfe577c1e6787b01edafb9cdf2b2043fa4f)                | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [提供可运行的 CI 安装包，改进阅读界面的布局动画](https://github.com/PDFMathTranslate/PDFMathReader/commit/04f76caf8fe966bb33721ad981d902de8cae62c8)    | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [缓存依赖、Electron 和图标，加快 CI 构建](https://github.com/PDFMathTranslate/PDFMathReader/commit/a9324f4cc40eb8585d760bda4d56f83bf62b74e2)           | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [改进 Windows 控件，新增页面适应快捷键](https://github.com/PDFMathTranslate/PDFMathReader/commit/04519de3448b5d707f8ecffd0fdabc695c2155ef)             | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [新增 Windows PDF 右键菜单和打开方式入口](https://github.com/PDFMathTranslate/PDFMathReader/commit/f4da6ea1d1ec225b333722703ab87b7010538305)           | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [改进段落分组、预览和文档动画](https://github.com/PDFMathTranslate/PDFMathReader/commit/46cf3fb126102ad507fa203dc4aa707f2c5f7769)                      | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [新增 Intel Mac、32 位 Windows 和 Linux ARMv7 构建](https://github.com/PDFMathTranslate/PDFMathReader/commit/ed4b4567f381123cff49d20a710c2a94c034d81f) | [@reycn](https://github.com/reycn) |

## 快速开始

<table width="100%">
  <thead>
    <tr>
      <th width="10%">平台名称</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>运行截图</td>
      <td><img src="preview.png" alt="PDFMathReader 阅读界面" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader 阅读界面" width="100%"></td>
      <td><img src="preview-linux.png" alt="PDFMathReader Linux 阅读界面" width="100%"></td>
    </tr>
    <tr>
      <td>安装链接</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>安装方式</td>
      <td>解压 macOS ZIP，将 <code>PDFMathReader.app</code> 移到 <code>/Applications</code>，然后打开。</td>
      <td>双击 <code>PDFMathReader-win32-x64.exe</code>（32 位 Windows 使用 <code>ia32</code> 版本）。</td>
      <td>解压与你的 CPU 匹配的 <code>.tar.gz</code>，进入应用目录运行 <code>./PDFMathReader</code>。</td>
    </tr>
    <tr>
      <td>额外说明</td>
      <td>若提示应用“已损坏”，确认应用来自可信来源后，在终端执行 <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code>。按提示输入 Mac 登录密码（不会显示），然后重新打开应用。</td>
      <td>便携版自带运行时。启动后会注册 PDF 的 <strong>Open with PDFMathReader</strong> 右键菜单；移动可执行文件后，再启动一次以更新路径。</td>
      <td>选择与你的 CPU 架构匹配的包。</td>
    </tr>
  </tbody>
</table>

## 开发

<details>
<summary>贡献说明</summary>

- **脚手架：** Bun 管理依赖与脚本，Vue/Vite 构建界面，Electron 和 Express 使用 Node.js。依赖变更时同步提交 `bun.lock`。
- **测试：** 先运行 `bun run build`，再运行 `bun run test`；CI 脚本测试用 `node --test .github/scripts/*.test.*`。行为变更应补充针对性的回归测试，参见[测试原则](testing.md)。
- **CI：** **Code style** 检查格式与 lint；**Packaging** 在 macOS、Windows、Linux 构建并启动应用；**Release** 在版本递增后发布默认分支构建成功的安装包。
- **代码风格：** 提交前运行 `bun run style:fix`。Husky 会自动格式化并检查暂存文件，未解决的错误阻止提交。JS/Vue 使用 Prettier/ESLint，Python 使用 Ruff，Swift 使用 swift-format，参见[工具安装与规则](code-style.md)。

</details>

<details>
<summary>本地开发</summary>

运行前请先安装 Bun 1.3.14 和 Node.js 22.22.1 或更高版本，然后从源码启动桌面应用：

```sh
bun install --frozen-lockfile
bun run desktop
```

在对应平台构建：

```sh
# macOS（需要签名证书；可追加 --unsigned 跳过签名）
bun run package:mac
# Windows
bun run package:win
```

浏览器开发：设置 `OPENAI_API_KEY`，运行 `bun run dev`，打开 [127.0.0.1:5173](http://127.0.0.1:5173)。可用 `OPENAI_MODEL` 指定模型。桌面应用可通过 `Launch PDFMathReader.command` 加载环境变量。

```sh
bun run test
bun run build
```

</details>

<details>
<summary>技术细节</summary>

PDFMathReader 使用 Vue 3 和 PDF.js 构建阅读界面，Electron 提供桌面运行环境，Express 提供本地后端，Vite 用于前端开发和构建，pdf-lib 用于 PDF 操作。

每个桌面窗口拥有独立渲染进程和运行在 Electron utility process 中的后端。主进程管理窗口、菜单、密钥、最近文档和偏好设置。桌面 IPC 通过沙盒预加载脚本提供，后端请求通过 `127.0.0.1` 上经过身份验证的 HTTP 通信。

渲染、版面分析和翻译独立运行。页面和缩略图按可见区域虚拟化，PDF.js 和版面分析按需加载，渲染缓存有内存上限。每份文档仅上传到本地后端一次，后续请求使用文档 ID。切换文档、语言或内核时取消过时的翻译任务。

| 设置选项   | 引擎                  | 输出方式                            |
| ---------- | --------------------- | ----------------------------------- |
| Ultra fast | PDF Inspector         | 在原 PDF 上覆盖段落译文             |
| Fast       | PDFMathTranslate      | 生成保留公式的翻译后 PDF 页面       |
| Precise    | PDFMathTranslate-next | 生成排版处理更细致的翻译后 PDF 页面 |

PDF 渲染和版面分析在本地完成。翻译会将文档文本发送给 OpenAI，可能产生 API 费用。Fast 和 Precise 使用通过 `uv` 安装、由应用管理的独立 Python 环境，并通过后端代理访问 OpenAI。API 密钥不会传入渲染进程。

桌面密钥通过 Electron `safeStorage` 和 macOS 钥匙串保护加密保存。保存的密钥优先于 `OPENAI_API_KEY`，清除后恢复使用环境变量。安全存储不可用时禁用保存功能。

桌面数据保存在 `~/Library/Application Support/` 下的应用目录中，包括密钥、最近文档、翻译与版面缓存及内核环境。浏览器开发缓存位于 `.cache/translations/`。缓存和临时 PDF 可能包含文档内容；起始页的 **Clear** 仅清除最近文档历史。

浏览器开发模式在独立 Node.js 进程中运行 Express 和 Vite。原生菜单、桌面 IPC 和安全密钥存储仅在桌面应用中提供。

</details>

<details>
<summary>已知限制</summary>

- **平台支持：** 已测试的平台为 macOS。Windows 和 Linux 已有平台专用样式，但原生运行验证仍待完成。打包命令面向 macOS arm64 和 Windows x64。
- **版面保真：** Ultra fast 使用几何规则划分段落，并以文本覆盖层显示译文。复杂表格、旋转文本、特殊背景和较长译文可能无法保留原始排版。数学翻译内核的输出取决于上游版面处理能力。
- **扫描文档：** 扫描 PDF 需要 OCR，本应用尚未实现该功能。
- **翻译要求：** 翻译需要 OpenAI API 密钥和网络连接。Fast 和 Precise 需要通过 `uv` 另行安装数学翻译内核。
- **功能范围：** 这是一款本地阅读与翻译应用，并非完整的 PDF 编辑或导出工具。
- **验证范围：** 自动化测试覆盖后端和阅读器辅助逻辑。使用模拟服务的检查无法验证真实 OpenAI 翻译质量或 API 密钥是否有效。

</details>

## 许可证

PDFMathReader 采用 GNU Affero General Public License 第 3 版。完整条款见 [LICENSE](../LICENSE)。 PDFMathTranslate 和 PDFMathTranslate-next 也采用 AGPL-3.0 许可证。其运行时安装保留上游许可证文件；其他依赖保留各自的许可证。

## 致谢

非常感谢 [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[沉浸式翻译](https://immersivetranslate.com/)和[硅基流动](https://siliconflow.cn/)提供的支持。
