# 代码结构重构执行记录

日期：2026-10-07。基线：`34211b8`，工作区原有 README 和 scrollbar-gutter 修改均保留。对应[实施计划](./refactor-plan-2026-10-07.md)。此次为本地源码重构，没有提交、推送、安装或发布。

## 目录与职责

```text
src/
  App.vue / main.js / style.css     窗口模板、启动和样式入口
  app/                             阅读器组装、状态端口和窗口生命周期
  features/
    reader/                        文档导入、页面绘制、导航、缩放、阅读位置
    search/                        全文搜索
    library/                       最近文档与预览
    translation/                   翻译队列、范围和状态展示
    settings/                      设置页面、偏好持久化、内核与凭据交互
    annotations/                   批注展示、编辑、选择、手势和动画
    developer/                     开发者窗口、监控与诊断
  ui/                              中性控件入口、通用交互与功能样式
  platform/{macos,windows,linux,web}/ 平台控件、窗口外观与平台样式
  bridge/                          后端请求入口
  i18n/                            渲染器文案

electron/
  main.mjs                         Electron 应用组装
  preload.cjs                      单一 sandbox preload，桥接协议保持不变
  main/{windows,ipc,menus,services,backend}/
  platform/{macos,windows}/         原生平台能力
  build/                           打包、签名、分发和资源构建

server/
  index.mjs / app.mjs               启动与服务组装
  http/                            中间件与 HTTP 路由注册
  documents/ translation/ kernels/ cache/ diagnostics/
  kernels/python/                  Python 内核资源
  platform/macos/                  本地翻译 Swift 资源

shared/                            跨进程纯数据与纯函数
runtime/node/                      Node 文件与应用资源路径
tests/{server,desktop}/            服务测试与 Electron smoke
```

功能调用方统一使用 `App*` 控件和 `src/ui/controls.mjs`；旧 platform-controls 和 Electron 服务转发文件删除。MacVue 的 `Mac*` 名称只出现在平台实现映射中。Windows 使用 Fluent；Linux/Web 明确保留 MacVue 回退，不宣称实现 GTK 或其他原生控件。

样式按通用功能和平台分离，保留 CSS layer 和级联顺序。连续圆角、实验字体样式在平台控件样式之后加载。用户已有 `scrollbar-gutter: auto` 迁入通用控件样式。

## 维护约束

- `src` 不引用 Electron、服务端或 Node 专属模块；`server` 不引用 Vue 和客户端；`shared` 不依赖运行环境。ESLint 检查这些边界。
- 业务 factory 接收明确的状态所有者与功能 action；组装集中在 `src/app`。每个窗口独立构造会话、渲染、动画和翻译状态。
- `useReaderWindow.mjs` 仍是约 1,100 行的显式组装与模板字段出口；算法已移到功能模块。后续新增业务应进入对应 feature，不继续塞入组装文件。
- IPC 注册保留来源窗口、frame 与 origin 校验；窗口 registry 和后端 utility process 保持按窗口隔离。
- 没有更改存储 schema、preload channel、HTTP 接口或翻译数据格式，没有引入新框架或全局状态容器。
- 打包阶段按运行目录收集源码，生产包剔除测试；资源定位从应用根目录解析，支持深层源码路径及打包后 ASAR 路径。Python/Swift 资源的打包文件名保持兼容。

## 入口规模

| 文件              | 重构前 | 重构后 |
| ----------------- | -----: | -----: |
| App.vue           |  6,568 |    613 |
| Electron main.mjs |  2,553 |    578 |
| server/index.mjs  |  1,235 |     10 |

DeveloperWindow 从 3,045 行降至 1,907 行，快照采样、事件日志和格式化分别由 composable 负责；模板与 CSS 保持原样。ReadingAnnotations 的编辑、选区、手势、动画和持久化已拆为独立 composable。

语言字典和纯模板/CSS 文件按数据或展示职责保留，不为行数制造无意义碎片。

## 验证记录

- `bun run test`：40/40 通过；涵盖认证、PDF 文档、缓存、内核、翻译、偏好与打包 staging。
- `bun run lint`、`bun run build`、`git diff --check`：通过。
- 源码 Electron `--ci-launch-check`：可见窗口与 previewReady 通过。
- 源码 `--smoke-test=reading-view --smoke-background-render` 曾完整通过阅读位置、缩放、横纵布局、重启持久化、文档隔离、窗口适配和关闭保存；复跑发现位置与动画时序不稳定，不能视为稳定通过。
- 源码 `--smoke-test=multi-window`：独立 renderer/backend、IPC 隔离、文件递送、最近文档、开始页复用、窗口关闭和退出全部通过。此项不启用背景渲染测试开关。
- macOS arm64 测试包 `node electron/build/package.mjs --test --unsigned`：构建成功，Swift 原生资源编译完成；打包应用 CI 启动通过。产物位于 `/tmp/pdfmathreader-slim-test-build/PDFMathReader Tests-darwin-arm64/`，未安装到 `/Applications`，未签名发布。
- macOS、Windows、Linux、Web 控件 adapter 隔离构建与 CSS 解析检查通过；Windows adapter 不包含 MacVue package import。
- 开发者窗口 smoke 完整通过：单实例窗口、采样、任务队列、复制脱敏诊断、IPC 权限、新窗口覆盖和关闭清理。测试显式选择本地 mock OpenAI provider，避免默认免费服务联网，并手动刷新短暂任务快照。
- Fluent Windows 模拟 smoke 完整通过：菜单、密码字段、开关/滑块持久化、下拉值与开关事件、内核键盘选择；本机系统仍为 macOS。
- CodeGraph 覆盖 `.mjs/.cjs` 与 Electron build 源码；`bun run index:code` 在未提交迁移期间排除已删除旧路径后建立索引，不改 Git index。

测试脚本同步迁移至 `tests/desktop`，修正旧服务 import，并使多窗口测试等待文档动画结束后再操作；阅读位置测试等待诊断接口和页面宿主注册后再查询。背景渲染开关仅在 smoke 模式生效，不改变生产窗口节流策略。

## 尚未通过的验收

本轮不宣称所有视觉 smoke 全绿：搜索测试在沉浸式标题栏断言失败；原生设置测试在通用设置卡片数量断言失败；批注测试在评论标记与所选文字的几何对齐断言失败。翻译预取 smoke 的反向滚动方向断言也未通过。上述失败暂未完整确认为基线问题或重构回归；不能用单元测试通过代替这些验收。

源码及打包版阅读位置 smoke 在复跑中出现重开文档位置断言失败：失败快照包含仍处于动画中的页面尺寸和侧栏宽度。原 HEAD 的同项 smoke 也曾出现位置失败，但当前尚不能排除新增回归，阅读动画与保存位置仍需稳定验收。Windows 控件已完成独立构建及 macOS 上的 Fluent UI 模拟检查。实际 Windows/Linux 系统窗口、输入、安装和平台服务未在本机验证。翻译服务的真实联网凭据、系统权限及不同硬件下的资源性能没有在本轮作全面验收。
