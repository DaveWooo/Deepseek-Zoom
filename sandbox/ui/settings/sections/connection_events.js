import { sendToBackground } from '../../../../shared/messaging/index.js';
import { inferMcpTransport, normalizeMcpHeaders } from '../../../../shared/mcp/transport.js';
import {
    getDedicatedApiProviderConfig,
    isDedicatedApiProvider,
} from '../../../../shared/settings/dedicated_providers.js';
import { t } from '../../../core/i18n.js';

export function bindConnectionSectionEvents(section) {
    const { providerSelect } = section.elements;
    if (providerSelect) {
        providerSelect.addEventListener('change', (event) => {
            section._saveDedicatedApiProviderEdits(section.activeProvider);
            section.updateVisibility(event.target.value);
        });
    }

    // DeepSeek Web model enabled checkboxes → update status dots
    const modelEnabledMap = [
        { checkbox: section.elements.deepseekWebModelEnabledDefault, dot: section.elements.deepseekWebStatusDotDefault },
        { checkbox: section.elements.deepseekWebModelEnabledExpert, dot: section.elements.deepseekWebStatusDotExpert },
        { checkbox: section.elements.deepseekWebModelEnabledVision, dot: section.elements.deepseekWebStatusDotVision },
    ];
    for (const { checkbox, dot } of modelEnabledMap) {
        if (checkbox && dot) {
            checkbox.addEventListener('change', () => {
                dot.className = checkbox.checked ? 'model-status-dot model-status-enabled' : 'model-status-dot model-status-disabled';
            });
        }
    }

    // DeepSeek Web connectivity test
    const testBtn = section.elements.deepseekWebTestBtn;
    const testStatus = section.elements.deepseekWebTestStatus;
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            testBtn.className = 'deepseek-web-test-btn test-loading';
            if (testStatus) testStatus.textContent = '测试中...';
            sendToBackground({ action: 'DEEPSEEK_WEB_TEST_CONNECTION' });
        });
    }

    // Listen for test result
    const deepseekTestHandler = (event) => {
        if (event.data?.action !== 'DEEPSEEK_WEB_TEST_RESULT') return;
        const result = event.data.payload;
        if (testBtn) {
            testBtn.className = result?.success ? 'deepseek-web-test-btn test-passed' : 'deepseek-web-test-btn test-failed';
        }
        if (testStatus) {
            testStatus.textContent = result?.success ? '✅ 连通正常' : ('❌ ' + (result?.error || '连接失败'));
        }
    };
    window.addEventListener('message', deepseekTestHandler);

    // DeepSeek Web login
    const { deepseekWebLogin, deepseekWebLoginStatus, deepseekWebPhone, deepseekWebPassword, deepseekWebAreaCode } = section.elements;
    if (deepseekWebLogin) {
        deepseekWebLogin.addEventListener('click', () => {
            const phone = deepseekWebPhone?.value.trim();
            const password = deepseekWebPassword?.value.trim();
            const areaCode = deepseekWebAreaCode?.value.trim() || '+86';
            if (!phone || !password) {
                deepseekWebLoginStatus.textContent = '❌ Phone/Email and password required';
                return;
            }
            deepseekWebLoginStatus.textContent = 'Logging in...';
            deepseekWebLogin.disabled = true;

            const handler = (event) => {
                if (event.data?.action !== 'DEEPSEEK_WEB_LOGIN_RESULT') return;
                window.removeEventListener('message', handler);
                const result = event.data.payload;
                if (result?.token) {
                    deepseekWebLoginStatus.textContent = '✅ Logged in';
                } else {
                    deepseekWebLoginStatus.textContent = '❌ ' + (result?.error || 'Login failed');
                }
                deepseekWebLogin.disabled = false;
            };
            window.addEventListener('message', handler);
            sendToBackground({
                action: 'DEEPSEEK_WEB_LOGIN',
                phone,
                password,
                area_code: areaCode,
            });
        });
    }

    const { dedicatedApiRefreshModels } = section.elements;
    if (dedicatedApiRefreshModels) {
        dedicatedApiRefreshModels.addEventListener('click', () => {
            const provider = providerSelect?.value || section.activeProvider;
            const config = getDedicatedApiProviderConfig(provider);
            if (!isDedicatedApiProvider(provider) || !config?.modelListUrl) return;

            section._saveDedicatedApiProviderEdits(provider);
            const providerSettings = section.dedicatedApiProviders[provider] || {};
            section.setProviderModelListStatus(t('modelListFetching'));
            dedicatedApiRefreshModels.disabled = true;
            sendToBackground({
                action: 'GET_PROVIDER_MODELS',
                provider,
                baseUrl: providerSettings.baseUrl || config.defaultBaseUrl,
                apiKey: providerSettings.apiKey || '',
            });
        });
    }

    const { mcpEnabled } = section.elements;
    if (mcpEnabled) {
        mcpEnabled.addEventListener('change', (event) => {
            section.updateMcpVisibility(event.target.checked === true);
        });
    }

    const {
        mcpServerSelect,
        mcpAddServer,
        mcpRemoveServer,
        mcpServerName,
        mcpTransport,
        mcpServerUrl,
        mcpHeaders,
        mcpServerEnabled,
        mcpTestConnection,
        mcpToolMode,
        mcpRefreshTools,
        mcpEnableAllTools,
        mcpDisableAllTools,
        mcpToolSearch,
    } = section.elements;

    if (mcpServerSelect) {
        mcpServerSelect.addEventListener('change', (event) => {
            section._saveCurrentServerEdits();
            section.mcpActiveServerId = event.target.value;
            section._loadActiveServerIntoForm();
            section._renderMcpServerOptions();
            section.setMcpTestStatus('');
        });
    }

    if (mcpAddServer) {
        mcpAddServer.addEventListener('click', () => {
            section._saveCurrentServerEdits();
            const server = section._getDefaultServer();
            section.mcpServers.push(server);
            section.mcpActiveServerId = server.id;
            section._renderMcpServerOptions();
            section._loadActiveServerIntoForm();
            section.setMcpTestStatus('');
        });
    }

    if (mcpRemoveServer) {
        mcpRemoveServer.addEventListener('click', () => {
            section._saveCurrentServerEdits();
            const id = section.mcpActiveServerId;
            if (!id) return;

            // Tear down the live transport + clear the cached tool list for the
            // server being removed. Without this the SSE/WebSocket/streamable-
            // HTTP connection stays open in the background's connection map and
            // the UI keeps a stale tool entry for a server that no longer exists.
            section.disconnectMcpServer(id);

            section.mcpServers = section.mcpServers.filter((server) => server.id !== id);

            if (section.mcpServers.length === 0) {
                const server = section._getDefaultServer();
                server.enabled = false;
                section.mcpServers = [server];
            }

            section.mcpActiveServerId = section.mcpServers[0].id;
            section._renderMcpServerOptions();
            section._loadActiveServerIntoForm();
            section.setMcpTestStatus('');
        });
    }

    const onEdit = () => {
        section._saveCurrentServerEdits();
        section._renderMcpServerOptions();
    };

    if (mcpServerName) mcpServerName.addEventListener('input', onEdit);
    if (mcpServerUrl) mcpServerUrl.addEventListener('input', onEdit);
    if (mcpHeaders) mcpHeaders.addEventListener('input', onEdit);
    if (mcpTransport) {
        mcpTransport.addEventListener('change', () => {
            const server = section._getActiveServer();
            const prevTransport = server ? server.transport || 'sse' : 'sse';
            const nextTransport = mcpTransport.value || 'sse';

            if (mcpServerUrl) {
                mcpServerUrl.placeholder = section._getDefaultUrlForTransport(nextTransport);
            }

            if (server && mcpServerUrl) {
                const currentUrl = (mcpServerUrl.value || '').trim();
                const prevDefault = section._getDefaultUrlForTransport(prevTransport);
                if (!currentUrl || currentUrl === prevDefault) {
                    mcpServerUrl.value = section._getDefaultUrlForTransport(nextTransport);
                }
            }

            onEdit();
        });
    }
    if (mcpServerEnabled) mcpServerEnabled.addEventListener('change', onEdit);

    if (mcpToolMode) {
        mcpToolMode.addEventListener('change', () => {
            section._saveCurrentServerEdits();
            section._renderToolsUI();
        });
    }

    if (mcpToolSearch) {
        mcpToolSearch.addEventListener('input', () => {
            section._renderToolsUI();
        });
    }

    if (mcpRefreshTools) {
        mcpRefreshTools.addEventListener('click', () => {
            if (!section._saveCurrentServerEdits()) return;
            const server = section._getActiveServer();
            if (!server) return;

            section.setMcpTestStatus(t('mcpFetchingTools'));
            sendToBackground({
                action: 'MCP_LIST_TOOLS',
                serverId: server.id,
                requestKey: section._serverKey(server),
                transport: inferMcpTransport(server.transport, server.url),
                url: server.url || '',
                headers: normalizeMcpHeaders(server.headers),
            });
        });
    }

    if (mcpEnableAllTools) {
        mcpEnableAllTools.addEventListener('click', () => {
            const server = section._getActiveServer();
            if (!server) return;
            const cached = section._getCachedTools(server);
            if (!cached || cached.length === 0) return;
            server.toolMode = 'selected';
            server.enabledTools = cached.map((tool) => tool.name).filter(Boolean);
            section._loadActiveServerIntoForm();
            section._renderToolsUI();
        });
    }

    if (mcpDisableAllTools) {
        mcpDisableAllTools.addEventListener('click', () => {
            const server = section._getActiveServer();
            if (!server) return;
            server.toolMode = 'selected';
            server.enabledTools = [];
            section._loadActiveServerIntoForm();
            section._renderToolsUI();
        });
    }

    if (mcpTestConnection) {
        mcpTestConnection.addEventListener('click', () => {
            if (!section._saveCurrentServerEdits()) return;
            const server = section._getActiveServer();
            if (!server) return;

            section.setMcpTestStatus(t('mcpTestingConnection'));
            sendToBackground({
                action: 'MCP_TEST_CONNECTION',
                serverId: server.id,
                transport: inferMcpTransport(server.transport, server.url),
                url: server.url || '',
                headers: normalizeMcpHeaders(server.headers),
            });
        });
    }
}
