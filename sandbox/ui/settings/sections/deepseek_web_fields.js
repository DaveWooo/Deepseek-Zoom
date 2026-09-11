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
    if (el.deepseekWebModelType) el.deepseekWebModelType.value = 'default';
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
        deepseek_web_model_type: 'default',
        deepseek_web_model_enabled_default: true,
        deepseek_web_model_enabled_expert: true,
        deepseek_web_model_enabled_vision: true,
    };
}

export function updateDeepSeekWebStatusDots(_section) {}
