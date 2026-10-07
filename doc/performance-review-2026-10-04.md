# 性能排查与优化 — 2026-10-04

本轮按实际影响从高到低处理翻译调度、滚动布局和动画内存。测试使用本地模拟翻译服务和真实已安装内核，没有调用外部付费服务。原始数据见 [performance-review-2026-10-04.json](performance-review-2026-10-04.json)。

| 优先级 | 问题及改动                                                                                                                                                            | 验证结果                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | 缓存页也排在耗时的翻译 worker 后面。缓存查询及 cache-only 探测移到 worker 配额之前。                                                                                  | 单 worker 正在翻译另一页、模拟服务每次等待 1500 ms 时，缓存页响应 **5335.4 → 2.8 ms**；缓存页排队时间 **5332.3 → 0 ms**。                                                   |
| 2      | 同期新增的裁剪几何函数展开整个响应式 page，导致可见性和翻译状态变化重算全书布局。改为仅读取页号、宽、高。                                                             | 1000 页文档、120 个滚动帧，p95 **34.3 → 9.3 ms**，最大帧间隔 **67.5 → 17.0 ms**。                                                                                           |
| 3      | 已取消请求留在页面/provider 等待队列，继续持有闭包中的文档或请求数据。limiter 支持 AbortSignal，取消时立即移出等待队列；获得配额后再次查询同页缓存。                  | 回归测试验证：取消不必等正在运行的任务释放配额、取消任务不会执行、同页结果在排队期间生成后不会再启动 worker。输入准备失败也会清理 job 目录。                                |
| 4      | macOS 动画快照复制完整页面 backing store，动画结束后依赖 GC 释放。所有平台使用现有 2M 像素上限；完成、取消、布局切换和关闭时主动清空 canvas、释放图片来源并取消动画。 | 真实 Chromium 中，64 MiB 原图生成的快照为 **7.998 MiB**；动画完成及预先取消后快照宽高均为 0，原图不变，残留快照 DOM 为 0。这是分配上限的验证，不能等同于整个应用 RSS 降低。 |
| 5      | 滚动事件计算一次可见页，下一 render frame 又重复计算。复用已计算的窗口；其他路径仍重新计算。                                                                          | 桌面基准及动画检查通过；没有单独归因这项改动的帧耗时收益。                                                                                                                  |

## 测量边界

调度基准对照从本轮开始时的 Git HEAD 导出隔离源码，使用相同测试程序和真实 Fast 内核；每次使用独立缓存。它测量缓存页被后台工作阻塞的场景，不代表未缓存翻译也获得同样倍数的加速。

普通 Fast 基准为 30 页、每页 6 段、模拟 provider 每段等待 200 ms，依次翻译第 1、15、30 页，最后读取第 1 页缓存。未缓存响应中位数本轮前后为 3332.4 / 2587.8 ms，缓存响应为 6.1 / 3.0 ms。Python 导入和字体子集耗时也随机器负载变化，调度补丁没有修改这两项，**不把这个未缓存耗时差值归因为补丁收益**。本地剩余主要成本仍是 Python/模型初始化、页面处理和字体子集；真实网络延迟还可能更高。

字体 native subsetter 的试验虽然缩短了 subset 阶段，却使后续序列化/进程总时间明显增加，已经撤回。保留原内核字体嵌入及子集逻辑。

桌面基准使用同一 1000 页混合横竖版 PDF，连续打开三次，包含滚动、侧栏切换及窗口 resize。裁剪功能来自同期其他工作，本轮保留其行为，并修复其布局依赖回归。裁剪改动前的滚动 p95 为 9.4 ms，出现回归后为 34.3 ms，修复后为 9.3 ms；最终首屏中位数 463.1 ms，相比最初 434.2 ms 没有首屏加速结论。

Renderer + backend 的采样 RSS 峰值中位数最初为 780.5 MiB，最终为 801.7 MiB，**没有证据证明总 RSS 下降**。这些数值可能重复计算共享驻留页，且不含 Python worker、main/GPU。快照改动控制的是短时额外分配和释放时机。

## 验证

- `npm test`：38 / 38 通过（安装前最终复测）。
- `npm run build`：通过。
- `node server/kernel-smoke.mjs`：Fast/Precise 的真实并发、可读译文、段落坐标、缓存、provider 错误及取消通过。
- `node server/fast-benchmark.mjs`：真实 Fast 基准通过。
- `node_modules/.bin/electron . --smoke-test=benchmark`：最终 1000 页桌面基准通过，滚动长任务计数为 0。
- `node_modules/.bin/electron . --smoke-test=animation`：文字逐字动画、原始 PDF 字形、快速切换清理、减少动态效果、Fast 到达及返回动画通过。修正了测试的两个旧问题：按钮 8 px 装饰 halo 被误算为文字溢出，以及仍使用已移除的 kernel-switcher selector。文字横向溢出仍检查实际文本 scroller。
- `node_modules/.bin/electron tests/desktop/motion-memory-smoke.mjs`：真实 canvas 分配上限和释放检查通过。
- 额外的 `layout-settings` smoke 在键盘切换 Precise 的保存等待处超时；此轮未修改该键盘处理路径，该项仍未验证通过。

## 复现

```zsh
npm test
npm run build
SCHEDULING_OUTPUT=/tmp/reader-scheduling.json node server/scheduling-benchmark.mjs
FAST_BENCHMARK_OUTPUT=/tmp/reader-fast.json node server/fast-benchmark.mjs
PDF_READER_BENCHMARK_LABEL=review node_modules/.bin/electron . --smoke-test=benchmark
node_modules/.bin/electron . --smoke-test=animation
node_modules/.bin/electron tests/desktop/motion-memory-smoke.mjs
```

## 本轮交付

页面裁剪、翻译调度、动画快照清理和 Fast CJK 段首缩进修复已合并到本次本地构建。Fast 对中文、日文、韩文译文中继承的原文首行缩进统一使用两个全角空格；无原文缩进的段落及其他目标语言保持原有规则。CJK 使用新的排版缓存版本，避免复用旧缩进的 PDF；其他语言保留兼容缓存。

本次重新运行 `npm test`，38 / 38 通过；新增测试验证旧 schema 4 CJK 排版缓存不会被复用，新 schema 5 缓存仍可绕过 worker 队列。前端构建、裁剪及动画桌面 smoke 通过。此前已使用真实 Fast 内核及本地模拟服务验证带缩进段落的两个全角空格。

macOS arm64 应用通过固定证书签名及 `codesign --verify --deep --strict`，安装到 `/Applications/PDFMathReader.app` 并启动。安装后的 `app.asar` 和 `kernel-worker.py` 与构建产物逐字节一致。旧版备份位于 `/Users/rongxin/Library/Application Support/PDFMathReader/backups/20261004-222643/PDFMathReader.app`。

最终再次安装后的 `app.asar` SHA-256 为 `70a1c115d31cc660b1cef18ca286efc9f8d1d2282dbe9b29d83206fdc98878bf`，与签名构建产物一致；深度严格签名验证通过，已启动。此次替换前的应用另备份至 `.cache/install-backups/20261004-222730/PDFMathReader.app`。Fast CJK 的新排版缓存版本保持升级，旧排版缓存按预期失效。
