// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createModelOptions, getPreferredModel } from './model_options.js';

describe('createModelOptions for deepseek_web provider', () => {
    it('returns the three DeepSeek Web modes when all are enabled', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {},
        });

        expect(options).toEqual([
            { value: 'vision', label: 'DeepSeek Vision (识图)' },
            { value: 'default', label: 'DeepSeek最新版模型 (快速)' },
            { value: 'expert', label: 'DeepSeek R1 (专家)' },
        ]);
    });

    it('filters out disabled DeepSeek Web modes', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {
                deepseek_web_model_enabled_expert: false,
            },
        });

        expect(options).toEqual([
            { value: 'vision', label: 'DeepSeek Vision (识图)' },
            { value: 'default', label: 'DeepSeek最新版模型 (快速)' },
        ]);
    });

    it('falls back to the default mode when every mode is disabled', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {
                deepseek_web_model_enabled_default: false,
                deepseek_web_model_enabled_expert: false,
                deepseek_web_model_enabled_vision: false,
            },
        });

        expect(options).toEqual([{ value: 'default', label: 'DeepSeek最新版模型 (快速)' }]);
    });

    it('never exposes the API default model id for deepseek_web', () => {
        const options = createModelOptions({
            provider: 'deepseek_web',
            deepseekWeb: {},
        });

        expect(options.some((option) => option.value === 'deepseek-v4-3.6-flash')).toBe(false);
    });

    it('still returns API models for the deepseek dedicated API provider', () => {
        const options = createModelOptions({
            provider: 'deepseek',
            deepseekWeb: {},
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options[0].value).toBe('deepseek-v4-pro');
    });
});

describe('getPreferredModel for deepseek_web provider', () => {
    it('prefers the stored model type over the current value', () => {
        const preferred = getPreferredModel(
            {
                provider: 'deepseek_web',
                deepseekWeb: { deepseek_web_model_type: 'expert' },
            },
            'default'
        );

        expect(preferred).toBe('expert');
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
