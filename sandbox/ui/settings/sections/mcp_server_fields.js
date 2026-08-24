import { DEFAULT_MCP_TRANSPORT } from '../../../../shared/config/constants.js';
import { inferMcpTransport, normalizeMcpHeaders } from '../../../../shared/mcp/transport.js';
import { formatMcpHeaders, parseMcpHeadersText } from './mcp_header_fields.js';
import { t } from '../../../core/i18n.js';

export function initializeMcpServers(section, data) {
    const servers = data && Array.isArray(data.mcpServers) ? data.mcpServers : null;
    const activeId =
        data && typeof data.mcpActiveServerId === 'string' ? data.mcpActiveServerId : null;

    if (servers && servers.length > 0) {
        section.mcpServers = servers.map((serverConfig) => ({
            id: serverConfig.id || section._makeServerId(),
            name: serverConfig.name || '',
            transport: serverConfig.transport || DEFAULT_MCP_TRANSPORT,
            url: serverConfig.url || '',
            headers: normalizeMcpHeaders(serverConfig.headers),
            enabled: serverConfig.enabled !== false,
            toolMode: serverConfig.toolMode === 'selected' ? 'selected' : 'all',
            enabledTools: Array.isArray(serverConfig.enabledTools) ? serverConfig.enabledTools : [],
        }));
        section.mcpActiveServerId =
            activeId && section.mcpServers.some((serverConfig) => serverConfig.id === activeId)
                ? activeId
                : section.mcpServers[0].id;
    } else {
        const legacyUrl = data?.mcpServerUrl || '';
        const legacyTransport = data?.mcpTransport || DEFAULT_MCP_TRANSPORT;
        const server = section._getDefaultServer();
        server.transport = legacyTransport;
        server.url = legacyUrl || server.url;
        server.headers = normalizeMcpHeaders(data?.mcpHeaders);
        server.enabled = data?.mcpEnabled === true;
        section.mcpServers = [server];
        section.mcpActiveServerId = server.id;
    }
}

export function loadActiveMcpServerIntoForm(section) {
    const {
        mcpServerSelect,
        mcpServerName,
        mcpTransport,
        mcpServerUrl,
        mcpHeaders,
        mcpServerEnabled,
        mcpToolMode,
    } = section.elements;

    const server = section._getActiveServer();
    if (!server) return;

    if (mcpServerSelect) mcpServerSelect.value = server.id;
    if (mcpServerName) mcpServerName.value = server.name || '';
    const transport = inferMcpTransport(server.transport || 'sse', server.url || '');
    server.transport = transport;
    if (mcpTransport) mcpTransport.value = transport;
    if (mcpServerUrl) mcpServerUrl.value = server.url || '';
    if (mcpServerUrl)
        mcpServerUrl.placeholder = section._getDefaultUrlForTransport(server.transport || 'sse');
    if (mcpHeaders) mcpHeaders.value = formatMcpHeaders(server.headers);
    if (mcpServerEnabled) mcpServerEnabled.checked = server.enabled !== false;
    if (mcpToolMode) mcpToolMode.value = server.toolMode === 'selected' ? 'selected' : 'all';

    section._renderToolsUI();
}

export function renderMcpServerOptions(section) {
    const { mcpServerSelect } = section.elements;
    if (!mcpServerSelect) return;

    const active = section._getActiveServer();
    if (active) section.mcpActiveServerId = active.id;

    mcpServerSelect.innerHTML = '';
    for (const server of section.mcpServers) {
        const optionElement = document.createElement('option');
        optionElement.value = server.id;

        const name = (server.name || '').trim();
        const label = name || server.url || t('defaultMcpServer');
        const status = server.enabled === false ? '✗' : '✓';
        optionElement.textContent = `${status} ${label}`;
        mcpServerSelect.appendChild(optionElement);
    }

    if (active) mcpServerSelect.value = active.id;
}

export function saveCurrentMcpServerEdits(section) {
    const { mcpServerName, mcpTransport, mcpServerUrl, mcpHeaders, mcpServerEnabled, mcpToolMode } =
        section.elements;

    const server = section._getActiveServer();
    if (!server) return false;

    const prevKey = section._serverKey(server);

    if (mcpServerName) server.name = mcpServerName.value || '';
    if (mcpServerUrl) server.url = (mcpServerUrl.value || '').trim();
    if (mcpTransport) server.transport = inferMcpTransport(mcpTransport.value || 'sse', server.url);
    if (mcpHeaders) {
        try {
            server.headers = parseMcpHeadersText(mcpHeaders.value);
            section.setMcpTestStatus('');
        } catch (error) {
            section.setMcpTestStatus(error.message || t('mcpConnectionFailed'), true);
            return false;
        }
    }
    if (mcpServerEnabled) server.enabled = mcpServerEnabled.checked === true;
    if (mcpToolMode) server.toolMode = mcpToolMode.value === 'selected' ? 'selected' : 'all';

    const nextKey = section._serverKey(server);
    const becameDisabled = server.enabled === false;
    if (prevKey !== nextKey || becameDisabled) {
        section.disconnectMcpServer(server.id);
        section.mcpToolsCache.delete(server.id);
    }
    return true;
}
