/**
 * DeepSeek Web provider — sends messages via chat.deepseek.com free tier.
 * Requires JWT token + session_id + PoW solution per request.
 */

import { debugLog } from '../../shared/logging/debug.js';
import { generateUUID } from '../../shared/utils/index.js';
import { normalizeUserAttachments } from '../../shared/attachments/index.js';
import { createDeepSeekSession } from '../deepseek_web_auth.js';
import {
    fetchPowChallenge,
    solvePow,
    buildPowResponse,
    initWasm,
} from './shared/deepseek_web_pow.js';

const CHAT_ENDPOINT = 'https://chat.deepseek.com/api/v0/chat/completion';
const FILE_UPLOAD_ENDPOINT = 'https://chat.deepseek.com/api/v0/file/upload_file';
const FILE_FORK_ENDPOINT = 'https://chat.deepseek.com/api/v0/file/fork_file_task';
const FILE_FETCH_ENDPOINT = 'https://chat.deepseek.com/api/v0/file/fetch_files';

/**
 * Parse DeepSeek Web SSE line into {type, value}.
 * Handles both old format (path-based) and new format (fragment-based).
 * @param {string} line - raw SSE line (without "data: " prefix)
 * @param {object} state - mutable parser state {phase, fragmentType}
 * @returns {{type: string, value: string}|null}
 */
function parseSSELine(line, state) {
    if (!line || line === '[DONE]') return null;

    // Non-JSON error
    if (line.startsWith('{') && line.includes('"code":') && !line.includes('"p":')) {
        try {
            const obj = JSON.parse(line);
            if (obj.code >= 40000) {
                return { type: 'error', value: obj.msg || 'Unknown error' };
            }
        } catch {
            /* ignore parse error */
        }
    }

    let obj;
    try {
        obj = JSON.parse(line);
    } catch {
        return null;
    }
    if (!obj || typeof obj !== 'object') return null;

    // Error in stream
    if (obj.type === 'error') {
        return { type: 'error', value: obj.content || obj.finish_reason || 'Stream error' };
    }

    const val = obj.v;
    const path = obj.p || '';
    const op = obj.o || null;

    // ── New format: metadata with fragments ──
    if (val && typeof val === 'object' && Array.isArray(val.response?.fragments)) {
        const frags = val.response.fragments;
        if (frags.length > 0) {
            const last = frags[frags.length - 1];
            if (last.type) {
                state.fragmentType = last.type;
            }
            if (last.content && typeof last.content === 'string') {
                if (state.fragmentType === 'THINK') {
                    return { type: 'thinking', value: last.content };
                }
                if (state.fragmentType === 'RESPONSE' || state.fragmentType === 'TEXT') {
                    return { type: 'content', value: last.content };
                }
            }
        }
        return null;
    }

    // ── Fragment append (new format) ──
    if (path === 'response/fragments' && op === 'APPEND' && Array.isArray(val)) {
        if (val.length > 0) {
            const last = val[val.length - 1];
            if (last.type) state.fragmentType = last.type;
            if (last.content && typeof last.content === 'string') {
                if (state.fragmentType === 'THINK') {
                    return { type: 'thinking', value: last.content };
                }
                if (state.fragmentType === 'RESPONSE' || state.fragmentType === 'TEXT') {
                    return { type: 'content', value: last.content };
                }
            }
        }
        return null;
    }

    // ── Fragment type update (e.g. response/fragments/0/type, response/fragments/1/type, response/fragments/-1/type) ──
    if (/^response\/fragments\/(?:-?\d+)\/type$/.test(path)) {
        if (typeof val === 'string') {
            state.fragmentType = val;
        }
        return null;
    }

    // ── Fragment content continuation (e.g. response/fragments/-1/content, response/fragments/0/content, response/fragments/1/content) ──
    if (/^response\/fragments\/(?:-?\d+)\/content$/.test(path)) {
        if (typeof val === 'string' && val) {
            if (state.fragmentType === 'THINK') {
                return { type: 'thinking', value: val };
            }
            if (state.fragmentType === 'RESPONSE' || state.fragmentType === 'TEXT') {
                return { type: 'content', value: val };
            }
            return { type: state.phase === 'thinking' ? 'thinking' : 'content', value: val };
        }
        return null;
    }

    // ── Fragment thinking_content continuation ──
    if (/^response\/fragments\/(?:-?\d+)\/thinking_content$/.test(path)) {
        if (typeof val === 'string' && val) {
            state.fragmentType = 'THINK';
            return {
                type: 'thinking',
                value: val,
            };
        }
        return null;
    }

    // ── Fragment item object update (e.g. response/fragments/1) ──
    if (/^response\/fragments\/(?:-?\d+)$/.test(path) && typeof val === 'object' && val !== null) {
        if (val.type) state.fragmentType = val.type;
        if (val.content && typeof val.content === 'string') {
            if (state.fragmentType === 'THINK') {
                return { type: 'thinking', value: val.content };
            }
            if (state.fragmentType === 'RESPONSE' || state.fragmentType === 'TEXT') {
                return { type: 'content', value: val.content };
            }
        }
        return null;
    }

    // ── Old format: path-based ──
    if (path === 'response/thinking_content') {
        if (typeof val === 'string' && val) {
            state.phase = 'thinking';
            return { type: 'thinking', value: val };
        }
        return null;
    }

    if (path === 'response/content') {
        if (typeof val === 'string' && val) {
            state.phase = 'content';
            return { type: 'content', value: val };
        }
        return null;
    }

    // ── Pathless continuation (both formats) ──
    if (typeof val === 'string' && val && !path) {
        if (state.fragmentType === 'THINK' || state.phase === 'thinking') {
            return { type: 'thinking', value: val };
        }
        if (
            state.fragmentType === 'RESPONSE' ||
            state.fragmentType === 'TEXT' ||
            state.phase === 'content'
        ) {
            return { type: 'content', value: val };
        }
        return null;
    }

    return null;
}

/**
 * Append a streamed fragment to an accumulated buffer, skipping a fragment
 * that was already delivered at the tail. DeepSeek can emit the same thinking
 * (or content) block twice — once through the old `response/thinking_content`
 * path and once through the new THINK fragment format — which would otherwise
 * duplicate the reasoning in the reply.
 * @param {string} existing
 * @param {string} fragment
 * @returns {string}
 */
function appendStreamFragment(existing, fragment) {
    if (!fragment) return existing;
    if (existing && existing.endsWith(fragment)) return existing;
    return existing + fragment;
}

/**
 * Upload files to DeepSeek Web and return their file_ids (for vision mode).
 * Uses multipart/form-data with PoW for the upload endpoint.
 *
 * @param {Array} files - attachments [{base64, type, name}]
 * @param {string} token - DeepSeek Web JWT
 * @param {AbortSignal} signal
 * @returns {Promise<string[]>} file_ids
 */
async function uploadDeepSeekFiles(files, token, signal) {
    const attachments = normalizeUserAttachments(files);
    if (attachments.length === 0) return [];

    // Only images are supported for vision mode
    const images = attachments.filter((a) => a.type.startsWith('image/'));
    if (images.length === 0) {
        throw new Error('DeepSeek Web 识图模式仅支持图片附件。');
    }

    await initWasm();

    const fileIds = [];
    for (const img of images) {
        const fileId = await uploadDeepSeekFile(img, token, signal);
        if (!fileId) continue;

        // DeepSeek requires forking an uploaded file to the vision model type
        // before it can be referenced by a vision chat request.
        const forkedId = await forkDeepSeekFileToVision(fileId, token, signal);
        if (forkedId) fileIds.push(forkedId);
    }

    if (fileIds.length === 0) {
        throw new Error('DeepSeek Web upload did not return a file_id.');
    }

    // Wait for DeepSeek to finish parsing the forked files so the vision
    // request does not reject them as "parsing".
    const parsedIds = await waitForDeepSeekFileParsing(fileIds, token, signal);
    debugLog(`[DeepSeek Web] Uploaded ${parsedIds.length} file(s) for vision mode`);
    return parsedIds;
}

/**
 * Upload a single image to DeepSeek Web and return its raw file_id.
 * @param {object} img - {base64, type, name}
 * @param {string} token
 * @param {AbortSignal} signal
 * @returns {Promise<string|null>} file_id (null when the response shape is unknown)
 */
async function uploadDeepSeekFile(img, token, signal) {
    const challenge = await fetchPowChallenge(token, '/api/v0/file/upload_file', signal);
    const answer = await solvePow(challenge);
    const powResponse = buildPowResponse(challenge, answer);

    // Use the full data URL for Blob conversion (preserves exact bytes)
    const form = new FormData();
    form.append(
        'file',
        img.base64 && img.base64.startsWith('data:')
            ? dataUrlToBlob(img.base64)
            : new Blob([base64ToUint8Array(img.base64 || '')], { type: img.type }),
        img.name || 'image.png'
    );

    const resp = await fetch(FILE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
            origin: 'https://chat.deepseek.com',
            referer: 'https://chat.deepseek.com/',
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
            'x-client-version': '2.0.2',
            'x-client-platform': 'web',
            authorization: `Bearer ${token}`,
            'x-ds-pow-response': powResponse,
        },
        body: form,
        signal,
    });

    if (resp.status === 401) {
        throw new Error('DEEPSEEK_WEB_TOKEN_EXPIRED');
    }
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`DeepSeek Web upload error: HTTP ${resp.status} — ${text.slice(0, 200)}`);
    }

    const json = await resp.json().catch(() => null);
    // Real response shape: { data: { biz_data: { id }, ... } } (older: { data: { id } })
    const fileId = json?.data?.biz_data?.id || json?.data?.id;
    if (!fileId) {
        debugLog(
            '[DeepSeek Web] Upload response did not contain a file_id:',
            JSON.stringify(json).slice(0, 300)
        );
        return null;
    }
    return fileId;
}

/**
 * Fork an uploaded file to the vision model type so it can be referenced by
 * a vision chat request. Returns the new forked file_id.
 * @param {string} fileId
 * @param {string} token
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
async function forkDeepSeekFileToVision(fileId, token, signal) {
    const resp = await fetch(FILE_FORK_ENDPOINT, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'https://chat.deepseek.com',
            referer: 'https://chat.deepseek.com/',
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
            'x-client-version': '2.0.2',
            'x-client-platform': 'web',
            authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ file_id: fileId, to_model_type: 'vision' }),
        signal,
    });

    if (resp.status === 401) {
        throw new Error('DEEPSEEK_WEB_TOKEN_EXPIRED');
    }
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`DeepSeek Web fork error: HTTP ${resp.status} — ${text.slice(0, 200)}`);
    }

    const json = await resp.json().catch(() => null);
    const bizData = json?.data?.biz_data || {};
    const forkedId = bizData.id || bizData.file_id || bizData.task_id;
    if (!forkedId) {
        debugLog(
            '[DeepSeek Web] Fork response did not contain a new file_id:',
            JSON.stringify(json).slice(0, 300)
        );
        throw new Error('DeepSeek Web did not return a forked vision file_id.');
    }
    return forkedId;
}

/**
 * Poll DeepSeek Web until the given files finish parsing (or a timeout is hit).
 * Files that are still parsing after 5s are accepted anyway to avoid blocking
 * the request forever.
 * @param {string[]} fileIds
 * @param {string} token
 * @param {AbortSignal} signal
 * @param {number} [timeoutMs]
 * @returns {Promise<string[]>} file_ids that reached a usable state
 */
async function waitForDeepSeekFileParsing(fileIds, token, signal, timeoutMs = 15000) {
    if (fileIds.length === 0) return [];
    const start = Date.now();
    const pending = new Set(fileIds);
    const ready = [];

    while (pending.size > 0 && Date.now() - start < timeoutMs) {
        if (signal?.aborted) break;
        const statuses = await fetchDeepSeekFileStatuses([...pending], token, signal);
        for (const fid of [...pending]) {
            const status = String(statuses?.[fid]?.status || '').toUpperCase();
            if (status === 'SUCCESS' || status === 'COMPLETED') {
                pending.delete(fid);
                ready.push(fid);
            } else if (
                status === 'CONTENT_EMPTY' ||
                status === 'FAILED' ||
                status === 'ERROR' ||
                status === 'PARSE_FAILED'
            ) {
                // Reached a terminal state but the file is not usable — drop it.
                pending.delete(fid);
            } else if (Date.now() - start > 5000) {
                // Still parsing after 5s: accept it anyway (matches upstream).
                pending.delete(fid);
                ready.push(fid);
            }
        }
        if (pending.size > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    // Whatever is still pending after the timeout is returned as-is so a
    // slow-but-valid upload does not hard-fail the whole vision request.
    return [...ready, ...pending];
}

/**
 * Fetch parse status for the given DeepSeek Web files.
 * @param {string[]} fileIds
 * @param {string} token
 * @param {AbortSignal} signal
 * @returns {Promise<Object<string, object>|null>} map of file_id → file info
 */
async function fetchDeepSeekFileStatuses(fileIds, token, signal) {
    const params = new URLSearchParams();
    for (const fid of fileIds) params.append('file_ids', fid);

    const resp = await fetch(`${FILE_FETCH_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        headers: {
            origin: 'https://chat.deepseek.com',
            referer: 'https://chat.deepseek.com/',
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
            'x-client-version': '2.0.2',
            'x-client-platform': 'web',
            authorization: `Bearer ${token}`,
        },
        signal,
    });
    if (!resp.ok) return null;

    const json = await resp.json().catch(() => null);
    const files =
        json?.data?.biz_data?.files ||
        json?.data?.files ||
        json?.data?.biz_data?.file_statuses ||
        [];
    const statuses = {};
    for (const file of files) {
        const fid = file?.id || file?.file_id || file?._id;
        if (fid) statuses[fid] = file;
    }
    return statuses;
}

function base64ToUint8Array(base64) {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch {
        return new Uint8Array(0);
    }
}

function dataUrlToBlob(dataUrl) {
    const [meta, payload] = dataUrl.split(',');
    const type = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
    const binaryString = atob((payload || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type });
}

/**
 * Send a message via DeepSeek Web free tier.
 *
 * @param {string} prompt - User message text
 * @param {object} context - {token, session_id}
 * @param {string} model - Not used for routing (modelType from options), kept for API compatibility
 * @param {Array} files - Ignored (P2: vision upload)
 * @param {AbortSignal} signal
 * @param {function} onUpdate - (text, thoughts) callback for streaming
 * @param {object} [options] - {thinkingEnabled, searchEnabled, modelType}
 * @returns {Promise<{text: string, thoughts: string, newContext: null}>}
 */
export async function sendDeepSeekWebMessage(
    prompt,
    context,
    model,
    files,
    signal,
    onUpdate,
    options = {}
) {
    if (!context?.token) {
        throw new Error(
            'DeepSeek Web token is missing. Please configure DeepSeek Web in settings.'
        );
    }

    let chatSessionId = context?.session_id;
    if (!chatSessionId) {
        try {
            chatSessionId = await createDeepSeekSession(context.token);
            context.session_id = chatSessionId;
            if (typeof chrome !== 'undefined' && chrome?.storage?.local?.set) {
                chrome.storage.local
                    .set({ deepseek_web_session_id: chatSessionId })
                    .catch(() => {});
            }
        } catch (e) {
            throw new Error(`DeepSeek Web session creation failed: ${e.message}`);
        }
    }

    const { thinkingEnabled = false, searchEnabled = false, modelType = 'default' } = options;

    debugLog(
        `[DeepSeek Web] Requesting: thinking=${thinkingEnabled}, search=${searchEnabled}, modelType=${modelType}`
    );

    // ── Step 0: Ensure WASM is loaded ──
    await initWasm();

    // ── Step 1: Fetch and solve PoW ──
    const challenge = await fetchPowChallenge(context.token, '/api/v0/chat/completion', signal);
    const answer = await solvePow(challenge);
    const powResponse = buildPowResponse(challenge, answer);

    // ── Step 1.5: Upload attachments (vision/multimodal) ──
    let refFileIds = [];
    if (modelType === 'vision') {
        refFileIds = await uploadDeepSeekFiles(files, context.token, signal);
        debugLog(`[DeepSeek Web] Uploaded ${refFileIds.length} file(s) for vision mode`);

        if (refFileIds.length > 0) {
            // DeepSeek applies parallel_chat_limit_by_queue to the shared
            // session; vision requests need a FRESH session so the uploaded
            // files are accepted instead of an empty/queued response.
            try {
                chatSessionId = await createDeepSeekSession(context.token);
                debugLog(`[DeepSeek Web] Created fresh vision session: ${chatSessionId}`);
            } catch (e) {
                debugLog(
                    `[DeepSeek Web] Fresh vision session failed, reusing existing: ${e.message}`
                );
            }
        }
    }

    debugLog('[DeepSeek Web] PoW solved, sending chat request...');

    // ── Step 2: Build request ──
    const reqHeaders = {
        'content-type': 'application/json',
        origin: 'https://chat.deepseek.com',
        referer: `https://chat.deepseek.com/a/chat/s/${chatSessionId}`,
        'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
        'x-client-version': '2.0.2',
        'x-client-platform': 'web',
        authorization: `Bearer ${context.token}`,
        'x-ds-pow-response': powResponse,
    };

    const reqBody = {
        chat_session_id: chatSessionId,
        parent_message_id: null,
        prompt: prompt,
        ref_file_ids: refFileIds,
        thinking_enabled: modelType === 'vision' ? false : thinkingEnabled,
        search_enabled: modelType === 'vision' ? false : searchEnabled,
        model_type: modelType === 'vision' && refFileIds.length === 0 ? 'default' : modelType,
    };

    const resp = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(reqBody),
        signal,
    });

    // ── Token expired → signal caller to refresh ──
    if (resp.status === 401) {
        throw new Error('DEEPSEEK_WEB_TOKEN_EXPIRED');
    }

    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`DeepSeek Web error: HTTP ${resp.status} — ${text.slice(0, 200)}`);
    }

    // ── Pre-flight: reject non-SSE responses (HTML/JSON error pages) with the
    // response body in the message so an empty/queued vision reply is not
    // silently misread as "no content". ──
    const contentType = resp.headers?.get?.('content-type') || '';
    if (
        contentType &&
        !contentType.includes('text/event-stream') &&
        !contentType.includes('application/json') &&
        !contentType.includes('text/plain')
    ) {
        const text = await resp.text().catch(() => '');
        throw new Error(
            `DeepSeek Web returned non-SSE response (Content-Type: ${contentType}) — ${text.slice(0, 300)}`
        );
    }

    // ── Step 3: Parse SSE stream ──
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let contentText = '';
    let thinkingText = '';
    let nonJsonLineCount = 0;
    const rawSampleLines = [];
    const parserState = { phase: 'content', fragmentType: null };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line) continue;
            if (line.startsWith('event:')) continue;
            if (line.startsWith(':')) continue;

            // HTML error page instead of SSE
            if (
                line.startsWith('<!DOCTYPE') ||
                line.startsWith('<html') ||
                line.startsWith('<HTML')
            ) {
                throw new Error(`DeepSeek Web returned HTML error: ${line.slice(0, 200)}`);
            }

            // Strip "data: " prefix
            const data = line.startsWith('data: ') ? line.slice(6) : line;
            if (data === '[DONE]') continue;

            if (rawSampleLines.length < 3) rawSampleLines.push(line.slice(0, 200));

            const parsed = parseSSELine(data, parserState);
            if (!parsed) {
                // Plain text that is neither SSE JSON nor [DONE] — an error page.
                if (data && !data.startsWith('{')) {
                    nonJsonLineCount += 1;
                    if (nonJsonLineCount >= 3) {
                        throw new Error(
                            `DeepSeek Web returned non-SSE text: ${rawSampleLines.join(' | ')}`
                        );
                    }
                }
                continue;
            }

            if (parsed.type === 'error') {
                throw new Error(`DeepSeek Web stream error: ${parsed.value}`);
            }

            if (parsed.type === 'thinking') {
                thinkingText = appendStreamFragment(thinkingText, parsed.value);
            } else {
                contentText = appendStreamFragment(contentText, parsed.value);
            }

            if (onUpdate) {
                onUpdate(contentText, thinkingText);
            }
        }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
        const remaining = buffer.trim();
        const data = remaining.startsWith('data: ') ? remaining.slice(6) : remaining;
        if (data !== '[DONE]') {
            const parsed = parseSSELine(data, parserState);
            if (parsed && parsed.type !== 'error') {
                if (parsed.type === 'thinking')
                    thinkingText = appendStreamFragment(thinkingText, parsed.value);
                else contentText = appendStreamFragment(contentText, parsed.value);
            }
        }
    }

    if (!contentText && !thinkingText) {
        throw new Error(
            `DeepSeek Web returned an empty response${
                refFileIds.length > 0 ? ` (vision ref_file_ids: ${refFileIds.join(',')})` : ''
            }${rawSampleLines.length > 0 ? `; raw lines: ${rawSampleLines.join(' | ')}` : ''}.`
        );
    }

    debugLog(
        `[DeepSeek Web] Response received: content=${contentText.length} chars, thinking=${thinkingText.length} chars`
    );

    return {
        text: contentText,
        thoughts: thinkingText || null,
        newContext: null, // DeepSeek Web is stateless per request (context managed by session_id)
    };
}
