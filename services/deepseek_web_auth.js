/**
 * DeepSeek Web authentication management.
 *
 * Handles login, session creation, and token refresh for the
 * DeepSeek Web (chat.deepseek.com) provider.
 */

import { debugLog } from '../shared/logging/debug.js';

const BASE_URL = 'https://chat.deepseek.com';

const STORAGE_KEYS = [
    'deepseek_web_token',
    'deepseek_web_session_id',
    'deepseek_web_login_type',
    'deepseek_web_mobile',
    'deepseek_web_area_code',
    'deepseek_web_email',
    'deepseek_web_password',
    'deepseek_web_thinking_enabled',
    'deepseek_web_search_enabled',
    'deepseek_web_model_type',
];

const DS_HEADERS = {
    'content-type': 'application/json',
    origin: BASE_URL,
    referer: BASE_URL + '/',
    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
    'x-client-version': '2.0.2',
    'x-client-platform': 'web',
};

function buildAuthHeaders(token) {
    return { ...DS_HEADERS, authorization: `Bearer ${token}` };
}

/**
 * Login to DeepSeek Web.
 * @param {string} loginType - 'phone' or 'email'
 * @param {string} identifier - phone number or email
 * @param {string} password
 * @param {string} [areaCode='+86']
 * @returns {Promise<{token: string, session_id: string}>}
 */
export async function loginDeepSeekWeb(loginType, identifier, password, areaCode = '+86') {
    const loginPayload = {
        password,
        device_id: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
        os: 'web',
    };

    if (loginType === 'email') {
        loginPayload.email = identifier;
        loginPayload.mobile = '';
        loginPayload.area_code = '';
    } else {
        loginPayload.mobile = identifier;
        loginPayload.area_code = areaCode;
        loginPayload.email = '';
    }

    const resp = await fetch(`${BASE_URL}/api/v0/users/login`, {
        method: 'POST',
        headers: DS_HEADERS,
        body: JSON.stringify(loginPayload),
    });

    if (resp.status === 202 && resp.headers.get('x-amzn-waf-action')) {
        throw new Error('Login blocked by WAF (HTTP 202). Try again later.');
    }

    if (!resp.ok) {
        throw new Error(`Login failed: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (data.code !== 0 || data.data?.biz_code !== 0) {
        const msg = data.data?.biz_msg || data.msg || 'Unknown login error';
        throw new Error(`Login failed: ${msg}`);
    }

    const token = data.data.biz_data?.user?.token;
    if (!token) {
        throw new Error('Login succeeded but no token in response');
    }

    const sessionId = await createDeepSeekSession(token);

    return { token, session_id: sessionId };
}

/**
 * Create a new chat session on DeepSeek Web.
 * @param {string} token
 * @returns {Promise<string>} session_id
 */
export async function createDeepSeekSession(token) {
    const resp = await fetch(`${BASE_URL}/api/v0/chat_session/create`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({}),
    });

    if (!resp.ok) {
        throw new Error(`Session creation failed: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const sid = data.data?.biz_data?.chat_session?.id || data.data?.biz_data?.id;
    if (!sid) {
        throw new Error('Session creation succeeded but no session_id in response');
    }
    return sid;
}

/**
 * Load DeepSeek Web auth state from chrome.storage.local.
 * @returns {Promise<{token: string, session_id: string, loginType: string, thinkingEnabled: boolean, searchEnabled: boolean, modelType: string}>}
 */
export async function loadDeepSeekWebAuth() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS);
    return {
        token: stored.deepseek_web_token || '',
        session_id: stored.deepseek_web_session_id || '',
        loginType: stored.deepseek_web_login_type || 'phone',
        mobile: stored.deepseek_web_mobile || '',
        areaCode: stored.deepseek_web_area_code || '+86',
        email: stored.deepseek_web_email || '',
        password: stored.deepseek_web_password || '',
        thinkingEnabled: stored.deepseek_web_thinking_enabled !== false,
        searchEnabled: stored.deepseek_web_search_enabled !== false,
        modelType: stored.deepseek_web_model_type || 'default',
    };
}

/**
 * Save DeepSeek Web auth state to chrome.storage.local.
 * @param {object} auth
 */
export async function saveDeepSeekWebAuth(auth) {
    const update = {};
    if (auth.token !== undefined) update.deepseek_web_token = auth.token;
    if (auth.session_id !== undefined) update.deepseek_web_session_id = auth.session_id;
    if (auth.loginType !== undefined) update.deepseek_web_login_type = auth.loginType;
    if (auth.mobile !== undefined) update.deepseek_web_mobile = auth.mobile;
    if (auth.areaCode !== undefined) update.deepseek_web_area_code = auth.areaCode;
    if (auth.email !== undefined) update.deepseek_web_email = auth.email;
    if (auth.password !== undefined) update.deepseek_web_password = auth.password;
    if (auth.thinkingEnabled !== undefined)
        update.deepseek_web_thinking_enabled = auth.thinkingEnabled;
    if (auth.searchEnabled !== undefined) update.deepseek_web_search_enabled = auth.searchEnabled;
    if (auth.modelType !== undefined) update.deepseek_web_model_type = auth.modelType;
    await chrome.storage.local.set(update);
}

/**
 * Refresh token by re-login with saved credentials.
 * @returns {Promise<{token: string, session_id: string}>}
 */
export async function refreshDeepSeekToken() {
    const auth = await loadDeepSeekWebAuth();
    if (!auth.password) {
        throw new Error('Cannot refresh: no saved password');
    }

    const identifier = auth.loginType === 'email' ? auth.email : auth.mobile;
    if (!identifier) {
        throw new Error('Cannot refresh: no saved ' + auth.loginType);
    }

    debugLog('[DeepSeek Web] Refreshing token...');
    const result = await loginDeepSeekWeb(auth.loginType, identifier, auth.password, auth.areaCode);
    await saveDeepSeekWebAuth({
        token: result.token,
        session_id: result.session_id,
    });
    return result;
}
