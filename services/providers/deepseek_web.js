/**
 * DeepSeek Web provider — sends messages via chat.deepseek.com free tier.
 * Requires JWT token + session_id + PoW solution per request.
 */

import { debugLog } from '../../shared/logging/debug.js';
import { generateUUID } from '../../shared/utils/index.js';
import { normalizeUserAttachments } from '../../shared/attachments/index.js';
import {
    fetchPowChallenge,
    solvePow,
    buildPowResponse,
    initWasm,
} from './shared/deepseek_web_pow.js';

const CHAT_ENDPOINT = 'https://chat.deepseek.com/api/v0/chat/completion';
const FILE_UPLOAD_ENDPOINT = 'https://chat.deepseek.com/api/v0/file/upload_file';

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
        } catch { /* ignore parse error */ }
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
    if (typeof val === 'object' && val !== null) {
        const frags = val.response?.fragments;
        if (Array.isArray(frags) && frags.length > 0) {
            const last = frags[frags.length - 1];
            if (last.type) {
                state.fragmentType = last.type;
            }
            if (last.content && typeof last.content === 'string') {
                return {
                    type: state.fragmentType === 'THINK' ? 'thinking' : 'content',
                    value: last.content,
                };
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
                return {
                    type: state.fragmentType === 'THINK' ? 'thinking' : 'content',
                    value: last.content,
                };
            }
        }
        return null;
    }

    // ── Fragment content continuation ──
    if (path === 'response/fragments/-1/content') {
        if (typeof val === 'string' && val) {
            return {
                type: state.fragmentType === 'THINK' ? 'thinking' : 'content',
                value: val,
            };
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
        if (state.fragmentType === 'THINK') {
            return { type: 'thinking', value: val };
        }
        if (state.fragmentType === 'RESPONSE') {
            return { type: 'content', value: val };
        }
        // Old format fallback
        return { type: state.phase === 'thinking' ? 'thinking' : 'content', value: val };
    }

    return null;
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

    const fileIds = [];
    await initWasm();

    for (const img of images) {
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
                'origin': 'https://chat.deepseek.com',
                'referer': 'https://chat.deepseek.com/',
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
                'x-client-version': '2.0.2',
                'x-client-platform': 'web',
                'authorization': `Bearer ${token}`,
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
        const fileId = json?.data?.file_id;
        if (!fileId) {
            throw new Error('DeepSeek Web upload did not return a file_id.');
        }
        fileIds.push(fileId);
    }

    return fileIds;
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
    const binaryString = atob(payload);
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
        throw new Error('DeepSeek Web token is missing. Please configure DeepSeek Web in settings.');
    }
    if (!context?.session_id) {
        throw new Error('DeepSeek Web session_id is missing. Please re-login.');
    }

    const {
        thinkingEnabled = false,
        searchEnabled = false,
        modelType = 'default',
    } = options;

    debugLog(`[DeepSeek Web] Requesting: thinking=${thinkingEnabled}, search=${searchEnabled}, modelType=${modelType}`);

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
    }

    debugLog('[DeepSeek Web] PoW solved, sending chat request...');

    // ── Step 2: Build request ──
    const reqHeaders = {
        'content-type': 'application/json',
        'origin': 'https://chat.deepseek.com',
        'referer': `https://chat.deepseek.com/a/chat/s/${context.session_id}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
        'x-client-version': '2.0.2',
        'x-client-platform': 'web',
        'authorization': `Bearer ${context.token}`,
        'x-ds-pow-response': powResponse,
    };

    const reqBody = {
        chat_session_id: context.session_id,
        parent_message_id: null,
        prompt: prompt,
        ref_file_ids: refFileIds,
        thinking_enabled: thinkingEnabled,
        search_enabled: searchEnabled,
        model_type: modelType,
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

    // ── Step 3: Parse SSE stream ──
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let contentText = '';
    let thinkingText = '';
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

            // Strip "data: " prefix
            const data = line.startsWith('data: ') ? line.slice(6) : line;
            if (data === '[DONE]') continue;

            const parsed = parseSSELine(data, parserState);
            if (!parsed) continue;

            if (parsed.type === 'error') {
                throw new Error(`DeepSeek Web stream error: ${parsed.value}`);
            }

            if (parsed.type === 'thinking') {
                thinkingText += parsed.value;
            } else {
                contentText += parsed.value;
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
                if (parsed.type === 'thinking') thinkingText += parsed.value;
                else contentText += parsed.value;
            }
        }
    }

    if (!contentText && !thinkingText) {
        throw new Error('DeepSeek Web returned an empty response.');
    }

    debugLog(`[DeepSeek Web] Response received: content=${contentText.length} chars, thinking=${thinkingText.length} chars`);

    return {
        text: contentText,
        thoughts: thinkingText || null,
        newContext: null, // DeepSeek Web is stateless per request (context managed by session_id)
    };
}
