# DeepSeek Web 逆向工程技术方案

Last drafted: 2026-08-18 (基于 Fly143/deepseek-free-api 逆向实现分析)

## 1. 认证机制

### 1.1 登录

DeepSeek Web 使用 RESTful JSON API（非 Gemini 的 RPC），认证方式清晰简单：

**Endpoint:** `POST https://chat.deepseek.com/api/v0/users/login`

**请求体:**

```json
{
    "email": "",
    "mobile": "13800138000",
    "area_code": "+86",
    "password": "your_password",
    "device_id": "<random-16-byte-hex>",
    "os": "web"
}
```

**响应:**

```json
{
    "code": 0,
    "data": {
        "biz_code": 0,
        "biz_data": {
            "user": { "token": "eyJhbGciOi..." }
        }
    }
}
```

Token 格式为 JWT，通过 `Authorization: Bearer <token>` 传递。

### 1.2 会话创建

**Endpoint:** `POST https://chat.deepseek.com/api/v0/chat_session/create`

**请求体:** `{}`

**响应:**

```json
{
    "data": {
        "biz_data": {
            "chat_session": { "id": "session_uuid" }
        }
    }
}
```

### 1.3 与 Gemini Web 对比

| 维度     | Gemini Web                              | DeepSeek Web            |
| -------- | --------------------------------------- | ----------------------- |
| 认证方式 | HTML 内嵌 token（atValue/blValue/fSid） | JWT Bearer Token        |
| 获取方式 | 解析页面 HTML                           | JSON API 登录           |
| 请求格式 | form-urlencoded + jspb header           | 标准 JSON POST          |
| 流式格式 | 自定义 length-prefix 行                 | 标准 SSE (data: JSON)   |
| 反爬机制 | 无明显 PoW                              | **PoW (Proof of Work)** |

---

## 2. PoW (Proof of Work) 机制 ⚠️ 关键难点

DeepSeek Web 在每次聊天请求前要求完成 PoW 挑战，这是最大的技术门槛。

### 2.1 获取挑战

**Endpoint:** `POST https://chat.deepseek.com/api/v0/chat/create_pow_challenge`

**请求体:** `{ "target_path": "/api/v0/chat/completion" }`

**响应:**

```json
{
    "data": {
        "biz_data": {
            "challenge": {
                "algorithm": "sha3",
                "challenge": "hex_string",
                "salt": "hex_string",
                "difficulty": 18,
                "signature": "hex_string",
                "target_path": "/api/v0/chat/completion"
            }
        }
    }
}
```

### 2.2 求解 PoW

- 算法：SHA-3 (keccak)
- 要求：找到 nonce 使得 `hash(salt + challenge + nonce)` 的前 N 位（difficulty）为 0
- 官方使用 WASM 加速，Fly143 项目提供了 Node.js WASM bridge + Python fallback
- Chrome 扩展内可直接用 Web Crypto API 或内嵌 WASM 求解
- 求解结果 base64 编码后放入 `x-ds-pow-response` header

### 2.3 PoW 响应格式

```json
{
    "algorithm": "sha3",
    "challenge": "...",
    "salt": "...",
    "answer": 12345,
    "signature": "...",
    "target_path": "/api/v0/chat/completion"
}
```

Base64 编码后作为 `x-ds-pow-response` header 发送。

---

## 3. 核心 Chat API

### 3.1 聊天 Completion

**Endpoint:** `POST https://chat.deepseek.com/api/v0/chat/completion`

**Headers:**

```
content-type: application/json
origin: https://chat.deepseek.com
referer: https://chat.deepseek.com/a/chat/s/<session_id>
user-agent: Mozilla/5.0 ...
x-client-version: 2.0.2
x-client-platform: web
authorization: Bearer <jwt_token>
x-ds-pow-response: <base64-pow-result>
```

**请求体:**

```json
{
    "chat_session_id": "<session_id>",
    "parent_message_id": null,
    "prompt": "用户消息",
    "ref_file_ids": [],
    "thinking_enabled": false,
    "search_enabled": false,
    "model_type": "default"
}
```

### 3.2 model_type 字段

| 值        | 对应模型                 | 说明                                        |
| --------- | ------------------------ | ------------------------------------------- |
| `default` | DeepSeek-V4 Flash (快速) | 默认对话模型（Nexus 中默认模式）            |
| `expert`  | DeepSeek-R1 (专家)       | 推理模型，**不支持文件上传**                |
| `vision`  | Vision 模型 (识图)       | 多模态，需配合 `ref_file_ids`（已实现上传） |

> Nexus 中三个模式均开放，默认快速模式（default）。settings UI 中可分别开关每个模式，右键弹窗仅展示已开启的模式。
> 识图模式（vision）已实现：上传图片（multipart + PoW 对应 `/api/v0/file/upload_file`）获取 `file_id` 后填入 `ref_file_ids`。

### 3.3 流式响应格式 (SSE)

DeepSeek 使用标准 SSE，但内部有两种子格式（old/new），均需支持：

**Old 格式 (path-based):**

```
data: {"p":"response/thinking_content","v":"嗯，让我想想"}    ← thinking 段
data: {"o":"APPEND","v":"..."}                          ← thinking 续
data: {"p":"response/content","o":"APPEND","v":"你好"}   ← 正文段
data: {"v":"！"}                                              ← 正文续
data: {"p":"response/status","v":"FINISHED"}               ← 结束
```

**New 格式 (fragment-based):**

```
data: {"v":{"response":{"fragments":[{"type":"THINK","content":"..."}]}}}  ← 元数据
data: {"p":"response/fragments","o":"APPEND","v":[{"type":"RESPONSE","content":"你好"}]}  ← 正文
data: {"p":"response/fragments/-1/content","o":"APPEND","v":"！"}               ← 正文续
```

### 3.4 SSE 字段含义

| 字段            | 含义                               |
| --------------- | ---------------------------------- |
| `p` (path)      | JSON patch path，标识数据类型      |
| `v` (value)     | 值：字符串（内容）或对象（元数据） |
| `o` (operation) | `"APPEND"` = 追加，null = 首次设置 |

---

## 4. 模型发现 API

**Endpoint:** `GET https://chat.deepseek.com/api/v0/client/settings?did=<uuid>&scope=model`

动态获取当前可用的模型列表和配置，无需硬编码：

```json
{
  "data": {
    "biz_data": {
      "settings": {
        "model_configs": {
          "value": [
            {
              "model_type": "default",
              "enabled": true,
              "input_character_limit": 2621440,
              "think_feature": { ... },
              "search_feature": { ... }
            }
          ]
        }
      }
    }
  }
}
```

每个 model_type 可生成 4 个变体（基础 / +thinking / +search / +thinking+search）。

---

## 5. 文件上传 API

**Endpoint:** `POST https://chat.deepseek.com/api/v0/file/upload_file`

- 需要 PoW（target_path = `/api/v0/file/upload_file`）
- multipart/form-data，字段名 `file`
- 返回 `file_id`，传入 chat 请求的 `ref_file_ids`

---

## 6. 与现有架构的集成方案

### 6.1 新增文件

| 文件                                             | 职责                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| `services/providers/deepseek_web.js`             | DeepSeek Web 驱动主逻辑（sendDeepSeekWebMessage） |
| `services/providers/shared/deepseek_web_auth.js` | 认证管理（登录/token刷新/会话创建）               |
| `services/providers/shared/deepseek_web_pow.js`  | PoW 挑战获取 + SHA-3 求解                         |
| `services/providers/shared/deepseek_web_sse.js`  | SSE 流解析（old/new 两种格式）                    |
| `shared/models/deepseek_web_models.js`           | DeepSeek Web 模型目录（动态发现）                 |

### 6.2 需修改的文件

| 文件                                | 修改内容                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `background/index.js`               | 注册 DeepSeek Web provider 路由                                    |
| `shared/config/constants_global.js` | 新增 `PROVIDER_DEEPSEEK_WEB` 常量                                  |
| `settings/`                         | 设置页面新增 DeepSeek Web 配置 UI（手机号/邮箱/密码 或手动 token） |
| `shared/settings/`                  | 设置存取逻辑新增 deepseek_web 配置块                               |

### 6.3 复用的 shared 模块

- `shared/utils/index.js` — UUID 生成等通用工具
- `shared/logging/debug.js` — 调试日志
- `shared/attachments/` — 文件附件归一化

### 6.4 Settings 新增字段

```json
{
    "deepseek_web": {
        "enabled": false,
        "token": "",
        "session_id": "",
        "login_type": "phone", // "phone" | "email" | "manual"
        "mobile": "",
        "area_code": "+86",
        "email": "",
        "_password": "",
        "auto_refresh": true,
        "thinking_enabled": false,
        "search_enabled": false,
        "model_type": "default" // "default" | "expert" | "vision"
    }
}
```

---

## 7. PoW 求解在 Chrome 扩展中的实现

### 方案：内嵌 WASM

1. 从 Fly143/deepseek-free-api 提取 `sha3_wasm_bg.wasm`（已在仓库中）
2. 在 Service Worker (background) 中通过 `WebAssembly.instantiate` 加载
3. 实现 SHA-3 keccak 暴力搜索 nonce
4. difficulty 通常为 18（前 18 bit 为 0），普通机器约 1-5 秒

### 备选方案

- **Web Crypto API**：标准 SubtleCrypto 不直接支持 keccak，需要 polyfill
- **JS 纯实现**：性能较差，但简单场景可用

---

## 8. 风险和限制

### 8.1 PoW 延迟

每次请求前需 1-5 秒求解 PoW，增加首次响应延迟。可通过预求解缓解。

### 8.2 Token 过期

Token 有效期有限（具体时长待确认），需要自动刷新机制（用保存的密码重新登录）。

### 8.3 免费版限制

- 可能有 rate limiting（频率限制）
- 长对话可能触发限制
- R1 (expert) 模型可能配额更少

### 8.4 AWS WAF

登录接口有 AWS WAF 保护，异常请求会返回 HTTP 202 + `x-amzn-waf-action` header。

### 8.5 服务条款

类似 Gemini Web，使用逆向 API 可能违反 DeepSeek 服务条款。

### 8.6 PoW 算法变更

DeepSeek 可能随时更新 PoW 算法参数或升级为更复杂的反爬机制。

---

## 9. 实现优先级

### ✅ P0（已完成）

1. ~~认证模块（登录 + token 存储 + 会话创建）~~ → `services/deepseek_web_auth.js`
2. ~~PoW 求解器（WASM 优先 + JS fallback）~~ → `services/providers/shared/deepseek_web_pow.js` + `sha3_wasm_bg.wasm`
3. ~~Chat completion 请求 + SSE 解析（双格式）~~ → `services/providers/deepseek_web.js`
4. ~~设置页面（手机号/邮箱/密码 + 开关）~~ → 模板/常量/元素/事件/bridge 全链路
5. ~~Provider 路由 + 401 自动刷新~~ → `request_dispatcher.js` + `settings_store.js`
6. ~~manifest.json CSP (wasm-unsafe-eval)~~

### ⏳ P1（待验证/待完善）

- 模型动态发现（`discoverDeepSeekModels` 已实现，需接入 UI）
- Thinking + Search 开关（UI 已有，后端已支持）
- Token 自动刷新（401 重试逻辑已实现）
- **Chrome 实测验证**（WASM 在 Service Worker 中加载、登录 API 无验证码）

### 📋 P2（高级功能）

- 文件/图片上传（Vision）
- 多账号轮换
- 临时对话（不保存历史）

---

## 10. 参考项目

- [Fly143/deepseek-free-api](https://github.com/Fly143/deepseek-free-api) — Python FastAPI 代理，本方案主要参考源（4624 行）
- [ForgetMeAI/FreeDeepseekAPI](https://github.com/ForgetMeAI/FreeDeepseekAPI) — 另一个 DeepSeek Web 逆向项目（303 stars）
