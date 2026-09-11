<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a>
</p>

<div align="center">
  <a href="https://github.com/DaveWooo/Deepseek-Nexus">
    <img src="logo.png" width="160" height="160" alt="DeepSeek Zoom Logo">
  </a>

# DeepSeek Zoom

### 赋予浏览器原生 AI 灵魂

  <p>
    <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini">
    <img src="https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  </p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  </p>

  <p>
    <a href="README.md">English README</a>
  </p>

---

</div>

### 项目简介

**DeepSeek Zoom** 赋予浏览器原生 AI 灵魂,是一款集成 Gemini Web、Google Gemini API、OpenAI Compatible API 以及多个第三方专门 API 渠道的 Chrome 扩展程序。它不仅仅是一个侧边栏插件,而是通过注入式的**悬浮工具栏**、图像与截图输入、基于 Chrome DevTools Protocol 的**浏览器控制工具**以及可选的**外部 MCP 工具**,将 AI 的触角伸向网页浏览的每一个交互细节。

### 逆向工程与数据流向披露

**Gemini Web 渠道**: 本扩展通过逆向工程访问 Google Gemini Web (gemini.google.com),提取页面 HTML 中的认证 token (`atValue`、`blValue`、`f.sid`) 并模仿浏览器请求,从而无需官方 API key 即可使用 Gemini Web。**这种方式很可能违反 Google 服务条款**,可能构成未授权访问。请求会携带您的会话凭证发送至 Google 服务器 (`gemini.google.com`、`push.clients6.google.com`)。

**水印移除功能**: 对于 Gemini 生成的图片,本扩展会移除嵌入的水印(元数据标记)以便直接下载。这会移除 AI 生成内容的署名/签名。用户需注意版权 implications 和 Google 关于生成内容使用的政策。

**数据流向**: 用户文本、图片、上传文件会发送至所选 provider 的 API endpoint。Gemini Web 时数据流向 Google 服务器;其他 provider 时流向各自 endpoint(含用户配置的 MCP server)。API key 本地存储在 Chrome 扩展 storage,除所选 provider 外不传向任何第三方。

**风险自负**: 使用 Gemini Web 或水印移除功能即意味着您承认潜在的服务条款违反,并承担相应后果。扩展作者提供这些功能仅用于研究/实验目的,不对滥用行为承担责任。

### 能力概览

DeepSeek Zoom 当前围绕浏览器内 AI 工作流提供以下能力：

- **Gemini Web**、**Gemini API**、**OpenAI Compatible API**、**OpenAI 官方 API**、**DeepSeek API**、**OpenRouter API**、**通义 / DashScope API**、**Anthropic API** 与 **智谱 API** 多提供方切换，支持按渠道配置 `Base URL`、`API Key` 与 `Model IDs`。
- **Gemini Web 临时对话** 开关，可让 Web 渠道请求不进入 Gemini 近期对话。
- **Gemini API Google Search grounding** 支持，并在回复中展示联网来源。
- **OpenAI Compatible API 联网搜索** 支持，可按当前接口使用 Responses API `web_search` 或 Chat Completions `web_search_options`。
- **侧边栏按标签页显示范围控制**，支持减少在不需要标签页中的干扰。
- **历史用户消息编辑**，支持从历史位置重新编辑并继续对话；该能力仅在 API 渠道启用。
- **上下文管理**，支持摘要压缩和最近 N 轮裁剪，降低长会话超过模型上下文的风险。
- **浏览器控制受控标签组**，会用 Chrome 原生标签组标识当前任务，并让 `list_pages` / `select_page` 等工具聚焦在受控范围内。
- 外部链接统一在浏览器新标签页打开，避免在侧边栏中加载外站失败。
- 扩展身份与本地升级链路会尽量保留设置，提升覆盖安装时的稳定性。

### 多驱动核心对比

项目内置了多种驱动方案，位于 `services/providers`，并通过代码逻辑动态适配不同的使用场景：

| 驱动方案                | 逻辑入口               | 支持模型                                         | 核心优势                                                                                                                        | 使用前提                                             |
| :---------------------- | :--------------------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------- |
| **Web Client**          | `web.js`               | 当前 Gemini Web 聊天模式                         | **免 API Key**，复用 Gemini 网页版会话，支持可选临时对话                                                                        | 需保持 Google 账号登录                               |
| **Official API**        | `official.js`          | Gemini 3.7 Flash / 3.5 Flash-Lite / 3.1 Pro      | **极速响应**，支持 **Thinking** 与 Google Search grounding                                                                      | 需 Google AI Studio Key                              |
| **OpenAI Compatible**   | `openai_compatible.js` | GPT/Claude/兼容模型                              | **高扩展性**，支持 Chat Completions / Responses API 与可选联网搜索                                                              | 需第三方服务密钥                                     |
| **OpenAI 官方 API**     | `openai_compatible.js` | GPT 推理/搜索模型                                | 专门走 Responses API，支持 reasoning summary 与可选联网搜索                                                                     | 需 OpenAI API Key                                    |
| **DeepSeek API**        | `openai_compatible.js` | DeepSeek 对话/推理模型                           | DeepSeek Chat Completions 默认端点，并显示 `reasoning_content`                                                                  | 需 DeepSeek API Key                                  |
| **DeepSeek 网页(免费)** | `deepseek_web.js`      | DeepSeek（统一融合模型：快速 + R1思考 + 多模态） | **免 API Key**，复用 `chat.deepseek.com` 免费会话；融合统一模型，支持思考过程展示与联网搜索；支持直接上传图片识图（PoW + fork） | 需 DeepSeek 账号登录（设置页配置手机号/邮箱 + 密码） |
| **OpenRouter API**      | `openai_compatible.js` | OpenRouter 模型 ID                               | 可拉取 `/models`，支持 provider routing JSON 与原生 `reasoning`                                                                 | 需 OpenRouter API Key                                |
| **通义 / DashScope**    | `openai_compatible.js` | Qwen 文本与 VL 模型                              | 专门 DashScope 兼容端点，发送 `enable_thinking` 并支持 VL 图片输入                                                              | 需 DashScope API Key                                 |
| **Anthropic API**       | `anthropic.js`         | Claude 模型                                      | 原生 Messages API，支持图片输入与 extended thinking 流式显示                                                                    | 需 Anthropic API Key                                 |
| **智谱 API**            | `openai_compatible.js` | GLM 模型                                         | 专门 GLM Chat Completions profile，并发送原生 thinking 开关 payload                                                             | 需智谱 API Key                                       |

### 浏览器控制能力集

基于 `background/control/` 模块和 Chrome DevTools Protocol 实现，AI 可以通过本地工具循环执行复杂的 Agent 任务：

| 分类         | 核心指令                                                               | 代码实现逻辑                                                                            |
| :----------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **导航控制** | `navigate_page`, `new_page`, `close_page`, `list_pages`, `select_page` | 调用 `chrome.tabs` 进行页面生命周期管理                                                 |
| **页面交互** | `click`, `hover`, `fill`, `fill_form`, `press_key`, `type_text`        | 基于 **Accessibility Tree** 生成 UID 进行精准操控，支持悬停、批量填表、组合键与聚焦输入 |
| **数据观测** | `take_snapshot`, `wait_for`, `handle_dialog`                           | 提取页面无障碍树并生成可复用 UID，也可等待目标文本出现或处理阻塞弹窗                    |
| **脚本执行** | `evaluate_script`                                                      | 在网页 Context 中运行自定义 JavaScript                                                  |

浏览器控制启用后会锁定一个目标标签页，并用 Chrome 原生标签组展示当前任务标题。`select_page` 默认只在受控标签组内切换；`new_page` 的普通标签页会加入该组，`background: true` 则会打开独立 popup 窗口以减少焦点干扰。

### 外部 MCP 工具

DeepSeek Zoom 可以选择连接到一个或多个外部 MCP 服务器（通过 **SSE**、**可流式传输的 HTTP** 或 **WebSocket**），并在现有的工具循环（Tool Loop）中执行其工具。

#### 推荐方案：使用本地代理（支持 stdio 服务器）

由于 Chrome 扩展程序无法直接运行基于 stdio 的 MCP 服务器，推荐的设置方案是运行一个本地代理（例如 [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) Proxy）。在代理中配置您的 MCP 服务器（包括 stdio 服务器），然后将 DeepSeek Zoom 连接到该代理端点。

常见的代理端点如下：

- **SSE**: `http://127.0.0.1:3006/sse`
- **可流式传输的 HTTP**: `http://127.0.0.1:3006/mcp`
- **WebSocket**: `ws://127.0.0.1:3006/mcp`

#### 设置步骤

1. 启动您的 MCP 代理并在其中配置好 MCP 服务器。
2. 在 **设置 (Settings) -> 连接 (Connection) -> 外部 MCP 工具 (External MCP Tools)** 中：
    - 启用“外部 MCP 工具” (Enable External MCP Tools)。
    - 新增或选择服务器条目；**活动服务器** (Active Server) 表示当前正在编辑的条目，对话时会使用所有已启用的服务器。
    - 选择传输协议并设置服务器 URL（SSE / 可流式传输的 HTTP / WebSocket）。
    - 如需自定义请求头，请使用 SSE 或可流式传输的 HTTP；浏览器扩展环境下 WebSocket 传输不支持自定义 headers。
    - 点击**测试连接** (Test Connection) 和**刷新工具** (Refresh Tools)。
3. 可选（当工具较多时推荐）：将**公开工具** (Expose Tools) 设置为**仅限选定工具** (Selected tools only)，然后仅启用您希望模型查看/使用的工具。
4. 开始正常对话；当模型需要使用工具时，它会输出一个如下所示的 JSON 工具块。多服务器模式下，模型可能会使用 `serverId__toolName` 形式的唯一工具名来路由到具体服务器：

    ```json
    { "tool": "工具名称", "args": { "键": "值" } }
    ```

### 核心功能亮点

- **智能侧边栏**：基于 `sidePanel` API，提供毫秒级唤起的对话空间，支持全文搜索历史记录。
- **划词工具栏**：注入 Content Script，选中文字即刻进行**翻译、总结、解释、语法修正**，支持一键回填表单。
- **图像与截图输入**：
    - **OCR & 截图翻译**：集成 Canvas 裁剪技术，框选图片区域即刻提取文字并翻译。
    - **屏幕/窗口截图**：侧边栏可通过浏览器的 `display-capture` 能力选择其他屏幕或应用窗口作为图像输入。
    - **浮窗探测**：自动识别网页图片并生成悬浮 AI 分析按钮。
    - **生成图像展示**：展示拉取到的 Gemini 原图，不在本地重写图片像素。
    - Gemini Web 逆向驱动当前支持图片附件；PDF、文本、文档类附件请使用 Gemini API 渠道。
- **安全渲染**：所有 Markdown、LaTeX 公式及代码块均在 `sandbox` 隔离环境中渲染，确保主页面安全。

### Gemini Web 维护说明

Gemini Web **依赖逆向协议**,在无官方授权的情况下访问 Google 内部 API,这很可能违反 Google 服务条款。契约可能随网站更新而变化,当前状态记录在 [`docs/gemini-web-reverse.md`](docs/gemini-web-reverse.md),包含已验证 token、RPC 路径、上传流程、模型 hash、临时对话标记、暂不支持的 image-preview 模型路由,以及手动漂移检查命令。

### DeepSeek Web 维护说明

DeepSeek Web 渠道同样**依赖逆向协议**，在无官方授权的情况下访问 `chat.deepseek.com` 的私有接口（账号登录、PoW 挑战求解、聊天 SSE 流、文件上传与 fork），这很可能违反 DeepSeek 服务条款。契约可能随网站更新而变化，当前状态记录在 [`docs/deepseek-web-reverse.md`](docs/deepseek-web-reverse.md)，包含登录流程、PoW 机制、三模式（快速/专家/识图）路由、思考与联网搜索开关、文件上传与 fork 流程，以及漂移检查建议。

**风险自负**：使用 DeepSeek Web 渠道即意味着您承认潜在的服务条款违反，并承担相应后果。

### 快速开始

#### 仓库结构

本仓库根目录就是可运行的 Chrome 扩展项目根目录。`package.json`、`manifest.json`、Vite 配置、源码、测试和打包脚本都位于根目录。跨运行域共享的工具代码位于 `shared/`，并按能力分组到 `shared/attachments/`、`shared/config/`、`shared/dom/`、`shared/logging/`、`shared/mcp/`、`shared/media/`、`shared/messaging/`、`shared/models/`、`shared/settings/`、`shared/text/`、`shared/ui/` 和 `shared/utils/`；不再保留顶层 `shared/*.js` 兼容入口。模块目录的聚合入口统一使用目录内 `index.js`，避免出现同级 `foo.js` 与 `foo/` 并存；运行域入口保留为各运行域根部的 `index.js`，例如 `background/index.js`、`content/index.js`、`sandbox/index.js`、`sidepanel/index.js`，以及独立设置页 `settings/index.js`。运行时代码文件使用 `snake_case`，仓库工具脚本和工作流文件可使用 `kebab-case`。

#### 安装步骤

1. 从 [Releases](https://github.com/DaveWooo/Deepseek-Zoom/releases) 下载最新 ZIP 包并解压。
2. Chrome 访问 `chrome://extensions/`，右上角开启 **“开发者模式”**。
3. 点击 **“加载已解压的扩展程序”**，选择解压后的文件夹即可。

#### 从源码构建与打包

```bash
# 1. 安装依赖
npm install

# 2. 完整质量检查（包含代码格式、TypeScript 类型检查、未引用导出及全量单元测试）
npm run check

# 3. 一键构建并生成扩展安装包与 Zip 归档 (输出至 artifacts/ 目录)
npm run package:extension
# 或者使用快捷别名
npm run package:zip
```

打包完成后：
- **解压调试目录**：位于 `artifacts/chrome-extension`，可在 Chrome `chrome://extensions/` 中点击 **“加载已解压的扩展程序”** 加载测试。
- **发布 Zip 压缩包**：自动生成于 `artifacts/deepseek-zoom-v<version>.zip`（如 `artifacts/deepseek-zoom-v6.2.0.zip`），根目录直接包含 `manifest.json` 与所有打包运行时资源，可直接用于分发或发布。

#### 推送版本并发布到 GitHub Release

本项目已配置 GitHub Actions 自动化发布工作流（`.github/workflows/package-extension.yml`）。当您完成版本开发并将带有 `v*` 的版本标签推送到 GitHub 时，CI/CD 流水线将自动执行全量测试、打包 Zip 产物、解析 `CHANGELOG.md` 提取版本更新日志，并自动创建/更新 GitHub Release：

```bash
# 1. 确保代码已提交，并已打上版本标签（以 v6.2.0 为例）
git tag v6.2.0

# 2. 推送主分支及所有标签至 GitHub（自动触发 GitHub Actions 发布 Release）
git push origin main --tags
```

> **提示（手动通过 GitHub CLI 发布备用方案）**：
> 若希望在本地直接创建或更新 GitHub Release，可使用官方 `gh` 命令行：
> ```bash
> # 本地打包
> npm run package:extension
> # 通过 gh 命令行直接上传发布
> gh release create v6.2.0 artifacts/deepseek-zoom-v6.2.0.zip --title "v6.2.0" --notes-file CHANGELOG.md
> ```

#### 发布到 Chrome Web Store

Chrome Web Store 发布凭据只保存在本机，不要提交到仓库：

```bash
cp .env.chrome-webstore.example .env.chrome-webstore
```

编辑 `.env.chrome-webstore`，填入 `CHROME_WEBSTORE_PUBLISHER_ID`、`CHROME_WEBSTORE_ITEM_ID` 和具备 `https://www.googleapis.com/auth/chromewebstore` scope 的 `CHROME_WEBSTORE_ACCESS_TOKEN`。准备好 ZIP 后运行：

```bash
npm run publish:chrome-webstore
```

脚本会调用 Chrome Web Store API v2 上传 `CHROME_WEBSTORE_ZIP_PATH` 指向的 ZIP，并提交发布审核。

### 技术栈

- **构建工具**：Vite + TypeScript
- **架构协议**：Chrome MV3 + Chrome DevTools Protocol + 本地/外部 MCP 工具调用
- **核心库**：Marked.js, KaTeX, Highlight.js, Fuse.js

### 许可证

本项目基于 **MIT License** 开源。

### 致谢

本项目已在 [LINUX DO 社区](https://linux.do) 发布，感谢社区的支持与反馈。
