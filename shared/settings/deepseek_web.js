/**
 * DeepSeek Web provider shared model types & helpers.
 *
 * Model types map to chat.deepseek.com mode selector:
 *  - 'default' -> 快速模式 (DeepSeek-V4 Flash)
 *  - 'expert'  -> 专家模式 (DeepSeek-R1 reasoning)
 *  - 'vision'  -> 识图模式 (multimodal, requires ref_file_ids)
 *
 * These are shared by background (request dispatcher), settings UI
 * (connection section) and the sidebar model selector.
 */

export const DEEPSEEK_WEB_MODEL_TYPES = Object.freeze([
    {
        value: 'default',
        labelKey: 'deepseekWebModelDefault',
        labelFallback: 'DeepSeek (网页版)',
        supportsFile: true,
    },
]);

export const DEEPSEEK_WEB_DEFAULT_MODEL_TYPE = 'default';

/**
 * Normalize a raw model_type value to a valid one.
 * chat.deepseek.com has unified all modes into a single model, so this always resolves to 'default'.
 * @param {string} _value
 * @returns {string}
 */
export function normalizeDeepSeekWebModelType(_value) {
    return DEEPSEEK_WEB_DEFAULT_MODEL_TYPE;
}

/**
 * Enabled-state storage key for a DeepSeek Web model type.
 * @param {string} modelType
 * @returns {string}
 */
export function getDeepSeekWebModelEnabledKey(modelType) {
    return `deepseek_web_model_enabled_${modelType}`;
}

export const DEEPSEEK_WEB_MODEL_ENABLED_KEYS = ['default', 'expert', 'vision'].map((m) =>
    getDeepSeekWebModelEnabledKey(m)
);

/**
 * Build the list of DeepSeek Web model options.
 * Returns the unified DeepSeek Web model.
 * @param {object} _storageData
 * @returns {Array<{value:string,label:string}>}
 */
export function getEnabledDeepSeekWebModelOptions(_storageData = {}) {
    return [
        {
            value: DEEPSEEK_WEB_DEFAULT_MODEL_TYPE,
            label: DEEPSEEK_WEB_MODEL_TYPES[0].labelFallback,
        },
    ];
}
