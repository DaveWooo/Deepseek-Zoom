import {
    DEFAULT_MCP_HTTP_URL,
    DEFAULT_MCP_SSE_URL,
    DEFAULT_MCP_TRANSPORT,
    DEFAULT_MCP_WS_URL,
    DEFAULT_OFFICIAL_BASE_URL,
    DEFAULT_OFFICIAL_MODELS,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PROVIDER,
    DEFAULT_STORED_GEMINI_MODEL,
    DEFAULT_THINKING_LEVEL,
} from '../config/constants.js';
import { createPrefixedId } from '../utils/index.js';
import { DEFAULT_WEB_THINKING_LEVEL, normalizeWebThinkingLevel } from '../models/web_thinking.js';
import { normalizeOpenAIWebSearchSettings } from './openai.js';
import {
    DEDICATED_API_STORAGE_KEYS,
    createDedicatedApiSettingsPayload,
    createDedicatedApiStorageUpdate,
    getDedicatedApiSelectedModel,
    isDedicatedApiProvider,
} from './dedicated_providers.js';

import { DEEPSEEK_WEB_MODEL_ENABLED_KEYS } from './deepseek_web.js';

export const DEEPSEEK_WEB_STORAGE_KEYS = [
    'deepseek_web_token',
    'deepseek_web_session_id',
    'deepseek_web_login_type',
    'deepseek_web_mobile',
    'deepseek_web_phone',
    'deepseek_web_area_code',
    'deepseek_web_email',
    'deepseek_web_password',
    'deepseek_web_thinking_enabled',
    'deepseek_web_search_enabled',
    'deepseek_web_model_type',
    ...DEEPSEEK_WEB_MODEL_ENABLED_KEYS,
];

export const GEMINI_WEB_MODEL_ENABLED_KEYS = [
    'gemini_web_model_enabled_flash',
    'gemini_web_model_enabled_lite',
    'gemini_web_model_enabled_pro',
];

export const CONNECTION_STORAGE_KEYS = [
    'geminiProvider',
    'geminiUseOfficialApi',
    'geminiModel',
    'geminiWebThinkingLevel',
    'geminiWebTemporaryChat',
    'geminiOfficialBaseUrl',
    'geminiApiKey',
    'geminiOfficialModel',
    'geminiThinkingLevel',
    'geminiOfficialWebSearch',
    'geminiOpenaiBaseUrl',
    'geminiOpenaiApiKey',
    'geminiOpenaiModel',
    'geminiOpenaiSelectedModel',
    'geminiOpenaiThinkingLevel',
    'geminiOpenaiUseResponsesApi',
    'geminiOpenaiWebSearchMode',
    'geminiOpenaiWebSearch',
    'geminiMcpEnabled',
    'geminiMcpTransport',
    'geminiMcpServerUrl',
    'geminiMcpServers',
    'geminiMcpActiveServerId',
    ...GEMINI_WEB_MODEL_ENABLED_KEYS,
    ...DEDICATED_API_STORAGE_KEYS,
    ...DEEPSEEK_WEB_STORAGE_KEYS,
];

export const GEMINI_OPENAI_WEB_SEARCH_KEYS = {
    useResponsesApiKey: 'geminiOpenaiUseResponsesApi',
    webSearchKey: 'geminiOpenaiWebSearch',
    webSearchModeKey: 'geminiOpenaiWebSearchMode',
};

export const LEGACY_OPENAI_WEB_SEARCH_KEYS = {
    fallbackUseResponsesApiKey: 'openaiUseResponsesApi',
    fallbackWebSearchKey: 'openaiWebSearch',
    fallbackWebSearchModeKey: 'openaiWebSearchMode',
};

export function getOpenAIWebSearchStorageKeys({ includeLegacyFallbacks = false } = {}) {
    return includeLegacyFallbacks
        ? { ...GEMINI_OPENAI_WEB_SEARCH_KEYS, ...LEGACY_OPENAI_WEB_SEARCH_KEYS }
        : GEMINI_OPENAI_WEB_SEARCH_KEYS;
}

export function isDeepSeekWebProvider(provider) {
    return provider === 'deepseek_web';
}

export function createDeepSeekWebStorageUpdate(deepseekWeb = {}) {
    const update = {};
    for (const key of DEEPSEEK_WEB_STORAGE_KEYS) {
        if (deepseekWeb[key] !== undefined) {
            update[key] = deepseekWeb[key];
        }
    }
    return update;
}

export function getConnectionProvider(storageData = {}) {
    return (
        storageData.geminiProvider ||
        (storageData.geminiUseOfficialApi === true ? 'official' : DEFAULT_PROVIDER)
    );
}

export function getSelectedModelForProvider(
    storageData = {},
    provider = getConnectionProvider(storageData)
) {
    if (provider === 'openai') {
        return (
            storageData.geminiOpenaiSelectedModel || storageData.geminiModel || DEFAULT_OPENAI_MODEL
        );
    }

    if (isDedicatedApiProvider(provider)) {
        return getDedicatedApiSelectedModel(storageData, provider);
    }

    return storageData.geminiModel || DEFAULT_STORED_GEMINI_MODEL;
}

export function createConnectionSettingsPayload(storageData = {}, options = {}) {
    const provider = getConnectionProvider(storageData);
    const selectedModel = getSelectedModelForProvider(storageData, provider);
    const openaiSettings = normalizeOpenAIWebSearchSettings(
        storageData,
        getOpenAIWebSearchStorageKeys(options)
    );

    // DeepSeek Web settings (full object with token, session, model type, per-model enabled flags)
    const deepseekWeb = {};
    for (const key of DEEPSEEK_WEB_STORAGE_KEYS) {
        if (storageData[key] !== undefined) deepseekWeb[key] = storageData[key];
    }

    return {
        provider,
        useOfficialApi: storageData.geminiUseOfficialApi === true,
        selectedModel,
        webThinkingLevel: normalizeWebThinkingLevel(storageData.geminiWebThinkingLevel),
        webTemporaryChat: storageData.geminiWebTemporaryChat === true,
        openaiSelectedModel: storageData.geminiOpenaiSelectedModel || '',
        officialBaseUrl: storageData.geminiOfficialBaseUrl || DEFAULT_OFFICIAL_BASE_URL,
        apiKey: storageData.geminiApiKey || '',
        officialModel: storageData.geminiOfficialModel || DEFAULT_OFFICIAL_MODELS,
        thinkingLevel: storageData.geminiThinkingLevel || DEFAULT_THINKING_LEVEL,
        officialWebSearch: storageData.geminiOfficialWebSearch === true,
        openaiBaseUrl: storageData.geminiOpenaiBaseUrl || '',
        openaiApiKey: storageData.geminiOpenaiApiKey || '',
        openaiModel: storageData.geminiOpenaiModel || '',
        openaiThinkingLevel: storageData.geminiOpenaiThinkingLevel || DEFAULT_THINKING_LEVEL,
        openaiUseResponsesApi: openaiSettings.useResponsesApi,
        openaiWebSearch: openaiSettings.webSearch,
        dedicatedApiProviders: createDedicatedApiSettingsPayload(storageData),
        mcpEnabled: storageData.geminiMcpEnabled === true,
        mcpTransport: storageData.geminiMcpTransport || DEFAULT_MCP_TRANSPORT,
        mcpServerUrl: storageData.geminiMcpServerUrl || DEFAULT_MCP_HTTP_URL,
        mcpServers: Array.isArray(storageData.geminiMcpServers)
            ? storageData.geminiMcpServers
            : null,
        mcpActiveServerId: storageData.geminiMcpActiveServerId || null,
        gemini_web_model_enabled_flash: storageData.gemini_web_model_enabled_flash !== false,
        gemini_web_model_enabled_lite: storageData.gemini_web_model_enabled_lite !== false,
        gemini_web_model_enabled_pro: storageData.gemini_web_model_enabled_pro !== false,
        deepseekWeb,
    };
}

export function createConnectionStorageUpdate(payload = {}) {
    return {
        geminiProvider: payload.provider,
        geminiUseOfficialApi: payload.provider === 'official',
        geminiWebThinkingLevel: normalizeWebThinkingLevel(payload.webThinkingLevel),
        geminiWebTemporaryChat: payload.webTemporaryChat === true,
        geminiOfficialBaseUrl: payload.officialBaseUrl || DEFAULT_OFFICIAL_BASE_URL,
        geminiApiKey: payload.apiKey || '',
        geminiOfficialModel: payload.officialModel || DEFAULT_OFFICIAL_MODELS,
        geminiThinkingLevel: payload.thinkingLevel || DEFAULT_THINKING_LEVEL,
        geminiOfficialWebSearch: payload.officialWebSearch === true,
        geminiOpenaiBaseUrl: payload.openaiBaseUrl || '',
        geminiOpenaiApiKey: payload.openaiApiKey || '',
        geminiOpenaiModel: payload.openaiModel || '',
        geminiOpenaiThinkingLevel: payload.openaiThinkingLevel || DEFAULT_THINKING_LEVEL,
        geminiOpenaiUseResponsesApi: payload.openaiUseResponsesApi === true,
        geminiOpenaiWebSearch: payload.openaiWebSearch === true,
        gemini_web_model_enabled_flash: payload.gemini_web_model_enabled_flash !== false,
        gemini_web_model_enabled_lite: payload.gemini_web_model_enabled_lite !== false,
        gemini_web_model_enabled_pro: payload.gemini_web_model_enabled_pro !== false,
        ...createDedicatedApiStorageUpdate(payload.dedicatedApiProviders),
        ...createDeepSeekWebStorageUpdate(payload.deepseekWeb),
        geminiMcpEnabled: payload.mcpEnabled === true,
        geminiMcpTransport: payload.mcpTransport || DEFAULT_MCP_TRANSPORT,
        geminiMcpServerUrl: payload.mcpServerUrl || '',
        geminiMcpServers: Array.isArray(payload.mcpServers) ? payload.mcpServers : [],
        geminiMcpActiveServerId: payload.mcpActiveServerId || null,
    };
}

export function getDefaultMcpUrlForTransport(transport) {
    const normalized = String(transport || DEFAULT_MCP_TRANSPORT).toLowerCase();
    if (normalized === 'ws' || normalized === 'websocket') return DEFAULT_MCP_WS_URL;
    if (normalized === 'streamable-http' || normalized === 'streamablehttp') {
        return DEFAULT_MCP_HTTP_URL;
    }
    return DEFAULT_MCP_SSE_URL;
}

export function createDefaultMcpServer(id = createPrefixedId('srv')) {
    return {
        id,
        name: 'Local Proxy',
        transport: DEFAULT_MCP_TRANSPORT,
        url: DEFAULT_MCP_HTTP_URL,
        headers: {},
        enabled: true,
        toolMode: 'all',
        enabledTools: [],
    };
}
