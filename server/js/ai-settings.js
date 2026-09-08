var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');
var CONFIG_LOCAL_PATH = path.join(ROOT, 'server', 'config_local.json');
var SECRETS_PATH = path.join(ROOT, 'server', 'ai-secrets.json');

var AI_CONFIG_KEYS = [
    'ai_enabled',
    'ai_provider',
    'ai_model',
    'ai_timeout_ms',
    'ollama_base_url',
    'ollama_cloud_base_url'
];

var SECRET_KEYS = [
    'openai_api_key',
    'anthropic_api_key',
    'ollama_api_key',
    'admin_token'
];

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
}

function loadSecrets() {
    var secrets = readJsonFile(SECRETS_PATH, {});
    if (process.env.OPENAI_API_KEY) {
        secrets.openai_api_key = process.env.OPENAI_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) {
        secrets.anthropic_api_key = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.OLLAMA_API_KEY) {
        secrets.ollama_api_key = process.env.OLLAMA_API_KEY;
    }
    if (process.env.ADMIN_TOKEN) {
        secrets.admin_token = process.env.ADMIN_TOKEN;
    }
    return secrets;
}

function saveSecrets(secrets) {
    var toSave = {};
    SECRET_KEYS.forEach(function(key) {
        if (secrets[key]) {
            toSave[key] = secrets[key];
        }
    });
    writeJsonFile(SECRETS_PATH, toSave);
}

function loadLocalConfig() {
    return readJsonFile(CONFIG_LOCAL_PATH, {});
}

function mergeAiIntoConfig(config, secrets) {
    secrets = secrets || loadSecrets();
    SECRET_KEYS.forEach(function(key) {
        if (secrets[key]) {
            config[key] = secrets[key];
        }
    });
    return config;
}

function applyAiSettings(config, updates, secrets) {
    secrets = secrets || loadSecrets();
    var local = loadLocalConfig();

    if (updates.ai_enabled !== undefined) {
        local.ai_enabled = !!updates.ai_enabled;
        config.ai_enabled = local.ai_enabled;
    }
    if (updates.ai_provider !== undefined) {
        local.ai_provider = String(updates.ai_provider);
        config.ai_provider = local.ai_provider;
    }
    if (updates.ai_model !== undefined) {
        var modelId = String(updates.ai_model).trim();
        // Guard against browser autofill writing an API key into the model field.
        if (/^[a-f0-9]{20,}\.[A-Za-z0-9_-]{16,}$/i.test(modelId) || modelId.length > 80) {
            throw new Error('ai_model looks like an API key — use the key fields instead');
        }
        local.ai_model = modelId;
        config.ai_model = local.ai_model;
    }
    if (updates.ai_timeout_ms !== undefined) {
        var timeout = parseInt(updates.ai_timeout_ms, 10);
        if (!isNaN(timeout) && timeout > 0) {
            local.ai_timeout_ms = timeout;
            config.ai_timeout_ms = timeout;
        }
    }
    if (updates.ollama_base_url !== undefined) {
        local.ollama_base_url = String(updates.ollama_base_url);
        config.ollama_base_url = local.ollama_base_url;
    }
    if (updates.ollama_cloud_base_url !== undefined) {
        local.ollama_cloud_base_url = String(updates.ollama_cloud_base_url);
        config.ollama_cloud_base_url = local.ollama_cloud_base_url;
    }

    writeJsonFile(CONFIG_LOCAL_PATH, local);

    ['openai_api_key', 'anthropic_api_key', 'ollama_api_key'].forEach(function(key) {
        var clearFlag = updates['clear_' + key];
        if (clearFlag) {
            delete secrets[key];
            delete config[key];
            return;
        }
        if (updates[key] !== undefined && updates[key] !== null && String(updates[key]).trim() !== '') {
            secrets[key] = String(updates[key]).trim();
            config[key] = secrets[key];
        }
    });

    if (updates.admin_token !== undefined) {
        if (updates.clear_admin_token || String(updates.admin_token).trim() === '') {
            if (updates.clear_admin_token) {
                delete secrets.admin_token;
                delete config.admin_token;
            }
        } else {
            secrets.admin_token = String(updates.admin_token).trim();
            config.admin_token = secrets.admin_token;
        }
    }

    saveSecrets(secrets);
    return { config: config, secrets: secrets };
}

function publicStatus(config, secrets) {
    secrets = secrets || loadSecrets();
    return {
        ai_enabled: !!config.ai_enabled,
        ai_provider: config.ai_provider || 'openai',
        ai_model: config.ai_model || '',
        ai_timeout_ms: config.ai_timeout_ms || 12000,
        ollama_base_url: config.ollama_base_url || 'http://127.0.0.1:11434',
        ollama_cloud_base_url: config.ollama_cloud_base_url || 'https://ollama.com',
        openai_api_key_set: !!(secrets.openai_api_key || config.openai_api_key),
        anthropic_api_key_set: !!(secrets.anthropic_api_key || config.anthropic_api_key),
        ollama_api_key_set: !!(secrets.ollama_api_key || config.ollama_api_key),
        admin_token_set: !!(secrets.admin_token || config.admin_token || process.env.ADMIN_TOKEN)
    };
}

module.exports = {
    AI_CONFIG_KEYS: AI_CONFIG_KEYS,
    SECRET_KEYS: SECRET_KEYS,
    SECRETS_PATH: SECRETS_PATH,
    CONFIG_LOCAL_PATH: CONFIG_LOCAL_PATH,
    loadSecrets: loadSecrets,
    saveSecrets: saveSecrets,
    loadLocalConfig: loadLocalConfig,
    mergeAiIntoConfig: mergeAiIntoConfig,
    applyAiSettings: applyAiSettings,
    publicStatus: publicStatus
};
