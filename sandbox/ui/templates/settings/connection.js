import { createSettingsHelpButton } from './help_button.js';
import { DEFAULT_MCP_HTTP_URL } from '../../../../shared/config/constants.js';

export const ConnectionSettingsTemplate = `
    <div class="setting-group">
        <h4 data-i18n="apiSettings">API</h4>

        <div class="setting-panel">
            <label class="setting-label" data-i18n="connectionProvider">Model Provider</label>
            <select id="provider-select" class="settings-input settings-select">
                <option value="deepseek_web" data-i18n="providerDeepSeekWeb">DeepSeek 网页(免费版)</option>
                <option value="web" data-i18n="providerWeb">Gemini Web Client (Free)</option>
                <option value="official" data-i18n="providerOfficial">Google Gemini API</option>
                <option value="openai" data-i18n="providerOpenAI">OpenAI Compatible API</option>
                <option value="openai_official" data-i18n="providerOpenAIOfficial">OpenAI Official API</option>
                <option value="deepseek" data-i18n="providerDeepSeek">DeepSeek API</option>
                <option value="openrouter" data-i18n="providerOpenRouter">OpenRouter API</option>
                <option value="dashscope" data-i18n="providerDashScope">Qwen / DashScope API</option>
                <option value="anthropic" data-i18n="providerAnthropic">Anthropic API</option>
                <option value="zhipu" data-i18n="providerZhipu">Zhipu API</option>
            </select>

            <div id="web-fields" class="settings-stack settings-section-offset">
                <div class="setting-panel-row">
                    <div class="setting-panel-header">
                        <h5 data-i18n="webTemporaryChat">Temporary chat</h5>
                    </div>
                    <input type="checkbox" id="web-temporary-chat-enabled" class="setting-toggle" />
                </div>
            </div>

            <div id="deepseek-web-fields" class="settings-stack settings-section-offset" hidden>
                <div class="settings-subcard">
                    <div class="deepseek-web-login-grid">
                        <div class="setting-field">
                            <span data-i18n="deepseekWebPhoneOrEmail">Phone / Email</span>
                            <input type="text" id="deepseek-web-phone" class="settings-input settings-full-input" data-i18n-placeholder="deepseekWebPhoneOrEmailPlaceholder" placeholder="手机号 or email@example.com">
                        </div>
                        <div class="setting-field">
                            <span data-i18n="deepseekWebPassword">Password</span>
                            <input type="password" id="deepseek-web-password" class="settings-input settings-full-input" data-i18n-placeholder="deepseekWebPasswordPlaceholder" placeholder="密码">
                        </div>
                    </div>
                    <div class="settings-action-row">
                        <button id="deepseek-web-login" class="btn-primary settings-small-button" type="button" data-i18n="deepseekWebLogin">Login</button>
                        <div id="deepseek-web-login-status" class="settings-muted-text"></div>
                    </div>
                </div>

                <div class="deepseek-web-options-grid">
                    <div class="setting-panel-row deepseek-web-option-card">
                        <div class="setting-panel-header">
                            <h5 data-i18n="deepseekWebThinkingR1">Deep Thinking (R1)</h5>
                        </div>
                        <input type="checkbox" id="deepseek-web-thinking-enabled" class="setting-toggle" checked />
                    </div>
                    <div class="setting-panel-row deepseek-web-option-card">
                        <div class="setting-panel-header">
                            <h5 data-i18n="deepseekWebDeepSearch">Deep Search (Web)</h5>
                        </div>
                        <input type="checkbox" id="deepseek-web-search-enabled" class="setting-toggle" checked />
                    </div>
                </div>

                <div class="setting-field">
                    <span data-i18n="deepseekWebDefaultModel">Default Model</span>
                    <select id="deepseek-web-model-type" class="settings-input settings-select">
                        <option value="vision" data-i18n="deepseekWebModelVision">DeepSeek Vision (识图)</option>
                        <option value="default" data-i18n="deepseekWebModelDefault" selected>DeepSeek最新版模型 (快速)</option>
                        <option value="expert" data-i18n="deepseekWebModelExpert">DeepSeek R1 (专家)</option>
                    </select>
                </div>

                <div class="setting-field">
                    <span data-i18n="deepseekWebEnabledModels">Quick Models (Toolbar & Sidepanel)</span>
                    <div class="deepseek-web-model-toggles">
                        <label class="deepseek-web-model-toggle" data-model-type="default" title="快速模式 (DeepSeek最新版模型)">
                            <span class="model-status-dot model-status-enabled" id="deepseek-web-status-default"></span>
                            <span class="deepseek-web-model-toggle-label" data-i18n="deepseekWebModelDefaultShort">快速</span>
                            <input type="checkbox" id="deepseek-web-model-enabled-default" class="setting-toggle" checked />
                        </label>
                        <label class="deepseek-web-model-toggle" data-model-type="expert" title="专家模式 (DeepSeek R1)">
                            <span class="model-status-dot model-status-enabled" id="deepseek-web-status-expert"></span>
                            <span class="deepseek-web-model-toggle-label" data-i18n="deepseekWebModelExpertShort">专家</span>
                            <input type="checkbox" id="deepseek-web-model-enabled-expert" class="setting-toggle" checked />
                        </label>
                        <label class="deepseek-web-model-toggle" data-model-type="vision" title="识图模式 (DeepSeek Vision)">
                            <span class="model-status-dot model-status-enabled" id="deepseek-web-status-vision"></span>
                            <span class="deepseek-web-model-toggle-label" data-i18n="deepseekWebModelVisionShort">识图</span>
                            <input type="checkbox" id="deepseek-web-model-enabled-vision" class="setting-toggle" checked />
                        </label>
                    </div>
                </div>

                <div class="settings-action-row">
                    <button type="button" id="deepseek-web-test-btn" class="deepseek-web-test-btn" data-i18n="deepseekWebTestConnection">验证连通性</button>
                    <span id="deepseek-web-test-status" class="settings-muted-text"></span>
                </div>
            </div>

            <div id="api-key-container" class="settings-stack settings-section-offset" hidden>
                <div id="official-fields" class="settings-stack tight" hidden>
                    <div class="setting-field">
                        <span data-i18n="baseUrl">Base URL</span>
                        <input type="text" id="official-base-url" class="settings-input settings-full-input" data-i18n-placeholder="officialBaseUrlPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="apiKey">API Key</span>
                        <input type="password" id="api-key-input" class="settings-input settings-full-input" data-i18n-placeholder="apiKeyPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="modelIds">Model IDs</span>
                        <input type="text" id="official-model" class="settings-input settings-full-input" data-i18n-placeholder="officialModelPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="thinkingLevelGemini3">Thinking Level</span>
                        <select id="thinking-level-select" class="settings-input settings-select">
                            <option value="minimal" data-i18n="thinkingMinimalFlashOnly">Minimal</option>
                            <option value="low" data-i18n="thinkingLowFaster">Low</option>
                            <option value="medium" data-i18n="thinkingMediumBalanced">Medium</option>
                            <option value="high" data-i18n="thinkingHighDeepReasoning">High</option>
                        </select>
                    </div>
                    <div class="setting-panel-row settings-section-offset">
                        <div class="setting-panel-header">
                            <h5 data-i18n="officialWebSearch">Google Search grounding</h5>
                        </div>
                        <input type="checkbox" id="official-web-search-enabled" class="setting-toggle" />
                    </div>
                </div>

                <div id="openai-fields" class="settings-stack tight" hidden>
                    <div class="setting-field">
                        <span data-i18n="baseUrl">Base URL</span>
                        <input type="text" id="openai-base-url" class="settings-input settings-full-input" data-i18n-placeholder="baseUrlPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="apiKey">API Key</span>
                        <input type="password" id="openai-api-key" class="settings-input settings-full-input" data-i18n-placeholder="apiKeyPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="modelIdsCommaSeparated">Model IDs</span>
                        <input type="text" id="openai-model" class="settings-input settings-full-input" data-i18n-placeholder="modelIdPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="thinkingLevel">Thinking Level</span>
                        <select id="openai-thinking-level-select" class="settings-input settings-select">
                            <option value="minimal" data-i18n="thinkingMinimal">Minimal</option>
                            <option value="low" data-i18n="thinkingLow">Low</option>
                            <option value="medium" data-i18n="thinkingMedium">Medium</option>
                            <option value="high" data-i18n="thinkingHigh">High</option>
                        </select>
                    </div>
                    <div class="setting-panel-row settings-section-offset">
                        <div class="setting-panel-header">
                            <h5 data-i18n="openaiUseResponsesApi">Use Responses API</h5>
                        </div>
                        <input type="checkbox" id="openai-use-responses-api" class="setting-toggle" />
                    </div>
                    <div class="setting-panel-row">
                        <div class="setting-panel-header">
                            <h5 data-i18n="openaiWebSearch">OpenAI Web search</h5>
                        </div>
                        <input type="checkbox" id="openai-web-search-enabled" class="setting-toggle" />
                    </div>
                </div>

                <div id="dedicated-api-fields" class="settings-stack tight" hidden>
                    <div class="setting-field">
                        <span data-i18n="baseUrl">Base URL</span>
                        <input type="text" id="dedicated-api-base-url" class="settings-input settings-full-input" data-i18n-placeholder="baseUrlPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="apiKey">API Key</span>
                        <input type="password" id="dedicated-api-api-key" class="settings-input settings-full-input" data-i18n-placeholder="apiKeyPlaceholder">
                    </div>
                    <div class="setting-field">
                        <span data-i18n="modelIdsCommaSeparated">Model IDs</span>
                        <div class="settings-action-row">
                            <input type="text" id="dedicated-api-model" class="settings-input settings-full-input settings-flex-fill" data-i18n-placeholder="modelIdPlaceholder">
                            <button id="dedicated-api-refresh-models" class="btn-secondary settings-small-button" type="button" data-i18n="refreshModels" hidden>Refresh</button>
                        </div>
                        <div id="dedicated-api-model-list-status" class="settings-muted-text" role="status" aria-live="polite" hidden></div>
                    </div>
                    <div class="setting-field">
                        <span data-i18n="thinkingLevel">Thinking Level</span>
                        <select id="dedicated-api-thinking-level-select" class="settings-input settings-select">
                            <option value="minimal" data-i18n="thinkingMinimal">Minimal</option>
                            <option value="low" data-i18n="thinkingLow">Low</option>
                            <option value="medium" data-i18n="thinkingMedium">Medium</option>
                            <option value="high" data-i18n="thinkingHigh">High</option>
                        </select>
                    </div>
                    <div id="dedicated-api-web-search-row" class="setting-panel-row settings-section-offset" hidden>
                        <div class="setting-panel-header">
                            <h5 data-i18n="openaiWebSearch">OpenAI Web search</h5>
                        </div>
                        <input type="checkbox" id="dedicated-api-web-search-enabled" class="setting-toggle" />
                    </div>
                    <div id="dedicated-api-provider-routing-row" class="setting-field" hidden>
                        <span data-i18n="providerRouting">Provider Routing (JSON)</span>
                        <textarea id="dedicated-api-provider-routing" class="settings-input settings-full-input settings-monospace-textarea" data-i18n-placeholder="providerRoutingPlaceholder"></textarea>
                    </div>
                </div>
            </div>
        </div>

        <div class="setting-panel">
            <div class="setting-panel-row">
                <div class="setting-panel-header">
                    <h5><span data-i18n="mcpTools">MCP External Tools</span>${createSettingsHelpButton('mcpToolsDesc')}</h5>
                </div>
                <input type="checkbox" id="mcp-enabled" class="setting-toggle" />
            </div>

            <div id="mcp-fields" class="settings-stack settings-section-offset" hidden>
                <div class="setting-field">
                    <span data-i18n="mcpActiveServer">Active Server</span>
                    <div class="settings-action-row">
                        <select id="mcp-server-select" class="settings-input settings-select settings-flex-fill"></select>
                        <button id="mcp-add-server" class="btn-primary settings-small-button" type="button" data-i18n="mcpAddServer">Add</button>
                        <button id="mcp-remove-server" class="btn-secondary settings-small-button" type="button" data-i18n="mcpRemoveServer">Del</button>
                    </div>
                </div>

                <div class="setting-field">
                    <span data-i18n="mcpServerName">Name</span>
                    <input type="text" id="mcp-server-name" class="settings-input settings-full-input" placeholder="Local Proxy">
                </div>
                <div class="setting-field">
                    <span data-i18n="mcpTransport">Transport</span>
                    <select id="mcp-transport" class="settings-input settings-select">
                        <option value="streamable-http">Streamable HTTP (official, http://.../mcp)</option>
                        <option value="sse">SSE</option>
                        <option value="ws">Custom WebSocket (non-standard, ws://)</option>
                    </select>
                </div>
                <div class="setting-field">
                    <span data-i18n="mcpServerUrl">URL</span>
                    <input type="text" id="mcp-server-url" class="settings-input settings-full-input" placeholder="${DEFAULT_MCP_HTTP_URL}">
                </div>
                <div class="setting-field">
                    <span class="setting-field-label"><span data-i18n="mcpHeaders">Request Headers (JSON)</span>${createSettingsHelpButton('mcpHeadersDesc')}</span>
                    <textarea id="mcp-headers" class="settings-input settings-full-input settings-monospace-textarea" data-i18n-placeholder="mcpHeadersPlaceholder"></textarea>
                </div>

                <div class="setting-panel-row settings-section-offset">
                    <div class="setting-panel-header">
                        <h5 data-i18n="enabled">Server Enabled</h5>
                    </div>
                    <div class="settings-action-row">
                        <button id="mcp-test-connection" class="btn-secondary settings-small-button" type="button" data-i18n="mcpTestConnection">Test</button>
                        <input type="checkbox" id="mcp-server-enabled" class="setting-toggle" />
                    </div>
                </div>
                <div id="mcp-test-status" class="settings-muted-text"></div>

                <div class="settings-stack compact settings-panel-fieldset">
                    <div class="setting-field">
                        <span data-i18n="mcpToolMode">Expose Tools</span>
                        <select id="mcp-tool-mode" class="settings-input settings-select">
                            <option value="all" data-i18n="mcpToolModeAll">All</option>
                            <option value="selected" data-i18n="mcpToolModeSelected">Selected</option>
                        </select>
                    </div>

                    <div class="mcp-action-row settings-action-row">
                        <button id="mcp-refresh-tools" class="btn-secondary settings-small-button" type="button" data-i18n="mcpRefreshTools">Refresh</button>
                        <button id="mcp-enable-all-tools" class="btn-secondary settings-small-button" type="button" data-i18n="mcpEnableAllTools">All</button>
                        <button id="mcp-disable-all-tools" class="btn-secondary settings-small-button" type="button" data-i18n="mcpDisableAllTools">None</button>
                    </div>

                    <input type="text" id="mcp-tool-search" class="settings-input settings-full-input" data-i18n-placeholder="mcpToolSearchPlaceholder">
                    <div id="mcp-tools-summary" class="settings-muted-text"></div>
                    <div id="mcp-tool-list" class="mcp-tool-list"></div>
                </div>
            </div>
        </div>
    </div>`;
