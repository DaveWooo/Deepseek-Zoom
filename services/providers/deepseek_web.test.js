// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendDeepSeekWebMessage } from './deepseek_web.js';

vi.mock('./shared/deepseek_web_pow.js', () => ({
    fetchPowChallenge: vi.fn(),
    solvePow: vi.fn(),
    buildPowResponse: vi.fn(),
    initWasm: vi.fn(),
}));

vi.mock('../../shared/attachments/index.js', () => ({
    normalizeUserAttachments: vi.fn((files) => files),
}));

vi.mock('../deepseek_web_auth.js', () => ({
    createDeepSeekSession: vi.fn(),
}));

import {
    fetchPowChallenge,
    solvePow,
    buildPowResponse,
    initWasm,
} from './shared/deepseek_web_pow.js';
import { normalizeUserAttachments } from '../../shared/attachments/index.js';
import { createDeepSeekSession } from '../deepseek_web_auth.js';

function makeStream(text) {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode(text)];
    return {
        getReader() {
            return {
                read: vi
                    .fn()
                    .mockResolvedValueOnce({ done: false, value: chunks[0] })
                    .mockResolvedValueOnce({ done: true }),
            };
        },
    };
}

const POW = {
    challenge: 'c',
    salt: 's',
    difficulty: 1,
    signature: 'sig',
    target_path: 'x',
    expire_at: 1,
};

function mockPow() {
    fetchPowChallenge.mockResolvedValue(POW);
    solvePow.mockResolvedValue(42);
    buildPowResponse.mockReturnValue('base64-pow');
    initWasm.mockResolvedValue(true);
}

const IMAGE = {
    base64: 'data:image/png;base64,iVBORw0KGgo=',
    type: 'image/png',
    name: 'a.png',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('sendDeepSeekWebMessage vision mode file upload', () => {
    it('uploads, forks and references the vision file_id in the chat request', async () => {
        mockPow();
        const streamText = 'data: {"v":"识图成功"}\n';
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status: 'SUCCESS' }] } },
                    }),
                };
            }
            return { ok: true, status: 200, body: makeStream(streamText) };
        });

        const result = await sendDeepSeekWebMessage(
            '描述这张图',
            { token: 'token-1', session_id: 'sess-1' },
            'deepseek-v4-3.6-flash',
            [IMAGE],
            undefined,
            undefined,
            { modelType: 'vision', thinkingEnabled: true, searchEnabled: true }
        );

        expect(result.text).toBe('识图成功');

        // Upload PoW used the upload_file target path
        expect(fetchPowChallenge).toHaveBeenCalledWith(
            'token-1',
            '/api/v0/file/upload_file',
            undefined
        );

        // Chat request carried the forked vision file_id
        const chatCall = global.fetch.mock.calls.find(([u]) => u.includes('/chat/completion'));
        expect(chatCall).toBeTruthy();
        expect(chatCall[1].headers['x-ds-pow-response']).toBe('base64-pow');
        const chatBody = JSON.parse(chatCall[1].body);
        expect(chatBody.ref_file_ids).toEqual(['vision-1']);
        expect(chatBody.model_type).toBe('default');
        expect(chatBody.thinking_enabled).toBe(true);
        expect(chatBody.search_enabled).toBe(true);
    });

    it('accepts the older upload response shape { data: { id } }', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return { ok: true, status: 200, json: async () => ({ data: { id: 'raw-old' } }) };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-old' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-old', status: 'SUCCESS' }] } },
                    }),
                };
            }
            return { ok: true, status: 200, body: makeStream('data: {"v":"ok"}\n') };
        });

        const result = await sendDeepSeekWebMessage(
            '看图',
            { token: 't', session_id: 's' },
            'vision',
            [IMAGE],
            undefined,
            undefined,
            { modelType: 'vision' }
        );

        expect(result.text).toBe('ok');
        const chatCall = global.fetch.mock.calls.find(([u]) => u.includes('/chat/completion'));
        expect(JSON.parse(chatCall[1].body).ref_file_ids).toEqual(['vision-old']);
    });

    it('waits for a still-parsing file instead of failing immediately', async () => {
        mockPow();
        let fetchFilesCalls = 0;
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                fetchFilesCalls += 1;
                const status = fetchFilesCalls === 1 ? 'PARSING' : 'SUCCESS';
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status }] } },
                    }),
                };
            }
            return { ok: true, status: 200, body: makeStream('data: {"v":"done"}\n') };
        });

        const result = await sendDeepSeekWebMessage(
            '看图',
            { token: 't', session_id: 's' },
            'vision',
            [IMAGE],
            undefined,
            undefined,
            { modelType: 'vision' }
        );

        expect(result.text).toBe('done');
        expect(fetchFilesCalls).toBeGreaterThanOrEqual(2);
    });

    it('throws a descriptive error when the upload response has no file_id', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { message: 'unexpected' } }),
                };
            }
            return { ok: true, status: 200, body: makeStream('data: {"v":"x"}\n') };
        });

        await expect(
            sendDeepSeekWebMessage(
                '看图',
                { token: 't', session_id: 's' },
                'vision',
                [IMAGE],
                undefined,
                undefined,
                { modelType: 'vision' }
            )
        ).rejects.toThrow('DeepSeek Web upload did not return a file_id.');
    });

    it('throws when fork returns no new vision file_id', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: {} } }),
                };
            }
            return { ok: true, status: 200, body: makeStream('data: {"v":"x"}\n') };
        });

        await expect(
            sendDeepSeekWebMessage(
                '看图',
                { token: 't', session_id: 's' },
                'vision',
                [IMAGE],
                undefined,
                undefined,
                { modelType: 'vision' }
            )
        ).rejects.toThrow('DeepSeek Web did not return a forked vision file_id.');
    });

    it('rejects non-image attachments in vision mode', async () => {
        mockPow();
        await expect(
            sendDeepSeekWebMessage(
                '看图',
                { token: 't', session_id: 's' },
                'vision',
                [{ base64: 'dGV4dA==', type: 'text/plain', name: 'a.txt' }],
                undefined,
                undefined,
                { modelType: 'vision' }
            )
        ).rejects.toThrow('仅支持图片附件');
    });

    it('does not duplicate thinking delivered via both old and new SSE formats', async () => {
        mockPow();
        const streamText = [
            'data: {"p":"response/thinking_content","v":"深度思考内容"}',
            'data: {"v":{"response":{"fragments":[{"type":"THINK","content":"深度思考内容"}]}}}',
            'data: {"p":"response/content","o":"APPEND","v":"回答"}',
            'data: {"p":"response/status","v":"FINISHED"}',
            '',
        ].join('\n');
        global.fetch = vi.fn(async () => ({
            ok: true,
            status: 200,
            body: makeStream(streamText),
        }));

        const result = await sendDeepSeekWebMessage(
            '问题',
            { token: 't', session_id: 's' },
            'default',
            [],
            undefined,
            undefined,
            { modelType: 'default' }
        );

        // The same thought block was emitted by both formats → must appear once.
        expect(result.thoughts).toBe('深度思考内容');
        expect(result.text).toBe('回答');
    });

    it('still accumulates incremental thinking fragments normally', async () => {
        mockPow();
        const streamText = [
            'data: {"p":"response/thinking_content","v":"思考一"}',
            'data: {"p":"response/thinking_content","o":"APPEND","v":"，思考二"}',
            'data: {"p":"response/content","o":"APPEND","v":"回答"}',
            '',
        ].join('\n');
        global.fetch = vi.fn(async () => ({
            ok: true,
            status: 200,
            body: makeStream(streamText),
        }));

        const result = await sendDeepSeekWebMessage(
            '问题',
            { token: 't', session_id: 's' },
            'default',
            [],
            undefined,
            undefined,
            { modelType: 'default' }
        );

        expect(result.thoughts).toBe('思考一，思考二');
        expect(result.text).toBe('回答');
    });

    it('does not duplicate content delivered via both old and new SSE formats', async () => {
        mockPow();
        const streamText = [
            'data: {"p":"response/content","v":"回答内容"}',
            'data: {"v":{"response":{"fragments":[{"type":"RESPONSE","content":"回答内容"}]}}}',
            'data: {"p":"response/status","v":"FINISHED"}',
            '',
        ].join('\n');
        global.fetch = vi.fn(async () => ({
            ok: true,
            status: 200,
            body: makeStream(streamText),
        }));

        const result = await sendDeepSeekWebMessage(
            '问题',
            { token: 't', session_id: 's' },
            'default',
            [],
            undefined,
            undefined,
            { modelType: 'default' }
        );

        expect(result.text).toBe('回答内容');
    });

    it('does not upload files when attachments are empty', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/')) throw new Error('should not upload');
            return { ok: true, status: 200, body: makeStream('data: {"v":"hi"}\n') };
        });

        const result = await sendDeepSeekWebMessage(
            '你好',
            { token: 't', session_id: 's' },
            'default',
            [],
            undefined,
            undefined,
            { modelType: 'default' }
        );

        expect(result.text).toBe('hi');
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/file/upload_file'),
            expect.anything()
        );
    });

    it('creates a fresh session for vision requests and sends the chat there', async () => {
        mockPow();
        createDeepSeekSession.mockResolvedValue('fresh-session-1');

        let chatCall;
        global.fetch = vi.fn(async (url, init) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status: 'SUCCESS' }] } },
                    }),
                };
            }
            chatCall = [url, init];
            return { ok: true, status: 200, body: makeStream('data: {"v":"looked"}\n') };
        });

        const result = await sendDeepSeekWebMessage(
            '看图',
            { token: 't', session_id: 'old-session' },
            'vision',
            [IMAGE],
            undefined,
            undefined,
            { modelType: 'vision' }
        );

        expect(result.text).toBe('looked');
        expect(createDeepSeekSession).toHaveBeenCalledWith('t');
        const [chatUrl, chatInit] = chatCall;
        expect(chatUrl).toContain('/chat/completion');
        expect(chatInit.headers.referer).toBe('https://chat.deepseek.com/a/chat/s/fresh-session-1');
        expect(JSON.parse(chatInit.body).chat_session_id).toBe('fresh-session-1');
        expect(JSON.parse(chatInit.body).ref_file_ids).toEqual(['vision-1']);
    });

    it('falls back to the existing session when fresh session creation fails', async () => {
        mockPow();
        createDeepSeekSession.mockRejectedValue(new Error('create failed'));

        let chatCall;
        global.fetch = vi.fn(async (url, init) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status: 'SUCCESS' }] } },
                    }),
                };
            }
            chatCall = [url, init];
            return { ok: true, status: 200, body: makeStream('data: {"v":"ok"}\n') };
        });

        const result = await sendDeepSeekWebMessage(
            '看图',
            { token: 't', session_id: 'old-session' },
            'vision',
            [IMAGE],
            undefined,
            undefined,
            { modelType: 'vision' }
        );

        expect(result.text).toBe('ok');
        expect(JSON.parse(chatCall[1].body).chat_session_id).toBe('old-session');
    });

    it('reports a non-SSE (HTML) chat response instead of an empty result', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status: 'SUCCESS' }] } },
                    }),
                };
            }
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'text/html' },
                text: async () => '<html><body>maintenance</body></html>',
            };
        });

        await expect(
            sendDeepSeekWebMessage(
                '看图',
                { token: 't', session_id: 's' },
                'vision',
                [IMAGE],
                undefined,
                undefined,
                { modelType: 'vision' }
            )
        ).rejects.toThrow(/non-SSE response/);
    });

    it('includes vision ref_file_ids in the empty-response error for debugging', async () => {
        mockPow();
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/file/upload_file')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'raw-1' } } }),
                };
            }
            if (url.includes('/file/fork_file_task')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { biz_data: { id: 'vision-1' } } }),
                };
            }
            if (url.includes('/file/fetch_files')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: { biz_data: { files: [{ id: 'vision-1', status: 'SUCCESS' }] } },
                    }),
                };
            }
            // SSE stream with no usable content events (e.g. queued/empty reply)
            return {
                ok: true,
                status: 200,
                body: makeStream('data: {"p":"response/status","v":"FINISHED"}\n'),
            };
        });

        await expect(
            sendDeepSeekWebMessage(
                '看图',
                { token: 't', session_id: 's' },
                'vision',
                [IMAGE],
                undefined,
                undefined,
                { modelType: 'vision' }
            )
        ).rejects.toThrow(/empty response.*ref_file_ids: vision-1/);
    });

    it('parses indexed fragments emitted during search and reasoning', async () => {
        mockPow();
        const sseLines =
            [
                'data: {"p":"response/fragments","o":"APPEND","v":[{"type":"SEARCH","content":"今日AI新闻"}]}',
                'data: {"p":"response/fragments/0/status","v":"FINISHED"}',
                'data: {"p":"response/fragments","o":"APPEND","v":[{"type":"THINK","content":"正在搜索相关新闻..."}]}',
                'data: {"p":"response/fragments/1/content","o":"APPEND","v":"找到若干条热点。"}',
                'data: {"p":"response/fragments","o":"APPEND","v":[{"type":"RESPONSE","content":"今天AI领域的重大新闻包括："}]}',
                'data: {"p":"response/fragments/2/content","o":"APPEND","v":" 1. 新模型发布。"}',
                'data: {"p":"response/status","v":"FINISHED"}',
                'data: [DONE]',
            ].join('\n') + '\n';

        global.fetch = vi.fn(async (url) => {
            if (url.includes('/chat/completion')) {
                return { ok: true, status: 200, body: makeStream(sseLines) };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });

        const updates = [];
        const result = await sendDeepSeekWebMessage(
            '今日AI 新闻',
            { token: 't-1', session_id: 's-1' },
            'default',
            [],
            undefined,
            (content, thinking) => updates.push({ content, thinking }),
            { searchEnabled: true, modelType: 'default' }
        );

        expect(result.text).toBe('今天AI领域的重大新闻包括： 1. 新模型发布。');
        expect(result.thoughts).toBe('正在搜索相关新闻...找到若干条热点。');
        expect(updates.length).toBeGreaterThan(0);
    });

    it('automatically creates a session when session_id is missing', async () => {
        mockPow();
        createDeepSeekSession.mockResolvedValue('auto-created-session');
        global.fetch = vi.fn(async (url) => {
            if (url.includes('/chat/completion')) {
                return { ok: true, status: 200, body: makeStream('data: {"v":"hello"}\n') };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });

        const context = { token: 't-1' };
        const result = await sendDeepSeekWebMessage(
            'hi',
            context,
            'default',
            [],
            undefined,
            undefined,
            { modelType: 'default' }
        );

        expect(result.text).toBe('hello');
        expect(createDeepSeekSession).toHaveBeenCalledWith('t-1');
        expect(context.session_id).toBe('auto-created-session');
    });
});
