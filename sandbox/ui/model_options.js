import {
    DEDICATED_API_PROVIDERS,
    DEFAULT_OFFICIAL_MODEL,
    DEFAULT_OFFICIAL_MODELS,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PROVIDER,
} from '../../shared/config/constants.js';
import {
    getDedicatedApiDefaultModel,
    getDedicatedApiRuntimeSettings,
    isDedicatedApiProvider,
} from '../../shared/settings/dedicated_providers.js';
import { getEnabledDeepSeekWebModelOptions } from '../../shared/settings/deepseek_web.js';
import { isDeepSeekWebProvider } from '../../shared/settings/connection.js';
import { createWebModelOptions } from '../../shared/models/web_models.js';
import { t } from '../core/i18n.js';

export function getModelProvider(settings = {}) {
    return settings.provider || (settings.useOfficialApi === true ? 'official' : DEFAULT_PROVIDER);
}

function parseConfiguredModels(rawModels) {
    return String(rawModels || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
}

function getProviderGroupLabel(provider) {
    switch (provider) {
        case 'deepseek_web':
            return 'DeepSeek (网页版)';
        case 'deepseek':
            return 'DeepSeek (官方 API)';
        case 'web':
            return 'Google (网页版)';
        case 'official':
            return 'Google (官方 API)';
        case 'openai':
            return 'OpenAI (兼容 API)';
        case 'openai_official':
            return 'OpenAI (官方 API)';
        case 'anthropic':
            return 'Anthropic (Claude API)';
        case 'dashscope':
            return 'Alibaba (通义千问 API)';
        case 'zhipu':
            return 'Zhipu (智谱清言 API)';
        case 'openrouter':
            return 'OpenRouter (多模型路由)';
        default:
            return 'Other';
    }
}

export function createProviderModelOptions(settings = {}) {
    const provider = getModelProvider(settings);
    const group = getProviderGroupLabel(provider);

    if (provider === 'official') {
        const models = parseConfiguredModels(settings.officialModel || DEFAULT_OFFICIAL_MODELS);
        return models.length > 0
            ? models.map((model) => ({
                  value: model,
                  label: model,
                  group,
                  provider: 'official',
              }))
            : [
                  {
                      value: DEFAULT_OFFICIAL_MODEL,
                      label: DEFAULT_OFFICIAL_MODEL,
                      group,
                      provider: 'official',
                  },
              ];
    }

    if (provider === 'openai') {
        const models = parseConfiguredModels(settings.openaiModel);
        return models.length > 0
            ? models.map((model) => ({
                  value: model,
                  label: model,
                  group,
                  provider: 'openai',
              }))
            : [
                  {
                      value: DEFAULT_OPENAI_MODEL,
                      label: t('customModel'),
                      group,
                      provider: 'openai',
                  },
              ];
    }

    if (isDeepSeekWebProvider(provider)) {
        const enabled = getEnabledDeepSeekWebModelOptions(settings.deepseekWeb || {});
        return (
            enabled.length > 0 ? enabled : [{ value: 'default', label: 'DeepSeek (网页版)' }]
        ).map((opt) => ({ ...opt, group, provider: 'deepseek_web' }));
    }

    if (isDedicatedApiProvider(provider)) {
        const providerSettings = getDedicatedApiRuntimeSettings(settings, provider);
        const models = parseConfiguredModels(providerSettings?.model);
        const fallback = getDedicatedApiDefaultModel(provider);
        return models.length > 0
            ? models.map((model) => ({ value: model, label: model, group, provider }))
            : [{ value: fallback, label: fallback || t('customModel'), group, provider }];
    }

    return createWebModelOptions(settings).map((opt) => ({
        ...opt,
        label: `Gemini ${opt.label}`.replace(/^Gemini\s+Gemini\s+/i, 'Gemini '),
        group,
        provider: 'web',
    }));
}

export function createModelOptions(settings = {}, { providerOnly = false } = {}) {
    if (providerOnly) {
        return createProviderModelOptions(settings);
    }

    const allOptions = [];

    // 1. DeepSeek (Web + API)
    const enabledDsWeb = getEnabledDeepSeekWebModelOptions(settings.deepseekWeb || settings || {});
    const dsWebList =
        enabledDsWeb.length > 0 ? enabledDsWeb : [{ value: 'default', label: 'DeepSeek (网页版)' }];
    dsWebList.forEach((m) => {
        allOptions.push({
            value: m.value,
            label: m.label,
            group: 'DeepSeek (网页版)',
            provider: 'deepseek_web',
        });
    });

    const dsApiSettings = getDedicatedApiRuntimeSettings(settings, 'deepseek');
    const dsApiModels = parseConfiguredModels(
        dsApiSettings?.model || DEDICATED_API_PROVIDERS.deepseek?.defaultModels
    );
    dsApiModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'DeepSeek (官方 API)',
            provider: 'deepseek',
        });
    });

    // 2. Google (Web + Official API)
    const webModels = createWebModelOptions(settings);
    webModels.forEach((m) => {
        allOptions.push({
            value: m.value,
            label: `Gemini ${m.label}`.replace(/^Gemini\s+Gemini\s+/i, 'Gemini '),
            group: 'Google (网页版)',
            provider: 'web',
        });
    });

    const officialModels = parseConfiguredModels(settings.officialModel || DEFAULT_OFFICIAL_MODELS);
    officialModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'Google (官方 API)',
            provider: 'official',
        });
    });

    // 3. OpenAI (Official API + Compatible)
    const openaiOfficialSettings = getDedicatedApiRuntimeSettings(settings, 'openai_official');
    const openaiOfficialModels = parseConfiguredModels(
        openaiOfficialSettings?.model || DEDICATED_API_PROVIDERS.openai_official?.defaultModels
    );
    openaiOfficialModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'OpenAI (官方 API)',
            provider: 'openai_official',
        });
    });
    if (settings.openaiModel && settings.openaiModel !== DEFAULT_OPENAI_MODEL) {
        const customOpenaiModels = parseConfiguredModels(settings.openaiModel);
        customOpenaiModels.forEach((model) => {
            allOptions.push({
                value: model,
                label: model,
                group: 'OpenAI (兼容 API)',
                provider: 'openai',
            });
        });
    }

    // 4. Anthropic
    const anthropicSettings = getDedicatedApiRuntimeSettings(settings, 'anthropic');
    const anthropicModels = parseConfiguredModels(
        anthropicSettings?.model || DEDICATED_API_PROVIDERS.anthropic?.defaultModels
    );
    anthropicModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'Anthropic (Claude API)',
            provider: 'anthropic',
        });
    });

    // 5. Alibaba (通义千问)
    const dashscopeSettings = getDedicatedApiRuntimeSettings(settings, 'dashscope');
    const dashscopeModels = parseConfiguredModels(
        dashscopeSettings?.model || DEDICATED_API_PROVIDERS.dashscope?.defaultModels
    );
    dashscopeModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'Alibaba (通义千问 API)',
            provider: 'dashscope',
        });
    });

    // 6. Zhipu (智谱清言)
    const zhipuSettings = getDedicatedApiRuntimeSettings(settings, 'zhipu');
    const zhipuModels = parseConfiguredModels(
        zhipuSettings?.model || DEDICATED_API_PROVIDERS.zhipu?.defaultModels
    );
    zhipuModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'Zhipu (智谱清言 API)',
            provider: 'zhipu',
        });
    });

    // 7. OpenRouter
    const openrouterSettings = getDedicatedApiRuntimeSettings(settings, 'openrouter');
    const openrouterModels = parseConfiguredModels(
        openrouterSettings?.model || DEDICATED_API_PROVIDERS.openrouter?.defaultModels
    );
    openrouterModels.forEach((model) => {
        allOptions.push({
            value: model,
            label: model,
            group: 'OpenRouter (多模型路由)',
            provider: 'openrouter',
        });
    });

    return allOptions;
}

export function getPreferredModel(settings = {}, currentValue) {
    const provider = getModelProvider(settings);
    if (provider === 'openai') {
        return settings.openaiSelectedModel || settings.selectedModel || currentValue;
    }
    if (isDeepSeekWebProvider(provider)) {
        return 'default';
    }
    if (isDedicatedApiProvider(provider)) {
        const providerSettings = getDedicatedApiRuntimeSettings(settings, provider);
        return providerSettings?.selectedModel || settings.selectedModel || currentValue;
    }
    return settings.selectedModel || currentValue;
}
