/**
 * DeepSeek Web provider shared model types & helpers.
 *
 * Model types map to chat.deepseek.com mode selector:
 *  - 'default' -> 快速模式 (DeepSeek-V4 3.6 Flash)
 *  - 'expert'  -> 专家模式 (DeepSeek-R1 reasoning)
 *  - 'vision'  -> 识图模式 (multimodal, requires ref_file_ids)
 *
 * These are shared by background (request dispatcher), settings UI
 * (connection section) and the sidebar model selector.
 */

export const DEEPSEEK_WEB_MODEL_TYPES = Object.freeze([
    {
        value: 'vision',
        labelKey: 'deepseekWebModelVision',
        labelFallback: 'DeepSeek Vision (识图)',
        supportsFile: true,
    },
    {
        value: 'default',
        labelKey: 'deepseekWebModelDefault',
        labelFallback: 'DeepSeek最新版模型 (快速)',
        supportsFile: false,
    },
    {
        value: 'expert',
        labelKey: 'deepseekWebModelExpert',
        labelFallback: 'DeepSeek R1 (专家)',
        supportsFile: false,
    },
]);

export const DEEPSEEK_WEB_DEFAULT_MODEL_TYPE = 'default';

/**
 * Whether a given value is a valid DeepSeek Web model type.
 * @param {string} value
 * @returns {boolean}
 */
export function isDeepSeekWebModelType(value) {
    return DEEPSEEK_WEB_MODEL_TYPES.some((m) => m.value === value);
}

/**
 * Normalize a raw model_type value to a valid one, falling back to default.
 * @param {string} value
 * @returns {string}
 */
export function normalizeDeepSeekWebModelType(value) {
    return isDeepSeekWebModelType(value) ? value : DEEPSEEK_WEB_DEFAULT_MODEL_TYPE;
}

/**
 * Get a model type's display label (fallback when no i18n available).
 * @param {string} value
 * @returns {string}
 */
export function getDeepSeekWebModelLabel(value) {
    const m = DEEPSEEK_WEB_MODEL_TYPES.find((x) => x.value === value);
    return m ? m.labelFallback : value;
}

/**
 * Model option shape used by the sidebar model selector.
 * @param {string} value
 * @returns {{value:string,label:string}}
 */
export function toModelOption(value) {
    return { value, label: getDeepSeekWebModelLabel(value) };
}

/**
 * Enabled-state storage key for a DeepSeek Web model type.
 * @param {string} modelType
 * @returns {string}
 */
export function getDeepSeekWebModelEnabledKey(modelType) {
    return `deepseek_web_model_enabled_${modelType}`;
}

export const DEEPSEEK_WEB_MODEL_ENABLED_KEYS = DEEPSEEK_WEB_MODEL_TYPES.map((m) =>
    getDeepSeekWebModelEnabledKey(m.value)
);

/**
 * Whether a DeepSeek Web model type is enabled (user-toggleable).
 * Defaults to true when unset (all modes available out of the box).
 * @param {object} storageData - raw chrome.storage data or settings payload
 * @param {string} modelType
 * @returns {boolean}
 */
export function isDeepSeekWebModelEnabled(storageData = {}, modelType) {
    const KEY = getDeepSeekWebModelEnabledKey(modelType);
    const raw = storageData[KEY];
    // Storage payload key (with deepseek_web_ prefix) is the same; some paths use settings object.
    if (raw === undefined) {
        // support settings-payload style (key already carries prefix)
        return true;
    }
    return raw !== false;
}

/**
 * Build the list of DeepSeek Web model options, filtering to enabled ones.
 * @param {object} storageData
 * @returns {Array<{value:string,label:string}>}
 */
export function getEnabledDeepSeekWebModelOptions(storageData = {}) {
    return DEEPSEEK_WEB_MODEL_TYPES.filter((m) =>
        isDeepSeekWebModelEnabled(storageData, m.value)
    ).map((m) => ({ value: m.value, label: m.labelFallback }));
}
