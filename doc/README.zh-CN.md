<p align="center">
  <img src="icon.png" alt="PDFMathReader app icon" style="height: 4em; width: auto;">
</p>

# PDFMathReader

[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

一款本地 PDF 阅读器，采用受 macOS「预览」启发的界面，支持段落翻译和保留数学公式的翻译内核。基于 Vue 3、PDF.js 和 Electron 构建。

<img src="preview.png" alt="PDFMathReader 阅读界面" width="70%">


## 最近更新

- 在独立窗口中打开多份 PDF，每个窗口都有自己的阅读位置、翻译任务和后端进程。关闭一个窗口不会影响其他窗口。
- 通过 **File → Open recents...** 打开最近文档的缩略图图库。重新打开文档时，恢复页码、滚动位置、缩放、布局、侧栏及原文/译文显示状态。
- 通过 **File → Preference** 或 **Settings…** 打开现有设置面板。
- 在原位置切换已检测区域的原文与译文：**Ultra fast**、**Fast** 和 **Precise** 均使用鼠标单击。
- 通过页面与缩略图虚拟化、有容量上限的渲染缓存，以及独立运行的渲染、版面分析和翻译，支持大型文档阅读。

## 快速开始

### 运行桌面应用

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

### 阅读与文档管理

- 打开或拖入不超过 50 MiB 的 PDF。打包后的 macOS 应用也支持 Finder 的 **Open With（打开方式）**，以及将 PDF 拖到 Dock 图标上。
- 在独立桌面窗口中阅读不同 PDF，每个窗口都有自己的渲染进程和后端进程。
- 通过缩略图导航，调整缩放、适应宽度或高度、纵向或横向滚动，以及每行显示一页、两页或四页。
- 从起始页或 File 菜单图库重新打开最近文档。每份文档分别保存阅读状态。
- macOS 使用 **⌘N** 新建窗口、**⌘O** 打开 PDF、**⌘W** 关闭当前文档、**Ctrl+W** 关闭窗口。Windows 和 Linux 对应使用 **Ctrl+N**、**Ctrl+O**、**Ctrl+W** 和 **Ctrl+Shift+W**。
- **⌘1**、**⌘2**、**⌘3** 分别切换单页、双页、四页布局；**⌘⇧1–9** 跳转到 10–90%，**⌘⇧0** 跳转到末尾。

macOS 使用一体式工具栏、原生窗口按钮和透明材质。Windows 使用原生标题栏和菜单，工具栏采用 Segoe UI 字体。Linux 使用桌面环境管理的窗口装饰、系统字体和不透明工具栏。Windows 和 Linux 的其他阅读快捷键以 Ctrl 替代 Command。

### 翻译

| 设置选项 | 引擎 | 输出方式 |
| --- | --- | --- |
| Ultra fast | PDF Inspector | 在原 PDF 上覆盖段落译文 |
| Fast | PDFMathTranslate | 生成保留公式的翻译后 PDF 页面 |
| Precise | PDFMathTranslate-next | 生成排版处理更细致的翻译后 PDF 页面 |

在设置中选择目标语言。**完整翻译** 翻译整份文档；**降低翻译请求** 在阅读时翻译当前页及前后各最多两页。可设置并行页面数（1–4）和翻译请求数（1–8），默认分别为 2 页和 4 个请求。

工具栏翻译按钮可切换原文与译文。所有内核均可通过鼠标单击已检测到的段落，在原位置切换其原文与译文。开启 **Show paragraph boundaries** 可查看已检测区域。当前页翻译失败时，可从设置中重试。

渲染、版面检测和翻译独立运行，段落或页面完成后即可显示结果。切换文档、语言或内核时，会取消已过时的任务。窗口最小化或隐藏时暂停渲染和阅读模式任务，完整文档翻译继续运行。

### 本地处理与存储

PDF 渲染和版面分析在本地完成。翻译会将文档文本发送给 OpenAI，可能产生 API 费用。数学翻译内核还会创建临时本地 PDF 文件。译文和版面元数据缓存在本设备上。

桌面应用通过 Electron `safeStorage` 和 macOS 钥匙串保护，对设置中保存的 API 密钥进行加密。保存的密钥优先于 `OPENAI_API_KEY`；清除后恢复使用环境变量。安全存储不可用时禁用保存功能，渲染进程 API 不会暴露已保存的密钥。

桌面数据位于 `~/Library/Application Support/` 下的应用目录中：

| 位置 | 内容 |
| --- | --- |
| `openai-key.enc` | 加密后的 API 密钥 |
| `recent-documents.json` | 最近文档路径、预览图和阅读位置 |
| `translations/` | 缓存文本、翻译后 PDF 页面和版面元数据 |
| `engines/` | 数学翻译内核的环境和资源 |

使用起始页的 **Clear** 可清除最近文档历史。浏览器开发模式的译文缓存在 `.cache/translations/` 中；删除相应翻译缓存目录即可清空结果。翻译缓存可能包含源自文档的文本。后端仅绑定 `127.0.0.1`，桌面应用会对本地请求进行身份验证。

### 渲染性能

页面和缩略图的 DOM 节点按可见区域虚拟化。阅读器渲染可见页面，并保留前后各最多四行；缩略图在接近侧栏可见区域时加载。可复用位图缓存上限为 64 MiB，驻留页面画布上限为 128 MiB，内存压力下优先释放远处的预渲染画布。

每份 PDF 仅上传到其本地后端一次，后续页面请求使用文档 ID。PDF.js 和版面分析按需加载。

窗口缩放和侧栏切换实时更新布局，每帧合并布局计算，可见页面重绘间隔至少 100ms；停止调整 160ms 后补齐缓存页面。桌面应用在 `performance.json` 保存最近 20 份性能记录，包括首屏时间、滚动长任务、进程内存采样峰值与 HTTP 正文字节数。内存合计包含共享进程，可能重复计算共享驻留页；传输量不包括请求头以及内核或模型服务的外部流量。

## 架构

PDFMathReader 将桌面协调、页面渲染和翻译处理分开。每个桌面窗口都有自己的渲染进程和本地后端，主进程负责应用级服务。

```text
                         DESKTOP APP
+--------------------------------------------------------------+
| Electron main process                                        |
| Window lifecycle, native menus, file opening                  |
| Credentials, recent documents, reading preferences            |
+---------------------+----------------------------------------+
                      | IPC via sandboxed preload
                      v
+--------------------------------------------------------------+
| Per-window renderer: Vue 3 + PDF.js                           |
| PDF pages / thumbnails / paragraph overlays / reading state   |
+---------------------+----------------------------------------+
                      | Authenticated HTTP on 127.0.0.1
                      v
+--------------------------------------------------------------+
| Per-window backend: Express in an Electron utility process    |
| Document store / layout analysis / translation queues         |
|                                                              |
| Ultra fast: PDF Inspector --> paragraph translation           |
| Fast / Precise: Python worker --> app-managed math kernels    |
|                                  |                           |
|                                  v                           |
|                         Local OpenAI proxy                    |
+-----------+----------------------+---------------------------+
            |                      | HTTPS: text translation
            v                      v
+----------------------+   +----------------------+
| Local disk           |   | OpenAI API           |
| Translation caches   |   | Translation responses|
| Kernel environments  |   +----------------------+
| Temporary PDF files  |
+----------------------+
```

渲染、版面检测和翻译独立运行。Python 数学翻译内核通过本地后端代理调用 OpenAI，API 密钥不会传入渲染进程。密钥、最近文档历史和保存的偏好设置由主进程管理；后端缓存和内核环境保存在本地磁盘上。

在浏览器开发模式中，浏览器标签页替代 Electron 渲染进程，`npm run dev` 在独立 Node.js 进程中运行 Express 和 Vite。原生菜单、桌面 IPC 和钥匙串保护的密钥存储属于桌面应用功能。

## 已知限制

- **平台支持：** 已测试的平台为 macOS。Windows 和 Linux 已有平台专用样式，但原生运行验证仍待完成。打包脚本目前仅构建 macOS arm64 版本，不提供 Intel 构建。
- **版面保真：** Ultra fast 使用几何规则划分段落，并以文本覆盖层显示译文。复杂表格、旋转文本、特殊背景和较长译文可能无法保留原始排版。数学翻译内核的输出取决于上游版面处理能力。
- **扫描文档：** 扫描 PDF 需要 OCR，本应用尚未实现该功能。
- **翻译要求：** 翻译需要 OpenAI API 密钥和网络连接。Fast 和 Precise 需要通过 `uv` 另行安装数学翻译内核。
- **功能范围：** 这是一款实验性的本地阅读与翻译应用，并非完整的 PDF 编辑或导出工具。
- **验证范围：** 自动化测试覆盖后端和阅读器辅助逻辑。使用模拟服务的检查无法验证真实 OpenAI 翻译质量或 API 密钥是否有效。

## 许可证

PDFMathReader 采用 GNU Affero General Public License 第 3 版。完整条款见 [LICENSE](../LICENSE)。

PDFMathTranslate 和 PDFMathTranslate-next 也采用 AGPL-3.0 许可证。其运行时安装保留上游许可证文件；其他依赖保留各自的许可证。
