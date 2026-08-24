import { SessionMessageHandler } from './handlers/session/index.js';
import { UIMessageHandler } from './handlers/ui.js';
import { loginDeepSeekWeb } from '../services/deepseek_web_auth.js';
import {
    fetchPowChallenge,
    solvePow,
    buildPowResponse,
    initWasm,
} from '../services/providers/shared/deepseek_web_pow.js';

/**
 * Sets up the global runtime message listener.
 * @param {GeminiSessionManager} sessionManager
 * @param {ImageHandler} imageHandler
 * @param {BrowserControlManager} controlManager
 * @param {McpRemoteManager} mcpManager
 * @param {LogManager} logManager
 * @param {SidePanelScopeManager} sidePanelScopeManager
 */
export function setupMessageListener(
    sessionManager,
    imageHandler,
    controlManager,
    mcpManager,
    logManager,
    sidePanelScopeManager
) {
    const sessionHandler = new SessionMessageHandler(
        sessionManager,
        imageHandler,
        controlManager,
        mcpManager
    );
    const uiHandler = new UIMessageHandler(
        imageHandler,
        controlManager,
        mcpManager,
        sidePanelScopeManager,
        sessionHandler
    );

    // Abort any in-flight quick-ask when its content-script tab is closed,
    // so the upstream provider fetch does not keep streaming into a dead tab.
    chrome.tabs.onRemoved.addListener((tabId) => {
        sessionHandler.cancelQuickAskForTab(tabId);
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GET_LOGS') {
            sendResponse({ logs: logManager.getLogs() });
            return true;
        }

        if (request.action === 'DEEPSEEK_WEB_LOGIN') {
            const isEmail = request.phone.includes('@');
            loginDeepSeekWeb(
                isEmail ? 'email' : 'phone',
                request.phone,
                request.password,
                request.area_code
            )
                .then(async (result) => {
                    // Persist to chrome.storage.local so settings_store can read it
                    await chrome.storage.local.set({
                        deepseek_web_token: result.token,
                        deepseek_web_session_id: result.session_id,
                        deepseek_web_login_type: isEmail ? 'email' : 'phone',
                        deepseek_web_mobile: isEmail ? '' : request.phone,
                        deepseek_web_email: isEmail ? request.phone : '',
                        deepseek_web_area_code: request.area_code || '+86',
                        deepseek_web_password: request.password,
                    });
                    sendResponse({ action: 'DEEPSEEK_WEB_LOGIN_RESULT', ...result });
                })
                .catch((e) =>
                    sendResponse({ action: 'DEEPSEEK_WEB_LOGIN_RESULT', error: e.message })
                );
            return true;
        }

        if (request.action === 'DEEPSEEK_WEB_TEST_CONNECTION') {
            (async () => {
                try {
                    const stored = await chrome.storage.local.get([
                        'deepseek_web_token',
                        'deepseek_web_session_id',
                    ]);
                    if (!stored.deepseek_web_token) {
                        sendResponse({
                            action: 'DEEPSEEK_WEB_TEST_RESULT',
                            success: false,
                            error: '未登录，请先登录',
                        });
                        return;
                    }
                    await initWasm();
                    const challenge = await fetchPowChallenge(
                        stored.deepseek_web_token,
                        '/api/v0/chat/completion'
                    );
                    const answer = await solvePow(challenge);
                    const powResponse = buildPowResponse(challenge, answer);
                    sendResponse({ action: 'DEEPSEEK_WEB_TEST_RESULT', success: true });
                } catch (e) {
                    sendResponse({
                        action: 'DEEPSEEK_WEB_TEST_RESULT',
                        success: false,
                        error: e.message,
                    });
                }
            })();
            return true;
        }

        // Delegate to Session Handler (Prompt, Context, Quick Ask, Browser Control)
        if (sessionHandler.handle(request, sender, sendResponse)) {
            return true;
        }

        // Delegate to UI Handler (Image, Capture, Sidepanel)
        if (uiHandler.handle(request, sender, sendResponse)) {
            return true;
        }

        return false;
    });
}
