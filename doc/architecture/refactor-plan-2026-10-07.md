# PDFMathReader 代码结构重构计划

日期：2026-10-07。状态：已按本计划实施结构重构；执行结果与剩余验收见[执行记录](./refactor-execution-2026-10-07.md)。原规划依据保留如下。依据：当前工作区源码；审查过程中 HEAD 为 `34211b8`，工作区存在并行修改，实施前须重新记录基线。

## 1. 目标与范围

让维护者能够按“在哪个进程、属于哪个功能、是否平台专属”定位代码；消除大型入口中的业务逻辑、跨运行环境反向引用和平台样式混放。保留现有功能、UI、数据格式、进程隔离及性能策略。

采用渐进式模块化：继续使用单仓库、单 package.json、Vue、Electron、Express、现有 JS/ESM 和 Python/Swift 工具。此次不引入新状态库、依赖注入容器、事件总线、微服务、workspace 包体系，也不同时进行 TypeScript 全量迁移或视觉重设计。

Ponytail 原则：只拆出有明确职责、状态所有者或平台边界的模块；不按行数平均切片，不给每个函数建立文件，不把同一阅读器复制成三套客户端。

## 2. 当前问题与证据

以下行数是审查时快照，不是质量评分，也不承诺当前检查已通过。

| 位置                                                          | 观察                                                                                 | 实际维护问题                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `src/App.vue`，6,568 行                                       | script 约至 4,914 行；同时负责导入、会话、搜索、缩放、绘制、翻译队列、设置、原生桥接 | 功能边界依赖大量闭包变量；修改一个 watch 容易影响多条异步路径 |
| `src/DeveloperWindow.vue`，3,045 行                           | 监控、展示、文案等集中                                                               | 开发者工具形成另一个大型组件                                  |
| `src/ReadingAnnotations.vue`，1,892 行                        | 选区、弹窗、批注编辑、手势和动画                                                     | 页面生命周期与交互生命周期难以独立理解                        |
| `electron/main.mjs`，2,553 行                                 | 生命周期、窗口、菜单、IPC、持久化协调、诊断                                          | 应用级与窗口级状态交错，IPC 拆分容易丢失来源校验              |
| `server/index.mjs`，1,235 行；`server/engines.mjs`，901 行    | 服务组装、路由、翻译与内核运行协调                                                   | HTTP 路由和业务任务所有权不清晰                               |
| `src/style.css`，4,204 行；`src/mac-controls.css`，1,763 行   | 两个文件均含 Windows 分支；后者也含通用布局                                          | 文件名无法解释样式归属，级联依赖追加顺序                      |
| `src/main.js`                                                 | 全局导入 MacVue 样式与 mac-controls                                                  | 平台 JS 已按需加载，CSS 边界仍混合                            |
| `src/platform-controls.mjs`                                   | Windows 走 Fluent，其余走 MacVue；对外均导出 Mac* 名称                               | Linux 默认复用策略隐含在 else 分支，业务组件带平台命名        |
| `src/App.vue:41`；`electron/main.mjs:6`；`server/index.mjs:1` | renderer 引用 electron 中的快捷键/文案；main/server 引用 src 中的纯函数              | 共享代码被放在某个运行端目录中，依赖方向误导维护者            |
| `electron/production-stage.mjs`                               | runtime 文件白名单、esbuild 入口、测试模块 external 规则                             | 只改源码 import 不能保证安装包完整                            |

已通过本地 CodeGraph CLI 查询索引与 App 上下文。索引报告仅 17 个文件，include 缺少 `.mjs/.cjs`，Vue 覆盖也不完整；本计划用实际源码补足，不能把当前索引视为完整调用图。此次不修改索引配置。

## 3. 目标目录

保留 `src/`、`electron/`、`server/` 三个现有运行端根目录，以减少无意义的路径改动。下面是迁移后的归属图；目录只随真实文件迁入建立，不预建空骨架。

```text
src/                              # Vue renderer：不访问 Node/Electron 实现
  main.js                         # 选择窗口入口、初始化平台，再挂载
  app/
    ReaderApp.vue                 # 阅读窗口组合
    SettingsApp.vue               # 独立设置窗口组合
    DeveloperApp.vue              # 开发者窗口组合
  features/
    reader/                       # 文档运行会话、视口、绘制、导航、缩放
    library/                      # 最近文档、封面、打开动作
    translation/                  # 前端队列、可见范围、进度、重试
    annotations/                  # 选区、批注层、编辑与交互
    search/                       # 文档文本索引、搜索状态和结果定位
    settings/                     # 设置页面、偏好编辑、服务配置
    developer/                    # 监控、日志、快速测试 UI
  bridge/
    desktop.mjs                   # 对现有 preview* 能力的显式访问
    api.mjs                       # HTTP 请求、响应、错误；接受调用方 signal
  ui/
    controls.mjs                  # AppButton/AppSwitch 等平台中性导出
    styles/                       # reset、基础 token、真正共享的布局规则
  platform/
    runtime.mjs                   # 唯一的平台选择入口
    macos/                        # MacVue adapter、平台 token/chrome/控件样式
    windows/                      # Fluent adapter、平台 token/chrome/控件样式
    linux/                        # 显式兼容策略、Linux chrome/样式
    web/                          # 无 preload 的现有浏览器模式回退
  i18n/                           # Vue 响应式语言状态与 UI 文案

electron/
  main.mjs                        # 启动、组装、关闭
  main/
    windows/                      # 阅读/设置/开发者窗口及注册表
    ipc/                          # documents/settings/annotations/developer 等处理器
    menus/                        # 原生菜单构建、命令分发
    services/                     # 文档会话、偏好、recents、凭据、更新
    backend/                      # utilityProcess 启停与消息桥
  preload.cjs                     # 首轮保留单文件及现有 API
  platform/
    macos/                        # AppKit 行为、haptics 与 Swift 源码
    windows/                      # 文件关联、Windows 材质/窗口选项
    linux/                        # Linux 窗口与桌面适配
  build/                          # 打包、签名、分发、图标

server/
  index.mjs                       # 保留开发启动入口、startServer 导出兼容
  app.mjs                         # 服务组装及 close 所有权
  http/                           # 鉴权、中间件、按功能组织的路由
  documents/                      # 上传/打开文档运行态、提取、布局
  translation/                    # provider、执行、缓存、阅读辅助
  kernels/                        # 安装、参数、进程与引擎执行
    python/                       # 从 electron 迁入的三个 kernel Python 文件
  cache/                          # 清理、容量及活跃任务保护
  diagnostics/                    # 指标、脱敏日志、开发者测试服务
  platform/macos/                 # Apple Translation 的服务端适配与 Swift 源码

shared/                           # 仅真正跨运行端的纯代码
  translation/                    # 语言规范、术语规则、纯配置转换
  commands/                       # 快捷键意图与菜单数据；无 Electron Menu 对象
  i18n/                           # 跨端语言解析、菜单文案；无 Vue ref
  contracts/                      # 现有 HTTP/IPC payload 的 JSDoc/校验/常量（按需）

tests/
  desktop/                        # 原有 Electron smoke 与独立测试启动器
runtime/node/                     # main/server 共用的 Node I/O；初期仅 atomic-file
scripts/                          # 代码风格、构建元数据等仓库工具
doc/architecture/                 # 结构约定、迁移记录
```

纯模块测试优先与模块同域放置；HTTP 集成测试可以保留 server 内。移动测试时同步 `package.json` 的发现规则，不能让原有 `server/*.test.mjs` 悄悄漏掉子目录用例。构建输出目录暂不改名。

`platform/` 在 renderer/main/server 中分别出现是有意的：同一操作系统并不意味着同一运行环境。Swift haptics 归桌面，Swift Translation 归服务；Python 内核跨平台，不能误归入 macOS。

## 4. 依赖规则

```text
renderer app -> feature -> 纯功能模块 / ui / bridge / shared
renderer ui -> renderer platform adapters
renderer bridge -- IPC --> preload --> main IPC --> desktop services
renderer bridge -- HTTP --> server HTTP --> 对应功能服务
main bootstrap --> windows / IPC / services / platform / backend lifecycle
backend utilityProcess --> server bootstrap
server services --> 自身纯模块 / kernel runtime / shared
shared --> 其他 shared 纯模块（不得依赖三个运行端）
```

只有 Electron 后端启动桥可以跨到 server 入口；其他 main 功能不得直接耦合 server 内部实现。renderer 禁止 import `electron/`、`server/`、`node:*`；server 禁止 import Vue、renderer UI、Electron；shared 禁止 DOM、Vue、Node、Electron 及导入时副作用。

`server/engines.mjs` 和 `server/kernel-services.mjs` 当前还从 electron 引入 `atomic-file.mjs`。该工具含 Node I/O，不能放入上述纯 shared；迁入 `runtime/node/atomic-file.mjs`，只允许 main/server 使用。这个目录仅服务已存在的共用需求，不扩建通用基础设施框架。P1 同时明确迁移 glossary、translation-languages、translation-spacing 等已确认的跨端纯逻辑。

跨 feature 联动通过 app 组合和明确函数参数完成。例如搜索产出定位目标，由 reader 执行导航；批注产出变更，由文档保存路径持久化。不要建立相互 import 的 composable 环，也不要传一个包含所有状态的巨型 context。

先用现有 ESLint 的路径限制与不同目录 globals 固化简单边界；检查相对路径和未来 alias，避免只拦截一种写法。只有现有规则无法覆盖实际问题时，才增加小型 import 校验脚本。每个 feature 默认直接导入明确模块，不增加全项目 barrel 文件。

## 5. 最关键的拆分：状态和生命周期

| 状态/资源                                   | 唯一所有者                        | 其他模块如何使用                           |
| ------------------------------------------- | --------------------------------- | ------------------------------------------ |
| 当前文档、PDF loading task、文档代际标识    | reader 的文档会话                 | 显式传入当前文档身份及可用操作             |
| DOM host、canvas、位图缓存、可见页与缩略图  | reader 的视口/渲染模块            | 接收视口快照，输出绘制结果与可见范围       |
| 前端翻译待办、AbortController、服务结果记录 | translation 的前端调度模块        | 接收文档身份、范围和配置；回传结果         |
| 后端全局并发额度、内核子进程、任务缓存      | server 对应服务实例               | 路由调用服务；窗口不能各建一份全局限流器   |
| 批注选区、编辑弹窗、动画                    | annotations                       | 页面绑定时创建，解绑时释放                 |
| 批注落盘、PDF 写回、会话恢复、凭据          | main services                     | 经来源校验的 IPC 调用                      |
| 应用偏好                                    | main 持久化 + renderer 窗口内镜像 | 保持已有跨窗口通知和合并写入规则           |
| BrowserWindow、该窗口文档、权限             | main windows 注册表               | IPC 由发送者找到窗口，不依赖“当前焦点窗口” |

拆分 `App.vue` 的顺序：先最近文档与设置视图，再搜索/导航，再文档会话，再渲染和翻译调度。每个阶段只移动一条完整职责链：状态、方法、watch、事件订阅、清理必须一并归属。

不要先把所有 ref 搬进 `useReader()` 再继续塞功能。建议从 `useDocumentSession`、`useReaderViewport`、`usePageRendering`、`useTranslationQueue` 等实际职责开始，模块是否继续拆分取决于生命周期与读者理解成本。

关闭或切换文档时保持现有保存/取消/释放顺序：旧代际结果不可写入新文档；PDF render task、网络请求、timer、RAF、observer、PDF worker 必须由其创建者清理。编排层调用各模块明确的停止操作，不允许各模块互相销毁资源。

渲染、布局提取、翻译、缩略图仍独立调度；不能用一个串行 pipeline 或整页 Promise.all 让翻译阻塞显示。缓存上限、虚拟化窗口、后台降载与缩放预览策略先保持原值。

## 6. 平台与样式迁移

1. 区分“运行能力”与“视觉平台”。是否可打开系统文件、使用安全存储取决于 bridge 能力；不通过 `platform !== win32` 推断。测试模拟 Windows 外观时也不改变原生 OS 能力。
2. 平台选择集中在 `platform/runtime.mjs`；业务组件使用中性控件名。继续沿用现有 MacVue 和 Fluent 适配器，不为统一名字额外包一层 Vue 组件。
3. Linux 明确沿用现有 MacVue 兼容控件和自绘 chrome，并共享必要的控件库兼容规则；只把真实 Linux 差异放入 linux/。这轮不声称实现原生 GTK，也不改变外观。
4. 无 preload 的浏览器模式独立表达，初期保持现有视觉回退和可用能力；不能因为平台目录整理而移除 `bun run dev` 的使用路径。
5. CSS 先按职责原样搬迁，保持选择器、特异性、layer 内外位置和导入顺序。`@layer reader, macvue` 与未分层覆盖规则不是可随意重排的文本。
6. 通用 token/reset 留 ui/styles；reader/settings/annotations 的布局归所属 feature；OS 专属材质、标题栏、按钮尺寸归 platform。通用业务 CSS 中不继续添加 OS 分支。
7. 先保证视觉等价，再在单独变更中整理重复选择器与 token；不要在同一步骤引入新的全局 layer 层级。
8. 平台入口按需加载所需控件和样式，挂载前完成初始化。保留 Fluent 注册时序，检查 Vite 的 adapter/preload-helper 分块规则，避免 top-level await 循环。
9. Teleport 弹窗也必须携带平台/主题上下文。验收覆盖暗色、减少动画、减少透明度、窗口拖拽区域、弹出菜单、键盘焦点、缩放与滚动条。

## 7. Main、preload、服务与打包

Main 先提取窗口管理、菜单和成组 IPC 注册函数；保留统一测量包装、trustedWindow 检查和每个 handler 的参数校验。按实际依赖传入少量服务对象，不传完整 main 状态。凭据继续走系统安全存储，不为了共享契约而把密钥放入 shared 或 UI 全局状态。

`preload.cjs` 目前约 279 行，可先原样保留。因为窗口使用 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`，不能简单拆成运行时本地 require 链。只有规模确实需要拆分时，才采用 source modules -> 单一 CJS preload 产物，并同时支持 dev 和 packaged 启动。首轮保留 preview* 名称、IPC channel 和 payload，避免目录迁移与协议迁移叠加。

服务端先让 `index.mjs` 变薄，保持 `startServer(options)` 与返回对象兼容；路由只处理输入、权限、响应和取消关联。翻译/provider、文档/layout、kernel 管理各自拥有业务实现。继续保留独立 utilityProcess、本机 HTTP 边界和现有 token/origin 校验，不将服务迁回 main。

P5 按以下完整单元推进，避免只拆路由文本：

- 先搬 config/状态查询与 diagnostics 路由，再搬 documents/layout、translation/kernel proxy、cache 管理。保持当前中间件注册顺序、响应头和错误状态码。
- `app.mjs` 每个服务实例只创建一份 `proxyJobs`、provider limiter、page limiter、document store、engines 和 diagnostics；route factory 接收所需对象，不能重复初始化。开发者测试也使用这组实例。
- `engines.mjs` 初期保留兼容 façade，先提取环境检查/安装/高级配置，再提取翻译执行、子进程和结果处理；缓存 key 与进程回收语义不变。
- `cache-management.mjs` 虽约 520 行但职责连贯，首轮只归位、不强拆。保留 `isBusy` 对任务表、两个 limiter 和 engines 的联合检查，保持活跃任务保护、局部失效、symlink 边界及忙时 `409` 响应。
- 保留服务 close 的幂等性及当前 layout cleanup、文档清理、连接关闭、engines/local translator 关闭、HTTP/Vite/cache manager 关闭顺序；不能由各 router 分别管理共享服务的销毁。
- Python/Swift 资源迁移同时修改 engines、kernel-services、local-translation 的源码路径解析，以及 production-stage/package 资源复制。对 staged 产物验证资源存在且可定位，不能只依赖源码运行成功。

本轮保持用户数据目录、缓存 key、持久化 schema、IPC 名称、HTTP 路径及 provider 行为不变。若某一步必须改持久化格式，则独立立项迁移及回滚，不能混在文件整理里。

打包同步维护：runtime 白名单、esbuild 入口、动态 import、preload URL、Python/Swift resources 路径、图标/签名脚本、测试模块 external 规则。优先保留最终产物中的旧入口位置，源码布局与发行布局不必完全一致。后期才删除过渡入口，不能遗留永久双路径。

## 8. 分阶段执行计划

每一阶段单独 review/提交，确保可独立回退。以下为拟执行工作，均未执行。

| 阶段             | 具体交付                                                                                                     | 依赖                   | 验收与风险                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| P0 基线          | 固定 revision/已有修改；记录命令、安装包与关键 UI/性能样本；修复 CodeGraph 覆盖并验证实际支持                | 无                     | 当前测试实际发现数量、结果、失败及环境限制全部记录；覆盖 `.mjs/.cjs`、Vue、Python、Swift，CSS 用源码清单 |
| P1 共享边界      | 移动确实跨端使用的语言/术语/菜单纯逻辑到 shared；拆开 window-chrome 的纯快捷键与原生窗口配置；加 import 规则 | P0                     | 去掉 src↔electron/server 非入口反向引用；开发启动与打包测试不丢文件                                      |
| P2 平台和样式    | 平台中性控件导出、显式 Linux/web 回退；CSS 按所有权迁移；保持旧级联行为                                      | P1                     | 三平台关键界面视觉对照；当前未使用的 UI 库无运行时初始化；Teleport 与暗色正确                            |
| P3 Renderer 功能 | 抽出 library/settings/search；再迁移文档会话、viewport/render、translation、annotations；精简 App            | P1；最终整合需 P2      | 多窗口状态独立；切换/关闭/重试无旧请求回写；批注坐标和阅读位置不变                                       |
| P4 Desktop main  | 窗口/菜单/IPC/services 分域；OS 代码迁入各自目录；保留 preload 协议                                          | P1                     | trusted sender、凭据安全、设置广播、文档归属与退出保存保持；独立设置窗口无阅读器副作用                   |
| P5 Server 功能   | 薄入口、路由分组、服务任务所有权；Python 内核与 Apple Translation 资源归位                                   | P1；资源搬迁与 P4 协调 | 取消、全局并发、缓存隔离、子进程清理、HTTP 鉴权与数据写入语义保持                                        |
| P6 收尾          | developer UI 和文案分域；smoke/build 工具归位；更新路径文档并删过渡层                                        | P2–P5                  | 完整构建和针对性回归；实际 OS/安装包检查；结构约束生效；无遗漏测试或资源                                 |

可以并行：P3 的独立功能提取、P4、P5 在 P1 接口固定后由不同人员负责。不能并行编辑同一个 App.vue；P2 触及其 class/模板时需与 P3 串行交接。资源路径和 production-stage/package 修改指定一个集成负责人，其他任务提供所需变更清单。

每个迁移单元包含：旧位置 -> 新位置、调用者更新、状态/清理归属、打包影响、针对性验证和回滚方式。仅搬文件与改变行为分开提交。回滚以该单元提交为边界，不重置其他工作区修改，不删用户数据或缓存。

## 9. 验证与完成标准

实施前执行当前 `bun run test`、`bun run lint`、`bun run build` 并记录基线。此次后端 worker 报告运行 `npm test`（同一 `node --test server/*.test.mjs` 脚本），40/40 通过；主代理未重复执行，未运行应用构建与 lint，也未验证原生平台行为。测试说明仍写 29 个案例，实施时应更新为实际 runner 发现数量；并行工作区的此次结果不能代替实施起点的固定 revision 基线。

每阶段运行直接受影响的 Node 测试及对应 Electron smoke；最终跑主套件、构建和全局静态检查。已有测试优先迁移复用，只在生命周期或跨端边界缺口上补有价值的用例；不要给每个抽取函数机械加测试。

必须保护的行为：

- 文件打开/拖入/最近记录/系统文件关联、多窗口归属、启动恢复、关闭保存。
- 缩放/滚动/虚拟化/缩略图、搜索定位、批注往返与 PDF 页面编辑写回。
- 翻译取消/重试/切换 provider、全局并发上限、缓存复用及活跃任务不被清理。
- 凭据不明文落盘、日志脱敏、未经授权窗口不可调用敏感 IPC、非授权 origin/token 被拒绝。
- 设置独立窗口与内嵌模式、七种语言、系统菜单、键盘焦点、平台窗口按钮和可访问性。

性能对照使用同一 PDF、视口、硬件和缓存冷热条件，记录首屏、滚动、峰值内存、活动任务数。P0 固定波动范围后设置回归阈值；禁止通过提高缓存或降低显示质量掩盖结构重构带来的退化。

macOS 上模拟 Windows UI 只能证明 renderer 分支，不能证明 Windows 原生窗口、文件关联、打包启动；Linux 同理。最终按实际平台分别标记已验证/未验证，打包成功也不等于安装后运行成功。

完成定义：

1. 三个运行端依赖方向可检查，shared 无运行端依赖；只有明确入口跨到 server。
2. App/main/server 入口只负责组装和生命周期，不包含成片业务算法、平台 CSS 或文案字典。
3. 功能的状态、方法和清理可在其目录内找到；新增一个平台样式不需要搜索整套业务组件。
4. 没有用新的巨型 composable/context 取代原来的巨型文件，没有无意义的层层转发。
5. 现有数据/协议兼容、测试发现完整、发行资源齐全、关键交互和性能与基线等价。

入口约 100–300 行、普通组件约 200–400 行、超过 500 行需解释职责，是 review 提示而非硬性指标；纯文案、数据表和合理紧密的算法可例外。最终以职责清晰和变更影响范围判断，不追求文件数量或拆分比例。

## 10. GSD 路由与下一步

按用户指定的 gsd-do，复杂架构重构匹配 gsd-add-phase。已读取其技能与工作流并执行 phase-op 初始化检查；返回 roadmap_exists=false。工作流要求 “Run /gsd-new-project to initialize.” 后退出，因此没有虚构新增 GSD phase，也没有运行 phase add/build。

依据用户“只计划”及继续完成授权规划的要求，本文件作为独立提案。后续决定实施时，可把 P0–P6 映射到正式 GSD roadmap，再为各阶段生成范围明确的 PLAN.md；此次不创建整套 GSD 项目、不提交、不构建、不发布。

建议第一个实施单元：P0 基线 + P1 中最小共享模块迁移。先验证依赖边界与发行链路，再动复杂的 reader 生命周期。
