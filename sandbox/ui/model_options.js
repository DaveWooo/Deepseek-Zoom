import {
    DEFAULT_OFFICIAL_MODEL,
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

export function getModelProvider(settings) {
    return settings.provider || (settings.useOfficialApi === true ? 'official' : DEFAULT_PROVIDER);
}

function parseConfiguredModels(rawModels) {
    return String(rawModels || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
}

export function createModelOptions(settings) {
    const provider = getModelProvider(settings);

    if (provider === 'official') {
        const models = parseConfiguredModels(settings.officialModel);
        return models.length > 0
            ? models.map((model) => ({ value: model, label: model }))
            : [{ value: DEFAULT_OFFICIAL_MODEL, label: DEFAULT_OFFICIAL_MODEL }];
    }

    if (provider === 'openai') {
        const models = parseConfiguredModels(settings.openaiModel);
        return models.length > 0
            ? models.map((model) => ({ value: model, label: model }))
            : [{ value: DEFAULT_OPENAI_MODEL, label: t('customModel') }];
    }

    // deepseek_web also lives in DEDICATED_API_PROVIDERS, so the dedicated
    // branch below would otherwise swallow it and expose API model ids
    // (e.g. deepseek-v4-3.6-flash) instead of the three web modes. Check it
    // first so the web model toggles stay authoritative.
    if (isDeepSeekWebProvider(provider)) {
        const enabled = getEnabledDeepSeekWebModelOptions(settings.deepseekWeb || {});
        return enabled.length > 0
            ? enabled
            : [{ value: 'default', label: 'DeepSeek最新版模型 (快速)' }];
    }

    if (isDedicatedApiProvider(provider)) {
        const providerSettings = getDedicatedApiRuntimeSettings(settings, provider);
        const models = parseConfiguredModels(providerSettings?.model);
        const fallback = getDedicatedApiDefaultModel(provider);
        return models.length > 0
            ? models.map((model) => ({ value: model, label: model }))
            : [{ value: fallback, label: fallback || t('customModel') }];
    }

    return createWebModelOptions();
}

export function getPreferredModel(settings, currentValue) {
    const provider = getModelProvider(settings);
    if (provider === 'openai') {
        return settings.openaiSelectedModel || settings.selectedModel || currentValue;
    }
    if (isDeepSeekWebProvider(provider)) {
        return settings.deepseekWeb?.deepseek_web_model_type || 'default';
    }
    if (isDedicatedApiProvider(provider)) {
        const providerSettings = getDedicatedApiRuntimeSettings(settings, provider);
        return providerSettings?.selectedModel || settings.selectedModel || currentValue;
    }
    return settings.selectedModel || currentValue;
}
