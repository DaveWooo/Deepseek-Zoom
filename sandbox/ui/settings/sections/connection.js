import {
    DEFAULT_MCP_TRANSPORT,
    DEFAULT_OFFICIAL_BASE_URL,
    DEFAULT_OFFICIAL_MODELS,
    DEFAULT_PROVIDER,
    DEFAULT_THINKING_LEVEL,
} from '../../../../shared/config/constants.js';
import {
    createDefaultMcpServer,
    getDefaultMcpUrlForTransport,
} from '../../../../shared/settings/connection.js';
import { inferMcpTransport, normalizeMcpHeaders } from '../../../../shared/mcp/transport.js';
import { normalizeOpenAIWebSearchSettings } from '../../../../shared/settings/openai.js';
import {
    isDedicatedApiProvider,
    normalizeDedicatedApiSettingsPayload,
} from '../../../../shared/settings/dedicated_providers.js';
import { formatMcpHeaders, parseMcpHeadersText } from './mcp_header_fields.js';
import { bindConnectionSectionEvents } from './connection_events.js';
import { sendToBackground } from '../../../../shared/messaging/index.js';
import {
    loadDedicatedApiProviderIntoForm,
    saveDedicatedApiProviderEdits,
} from './dedicated_api_fields.js';
import {
    loadDeepSeekWebIntoForm,
    saveDeepSeekWebEdits,
    updateDeepSeekWebStatusDots,
} from './deepseek_web_fields.js';
import {
    initializeMcpServers,
    loadActiveMcpServerIntoForm,
    renderMcpServerOptions,
    saveCurrentMcpServerEdits,
} from './mcp_server_fields.js';
import { setProviderModelList, setProviderModelListStatus } from './provider_model_list.js';
import { queryConnectionElements } from './connection_elements.js';
import { renderMcpToolsUI } from './mcp_tools_view.js';
import { t } from '../../../core/i18n.js';
import { createPrefixedId } from '../../../../shared/utils/index.js';
import { getSettingsElement } from '../dom.js';

export function createMcpServerId() {
    return createPrefixedId('srv');
}

export class ConnectionSection {
    constructor() {
        this.elements = {};
        this.mcpServers = [];
        this.mcpActiveServerId = null;
        this.activeProvider = null;
        this.dedicatedApiProviders = normalizeDedicatedApiSettingsPayload();
        this.mcpToolsCache = new Map(); // serverId -> { key, tools }
        this.mcpToolsUiState = new Map(); // serverId -> { openGroups: Set<string> }
        this.queryElements();
        this.bindEvents();
    }

    _makeServerId() {
        return createMcpServerId();
    }

    _getDefaultServer() {
        return createDefaultMcpServer(this._makeServerId());
    }

    _getDefaultUrlForTransport(transport) {
        return getDefaultMcpUrlForTransport(transport);
    }

    queryElements() {
        this.elements = queryConnectionElements(getSettingsElement);
    }

    bindEvents() {
        bindConnectionSectionEvents(this);
    }

    setData(data) {
        const {
            providerSelect,
            officialBaseUrl,
            apiKeyInput,
            officialModel,
            thinkingLevelSelect,
            webTemporaryChat,
            officialWebSearchEnabled,
            openaiBaseUrl,
            openaiApiKey,
            openaiModel,
            openaiThinkingLevelSelect,
            openaiUseResponsesApi,
            openaiWebSearch,
            mcpEnabled,
        } = this.elements;

        if (providerSelect) {
            const providerValue = data?.provider || DEFAULT_PROVIDER;
            providerSelect.value = providerValue;
            this.updateVisibility(providerValue);
        }

        if (officialBaseUrl)
            officialBaseUrl.value = data?.officialBaseUrl || DEFAULT_OFFICIAL_BASE_URL;
        if (apiKeyInput) apiKeyInput.value = data?.apiKey || '';
        if (officialModel) officialModel.value = data?.officialModel || DEFAULT_OFFICIAL_MODELS;
        if (thinkingLevelSelect)
            thinkingLevelSelect.value = data?.thinkingLevel || DEFAULT_THINKING_LEVEL;
        if (webTemporaryChat) webTemporaryChat.checked = data?.webTemporaryChat === true;
        if (officialWebSearchEnabled)
            officialWebSearchEnabled.checked = data?.officialWebSearch === true;

        if (openaiBaseUrl) openaiBaseUrl.value = data?.openaiBaseUrl || '';
        if (openaiApiKey) openaiApiKey.value = data?.openaiApiKey || '';
        if (openaiModel) openaiModel.value = data?.openaiModel || '';
        if (openaiThinkingLevelSelect)
            openaiThinkingLevelSelect.value = data?.openaiThinkingLevel || DEFAULT_THINKING_LEVEL;
        const openaiSettings = normalizeOpenAIWebSearchSettings(data || {});
        if (openaiUseResponsesApi) openaiUseResponsesApi.checked = openaiSettings.useResponsesApi;
        if (openaiWebSearch) openaiWebSearch.checked = openaiSettings.webSearch;

        // DeepSeek Web fields
        loadDeepSeekWebIntoForm(this, data?.deepseekWeb);

        this.dedicatedApiProviders = normalizeDedicatedApiSettingsPayload(
            data?.dedicatedApiProviders
        );
        this._loadDedicatedApiProviderIntoForm(providerSelect?.value || DEFAULT_PROVIDER);

        if (mcpEnabled) {
            mcpEnabled.checked = data?.mcpEnabled === true;
            this.updateMcpVisibility(mcpEnabled.checked);
        }

        initializeMcpServers(this, data);

        this._renderMcpServerOptions();
        this._loadActiveServerIntoForm();
        this.setMcpTestStatus('');
    }

    getData() {
        const {
            providerSelect,
            officialBaseUrl,
            apiKeyInput,
            officialModel,
            thinkingLevelSelect,
            webTemporaryChat,
            officialWebSearchEnabled,
            openaiBaseUrl,
            openaiApiKey,
            openaiModel,
            openaiThinkingLevelSelect,
            openaiUseResponsesApi,
            openaiWebSearch,
            mcpEnabled,
        } = this.elements;

        const provider = providerSelect ? providerSelect.value : DEFAULT_PROVIDER;
        this._saveDedicatedApiProviderEdits(provider);
        this._saveCurrentServerEdits();
        const servers = Array.isArray(this.mcpServers) ? this.mcpServers : [];
        const firstEnabled = servers.find(
            (serverConfig) =>
                serverConfig.enabled !== false && serverConfig.url && serverConfig.url.trim()
        );

        return {
            provider,
            officialBaseUrl: officialBaseUrl
                ? officialBaseUrl.value.trim()
                : DEFAULT_OFFICIAL_BASE_URL,
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : '',
            officialModel: officialModel ? officialModel.value.trim() : DEFAULT_OFFICIAL_MODELS,
            thinkingLevel: thinkingLevelSelect ? thinkingLevelSelect.value : DEFAULT_THINKING_LEVEL,
            webTemporaryChat: webTemporaryChat ? webTemporaryChat.checked === true : false,
            officialWebSearch: officialWebSearchEnabled
                ? officialWebSearchEnabled.checked === true
                : false,
            openaiBaseUrl: openaiBaseUrl ? openaiBaseUrl.value.trim() : '',
            openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : '',
            openaiModel: openaiModel ? openaiModel.value.trim() : '',
            openaiThinkingLevel: openaiThinkingLevelSelect
                ? openaiThinkingLevelSelect.value
                : DEFAULT_THINKING_LEVEL,
            openaiUseResponsesApi: openaiUseResponsesApi
                ? openaiUseResponsesApi.checked === true
                : false,
            openaiWebSearch: openaiWebSearch ? openaiWebSearch.checked === true : false,

            deepseekWeb: saveDeepSeekWebEdits(this),
            dedicatedApiProviders: this.dedicatedApiProviders,

            mcpEnabled: mcpEnabled ? mcpEnabled.checked === true : false,
            mcpServers: servers,
            mcpActiveServerId: this.mcpActiveServerId || (servers[0] ? servers[0].id : null),

            mcpTransport: firstEnabled
                ? firstEnabled.transport || DEFAULT_MCP_TRANSPORT
                : DEFAULT_MCP_TRANSPORT,
            mcpServerUrl: firstEnabled ? firstEnabled.url || '' : '',
        };
    }

    _updateDeepSeekWebStatusDots() {
        updateDeepSeekWebStatusDots(this);
    }

    updateVisibility(provider) {
        const {
            apiKeyContainer,
            webFields,
            officialFields,
            openaiFields,
            dedicatedApiFields,
            deepseekWebFields,
        } = this.elements;
        if (!apiKeyContainer) return;

        if (webFields) webFields.hidden = provider !== 'web';
        if (officialFields) officialFields.hidden = provider !== 'official';
        if (openaiFields) openaiFields.hidden = provider !== 'openai';
        if (dedicatedApiFields) dedicatedApiFields.hidden = !isDedicatedApiProvider(provider);
        if (deepseekWebFields) deepseekWebFields.hidden = provider !== 'deepseek_web';
        if (provider === 'web' || provider === 'deepseek_web') {
            apiKeyContainer.hidden = true;
        } else {
            apiKeyContainer.hidden = false;
            if (isDedicatedApiProvider(provider)) this._loadDedicatedApiProviderIntoForm(provider);
        }
        this.activeProvider = provider;
    }

    _saveDedicatedApiProviderEdits(provider = this.activeProvider) {
        saveDedicatedApiProviderEdits(this, provider);
    }

    _loadDedicatedApiProviderIntoForm(provider) {
        loadDedicatedApiProviderIntoForm(this, provider);
    }

    updateMcpVisibility(enabled) {
        const { mcpFields } = this.elements;
        if (!mcpFields) return;
        mcpFields.hidden = !enabled;
    }

    _getActiveServer() {
        if (!this.mcpServers || this.mcpServers.length === 0) return null;
        const activeId = this.mcpActiveServerId;
        const match = activeId
            ? this.mcpServers.find((serverConfig) => serverConfig.id === activeId)
            : null;
        return match || this.mcpServers[0];
    }

    _saveCurrentServerEdits() {
        return saveCurrentMcpServerEdits(this);
    }

    // Ask the background to close the live MCP transport for a server and
    // clear its tool-list cache. Best-effort: failures (e.g. SW restarted,
    // server never connected) are swallowed by the handler. This is the single
    // chokepoint for #11 (remove), #12 (cache invalidation), and #13 (save /
    // disable) — all three previously left the transport open.
    disconnectMcpServer(serverId) {
        if (!serverId) return;
        try {
            sendToBackground({ action: 'MCP_DISCONNECT', serverId });
        } catch (error) {
            console.warn('[MCP] Failed to request disconnect for server', serverId, error);
        }
    }

    _loadActiveServerIntoForm() {
        loadActiveMcpServerIntoForm(this);
    }

    _renderMcpServerOptions() {
        renderMcpServerOptions(this);
    }

    setMcpTestStatus(text, isError = false) {
        const { mcpTestStatus } = this.elements;
        if (!mcpTestStatus) return;
        mcpTestStatus.textContent = text || '';
        mcpTestStatus.classList.toggle('is-error', isError);
    }

    setProviderModelListStatus(text, isError = false) {
        setProviderModelListStatus(this, text, isError);
    }

    setProviderModelList(provider, models) {
        setProviderModelList(this, provider, models);
    }

    _serverKey(server) {
        const transport = (server.transport || 'sse').toLowerCase();
        const url = (server.url || '').trim();
        const headers = normalizeMcpHeaders(server.headers);
        const headersKey = Object.keys(headers)
            .sort((leftHeaderName, rightHeaderName) =>
                leftHeaderName.localeCompare(rightHeaderName)
            )
            .map((key) => `${key}:${headers[key]}`)
            .join('\n');
        return `${transport}:${url}:${headersKey}`;
    }

    _getCachedTools(server) {
        const entry = this.mcpToolsCache.get(server.id);
        if (!entry) return null;
        if (entry.key !== this._serverKey(server)) return null;
        return Array.isArray(entry.tools) ? entry.tools : null;
    }

    setMcpToolsList(serverId, transport, url, tools, requestKey = null) {
        const id = serverId || (this._getActiveServer() ? this._getActiveServer().id : null);
        if (!id) return;

        this.mcpToolsCache.set(id, {
            key: requestKey || `${(transport || 'sse').toLowerCase()}:${(url || '').trim()}:`,
            tools: Array.isArray(tools) ? tools : [],
        });

        this.setMcpTestStatus('');
        this._renderToolsUI();
    }

    _renderToolsUI() {
        const { mcpToolsSummary, mcpToolList, mcpToolSearch } = this.elements;
        const server = this._getActiveServer();
        if (!server || !mcpToolList || !mcpToolsSummary) return;

        const cached = this._getCachedTools(server) || [];
        renderMcpToolsUI({
            server,
            tools: cached,
            search: mcpToolSearch ? mcpToolSearch.value || '' : '',
            summaryElement: mcpToolsSummary,
            listElement: mcpToolList,
            uiState: this._getToolsUiState(server.id),
            onToolsChange: () => this._renderToolsUI(),
        });
    }

    _getToolsUiState(serverId) {
        const key = serverId || 'default';
        const existing = this.mcpToolsUiState.get(key);
        if (existing) return existing;

        const state = { openGroups: new Set() };
        // Default: keep groups expanded for usability.
        state.openGroups.add('(other)');
        this.mcpToolsUiState.set(key, state);
        return state;
    }
}
