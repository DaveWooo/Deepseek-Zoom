# Project Guidelines & Rules

## 1. 语言规范 (Language Policy)

- 请务必使用**简体中文**回答所有问题与沟通交流。

## 2. 每次更新必须修改版本号 (Mandatory Version Bumping)

- **规则**：每次对项目进行代码修改、功能新增、重构或 Bug 修复后，**必须递增版本号**并同步更新 `CHANGELOG.md`。
- **执行方式**：
    - 使用命令：`npm run version:patch`（日常修复与调整）、`npm run version:minor`（新功能特性）或 `npm run version:major`（破坏性重大变更）。
    - 该脚本会自动同步更新 `package.json`、`manifest.json`、`package-lock.json` 并往 `CHANGELOG.md` 中添加新版本段落。
    - 在 `CHANGELOG.md` 中详细记录具体的改动条目与说明。

## 3. 质量与验证规范 (QA & Verification)

- **完整验证命令**：代码修改完成后，必须运行 `npm run check`（或依次执行 `npm run format`、`npm run build`、`npm exec tsc -- --noEmit`、`npx vitest run`）。
- **通过标准**：
    - 代码格式（Prettier）检查通过。
    - 生产产物构建（Vite build）正常生成。
    - TypeScript 类型检查（`tsc --noEmit`）零错误。
    - 全量单元测试套件（Vitest）100% 通过。

## 4. 架构分层与通信规范 (Architecture & Boundaries)

- **Sandbox（沙盒层）**：
    - 侧边栏所有复杂 UI（聊天、Markdown 渲染、KaTeX、Mermaid 图表、设置面板等）均在隔离沙盒内运行。
    - 沙盒层严禁直接调用特权 `chrome.*` API，所有跨层通信必须严格通过 `window.parent.postMessage`（经由 `shared/messaging/`）与宿主层通信。
- **SidePanel / Host（宿主层）**：
    - 负责托管沙盒 iframe，并在收到沙盒请求后转发至 `background` 或操作宿主级 API（如 `chrome.tabs`、`chrome.storage`）。
- **Content Scripts（内容脚本层）**：
    - 包含网页划词悬浮工具栏（`content/toolbar/`）、快捷键管理器（`content/shortcuts.js`）、图片浮动识别按钮（`content/toolbar/image.js`）及全屏截图遮罩（`content/overlay.js`）。
    - 在发起区域截图或页面操作前，必须通过 `injectContentScriptsIntoTab` 确保内容脚本与遮罩已注入；优雅捕获 `Extension context invalidated` 并给出友好的刷新页面提示。
- **Background / Service Worker（后台层）**：
    - 负责模型请求调度、流式响应分发、Tab 状态维护、MCP 远程服务连接以及底层存储更新。

## 5. 设置无感自动保存规范 (Seamless Auto-Save Standards)

- **无感持久化**：
    - 设置界面（Settings）全面采用即时无感自动保存。
    - 统一监听选项切换（`change`）、输入框失焦（`focusout`）以及键入防抖（400ms `input`）；在模态窗关闭（`close()`）前强制执行 Flush 保存。
    - 严禁在设置界面添加多余的手动“保存更改”按键。
- **全链路数据流打通**：
    - 新增或修改任何配置项时，必须同步打通：UI 表单采集（`sections/*.js`） -> 保存组装（`settings_save.js`） -> 消息派发（`shared/messaging/`） -> 存储转换（`shared/settings/connection.js`） -> 独立桥接与沙盒桥接（`bridge.js`）。

## 6. 国际化与多语言规范 (i18n & Localization)

- **中英双语支持**：
    - 所有界面文本、提示信息、占位符及 Tooltip 必须在 `sandbox/core/translations.js`（沙盒）或 `content/toolbar/i18n.js`（工具栏）中注册。
- **零孤儿键（Zero Orphan Keys）**：
    - 严禁硬编码纯文字字符串。
    - 在字典中删除已被废弃的键值，杜绝未使用的孤儿键残留，确保通过 `scripts/project-i18n.test.js` 检查。

## 7. 严格禁止事项与红线 (Explicit Constraints & Don'ts)

- ❌ **严禁手动篡改版本号**：禁止跳过版本脚本手动修改 `package.json` 中的 `version` 字段，避免导致多端版本不一致。
- ❌ **严禁跳过测试提交**：任何修改在提交前必须经过全量测试验证，严禁破坏既有测试用例。
- ❌ **严禁绕过沙盒安全边界**：严禁在非受信任环境中执行动态未过滤代码。
