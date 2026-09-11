// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createModelOptions, getPreferredModel } from './model_options.js';

describe('createModelOptions grouped across providers', () => {
    it('returns all valid models grouped by company with Web vs API separation', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {},
        });

        const groups = [...new Set(options.map((opt) => opt.group))];
        expect(groups).toContain('DeepSeek (网页版)');
        expect(groups).toContain('DeepSeek (官方 API)');
        expect(groups).toContain('Google (网页版)');
        expect(groups).toContain('Google (官方 API)');
        expect(groups).toContain('OpenAI (官方 API)');
        expect(groups).toContain('Anthropic (Claude API)');
        expect(groups).toContain('Alibaba (通义千问 API)');
        expect(groups).toContain('Zhipu (智谱清言 API)');
        expect(groups).toContain('OpenRouter (多模型路由)');

        expect(
            options.some((opt) => opt.value === 'default' && opt.group === 'DeepSeek (网页版)')
        ).toBe(true);
        expect(options.some((opt) => opt.group === 'Google (网页版)')).toBe(true);
        expect(options.some((opt) => opt.group === 'Google (官方 API)')).toBe(true);
    });

    it('provides the unified DeepSeek Web model in the DeepSeek (网页版) group', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {
                deepseek_web_model_enabled_expert: false,
            },
        });

        const deepseekWebOpts = options.filter((opt) => opt.provider === 'deepseek_web');
        expect(deepseekWebOpts).toEqual([
            {
                value: 'default',
                label: 'DeepSeek (网页版)',
                group: 'DeepSeek (网页版)',
                provider: 'deepseek_web',
            },
        ]);
    });

    it('filters out disabled Gemini Web modes in the Google (网页版) group', () => {
        const options = createModelOptions({
            provider: 'web',
            gemini_web_model_enabled_pro: false,
        });

        const googleWebOpts = options.filter((opt) => opt.provider === 'web');
        expect(googleWebOpts.some((opt) => opt.value === 'e6fa609c3fa255c0')).toBe(false);
        expect(googleWebOpts.some((opt) => opt.value === 'fbb127bbb056c959')).toBe(true);
    });

    it('falls back to the unified default mode for DeepSeek Web', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {
                deepseek_web_model_enabled_default: false,
                deepseek_web_model_enabled_expert: false,
                deepseek_web_model_enabled_vision: false,
            },
        });

        const deepseekWebOpts = options.filter((opt) => opt.provider === 'deepseek_web');
        expect(deepseekWebOpts).toEqual([
            {
                value: 'default',
                label: 'DeepSeek (网页版)',
                group: 'DeepSeek (网页版)',
                provider: 'deepseek_web',
            },
        ]);
    });

    it('never exposes the API default model id for deepseek_web', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {},
        });

        const deepseekWebOpts = options.filter((opt) => opt.provider === 'deepseek_web');
        expect(deepseekWebOpts.some((option) => option.value === 'deepseek-v4-3.6-flash')).toBe(
            false
        );
    });

    it('still returns API models for the deepseek dedicated API provider in the DeepSeek (官方 API) group', () => {
        const options = createModelOptions({
            provider: 'deepseek',
            deepseekWeb: {},
        });

        const deepseekApiOpts = options.filter((opt) => opt.provider === 'deepseek');
        expect(deepseekApiOpts.length).toBeGreaterThan(0);
        expect(deepseekApiOpts[0].value).toBe('deepseek-v4-pro');
        expect(deepseekApiOpts[0].group).toBe('DeepSeek (官方 API)');
    });
});

describe('getPreferredModel for deepseek_web provider', () => {
    it('always returns default unified model for deepseek_web', () => {
        const preferred = getPreferredModel(
            {
                provider: 'deepseek_web',
                deepseekWeb: { deepseek_web_model_type: 'expert' },
            },
            'default'
        );

        expect(preferred).toBe('default');
    });

    it('falls back to default model type', () => {
        const preferred = getPreferredModel(
            {
                provider: 'deepseek_web',
                deepseekWeb: {},
            },
            'whatever'
        );

        expect(preferred).toBe('default');
    });
});
