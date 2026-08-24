import './web_model_catalog.js';

const catalog = globalThis.GeminiNexusWebModelCatalog;

export const DEFAULT_WEB_MODEL = catalog.DEFAULT_WEB_MODEL;

export function createWebModelOptions(storageData = {}) {
    return catalog.createWebModelOptions(storageData);
}

export function createWebModelOptionMarkup() {
    return catalog.createWebModelOptionMarkup();
}

export function getWebModelHeaderConfig(model) {
    return catalog.getWebModelHeaderConfig(model);
}

export function getSupportedWebModelValues() {
    return catalog.getSupportedWebModelValues();
}
