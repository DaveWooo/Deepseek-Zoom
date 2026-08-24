/**
 * DeepSeek Web settings fields helper.
 */

export function loadDeepSeekWebIntoForm(section, dsw = {}) {
    const el = section.elements;
    if (el.deepseekWebPhone) el.deepseekWebPhone.value = dsw.deepseek_web_phone || '';
    if (el.deepseekWebPassword) el.deepseekWebPassword.value = dsw.deepseek_web_password || '';
    section.deepseekWebAreaCodeValue = dsw.deepseek_web_area_code || '+86';
    if (el.deepseekWebAreaCode) el.deepseekWebAreaCode.value = section.deepseekWebAreaCodeValue;
    if (el.deepseekWebThinkingEnabled)
        el.deepseekWebThinkingEnabled.checked = dsw.deepseek_web_thinking_enabled !== false;
    if (el.deepseekWebSearchEnabled)
        el.deepseekWebSearchEnabled.checked = dsw.deepseek_web_search_enabled !== false;
    if (el.deepseekWebModelType)
        el.deepseekWebModelType.value = dsw.deepseek_web_model_type || 'default';
    if (el.deepseekWebModelEnabledDefault)
        el.deepseekWebModelEnabledDefault.checked =
            dsw.deepseek_web_model_enabled_default !== false;
    if (el.deepseekWebModelEnabledExpert)
        el.deepseekWebModelEnabledExpert.checked = dsw.deepseek_web_model_enabled_expert !== false;
    if (el.deepseekWebModelEnabledVision)
        el.deepseekWebModelEnabledVision.checked = dsw.deepseek_web_model_enabled_vision !== false;
    updateDeepSeekWebStatusDots(section);
    if (el.deepseekWebLoginStatus && dsw.deepseek_web_token) {
        el.deepseekWebLoginStatus.textContent = '✅ Logged in';
    }
}

export function saveDeepSeekWebEdits(section) {
    const el = section.elements;
    return {
        deepseek_web_phone: el.deepseekWebPhone ? el.deepseekWebPhone.value.trim() : '',
        deepseek_web_password: el.deepseekWebPassword ? el.deepseekWebPassword.value.trim() : '',
        deepseek_web_area_code: el.deepseekWebAreaCode
            ? el.deepseekWebAreaCode.value.trim()
            : section.deepseekWebAreaCodeValue || '+86',
        deepseek_web_thinking_enabled: el.deepseekWebThinkingEnabled
            ? el.deepseekWebThinkingEnabled.checked
            : false,
        deepseek_web_search_enabled: el.deepseekWebSearchEnabled
            ? el.deepseekWebSearchEnabled.checked
            : false,
        deepseek_web_model_type: el.deepseekWebModelType
            ? el.deepseekWebModelType.value
            : 'default',
        deepseek_web_model_enabled_default: el.deepseekWebModelEnabledDefault
            ? el.deepseekWebModelEnabledDefault.checked === true
            : true,
        deepseek_web_model_enabled_expert: el.deepseekWebModelEnabledExpert
            ? el.deepseekWebModelEnabledExpert.checked === true
            : true,
        deepseek_web_model_enabled_vision: el.deepseekWebModelEnabledVision
            ? el.deepseekWebModelEnabledVision.checked === true
            : true,
    };
}

export function updateDeepSeekWebStatusDots(section) {
    const el = section.elements;
    const dots = [
        {
            checkbox: el.deepseekWebModelEnabledDefault,
            dot: el.deepseekWebStatusDotDefault,
        },
        {
            checkbox: el.deepseekWebModelEnabledExpert,
            dot: el.deepseekWebStatusDotExpert,
        },
        {
            checkbox: el.deepseekWebModelEnabledVision,
            dot: el.deepseekWebStatusDotVision,
        },
    ];
    for (const { checkbox, dot } of dots) {
        if (dot) {
            dot.className =
                'model-status-dot ' +
                (checkbox?.checked !== false ? 'model-status-enabled' : 'model-status-disabled');
        }
    }
}
