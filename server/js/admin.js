var fs = require('fs');
var path = require('path');
var url = require('url');
var aiSettings = require('./ai-settings');

var ROOT = path.resolve(__dirname, '../..');
var ADMIN_DIR = path.join(ROOT, 'admin');

var MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
};

var ANTHROPIC_MODEL_SUGGESTIONS = [
    // Current frontier (curated order = dropdown order)
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-fable-5',
    'claude-haiku-4-5',
    // Recent / still useful
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-opus-4-5',
    'claude-haiku-4-5-20251001'
];

var OPENAI_MODEL_SUGGESTIONS = [
    // Current frontier
    'gpt-5.5',
    'gpt-5.5-pro',
    'gpt-5.4',
    'gpt-5.4-pro',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-5.3-chat-latest',
    'gpt-5.2',
    'gpt-5.2-pro',
    'gpt-5.1',
    'gpt-5.1-mini',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    // Strong non-reasoning / legacy favorites
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o4-mini',
    'o3',
    'o3-mini',
    'chatgpt-4o-latest'
];

// Local Ollama installs (no :cloud suffix)
var OLLAMA_MODEL_SUGGESTIONS = [
    'glm-5.3',
    'glm-5.3-flash',
    'gemma4',
    'qwen3.5',
    'llama3.2',
    'llama3.1',
    'mistral',
    'mixtral',
    'phi4',
    'deepseek-r1',
    'gpt-oss'
];

// Ollama Cloud via https://ollama.com — store/display with :cloud for clarity;
// the provider strips :cloud when calling ollama.com directly.
// Prefer faster / shorter-thinking models near the top for NPC dialogue.
var OLLAMA_CLOUD_MODEL_SUGGESTIONS = [
    'glm-5.3-flash:cloud',
    'gemma4:cloud',
    'minimax-m2.7:cloud',
    'glm-5.1:cloud',
    'glm-5.3:cloud',
    'gpt-oss:20b-cloud',
    'qwen3.5:cloud',
    'deepseek-v4-flash:cloud',
    'kimi-k2.6:cloud',
    'minimax-m3:cloud',
    'gpt-oss:120b-cloud'
];

function mergeCatalog(live, curated, message) {
    var seen = {};
    var out = [];

    // Keep curated order first so frontiers stay at the top of the dropdown.
    (curated || []).forEach(function(id) {
        if (!id || seen[id]) {
            return;
        }
        seen[id] = true;
        out.push(id);
    });

    (live || []).slice().sort().forEach(function(id) {
        if (!id || seen[id]) {
            return;
        }
        seen[id] = true;
        out.push(id);
    });

    return {
        models: out,
        message: message || ''
    };
}

function isLoopbackAddress(address) {
    if (!address) {
        return false;
    }
    var cleaned = String(address).replace(/^::ffff:/, '');
    return cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === 'localhost';
}

function getClientAddress(req) {
    return (req.socket && req.socket.remoteAddress) || '';
}

function getProvidedToken(req, parsedUrl) {
    var auth = req.headers.authorization || '';
    if (auth.toLowerCase().indexOf('bearer ') === 0) {
        return auth.slice(7).trim();
    }
    if (parsedUrl.query && parsedUrl.query.token) {
        return String(parsedUrl.query.token);
    }
    return '';
}

function getConfiguredAdminToken(config) {
    return process.env.ADMIN_TOKEN || config.admin_token || '';
}

function isAdminRequest(req, config) {
    if (isLoopbackAddress(getClientAddress(req))) {
        return true;
    }
    var configured = getConfiguredAdminToken(config);
    if (!configured) {
        return false;
    }
    var parsedUrl = url.parse(req.url, true);
    var provided = getProvidedToken(req, parsedUrl);
    return provided && provided === configured;
}

function sendJson(response, status, payload) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function readBody(req) {
    return new Promise(function(resolve, reject) {
        var chunks = [];
        req.on('data', function(chunk) {
            chunks.push(chunk);
            if (Buffer.concat(chunks).length > 1e6) {
                reject(new Error('Body too large'));
                req.destroy();
            }
        });
        req.on('end', function() {
            var raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function serveAdminStatic(pathname, response) {
    var relative = pathname === '/admin' || pathname === '/admin/'
        ? 'index.html'
        : pathname.replace(/^\/admin\//, '');
    var filePath = path.normalize(path.join(ADMIN_DIR, relative));
    if (filePath.indexOf(ADMIN_DIR) !== 0) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }
    fs.stat(filePath, function(err, stats) {
        if (err || !stats.isFile()) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }
        var ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(response);
    });
}

function listOpenAiModels(apiKey) {
    if (!apiKey) {
        return Promise.resolve(mergeCatalog([], OPENAI_MODEL_SUGGESTIONS, 'Showing common OpenAI models (add a key, then Refresh for your full account list)'));
    }
    return fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: 'Bearer ' + apiKey }
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                throw new Error((body.error && body.error.message) || res.statusText);
            }
            var models = (body.data || [])
                .map(function(m) { return m.id; })
                .filter(function(id) {
                    return /^(gpt-|o[0-9]|chatgpt-)/i.test(id);
                });
            return mergeCatalog(models, OPENAI_MODEL_SUGGESTIONS, 'Live OpenAI models + frontier favorites');
        });
    }).catch(function(err) {
        return mergeCatalog([], OPENAI_MODEL_SUGGESTIONS, 'Using common OpenAI models (' + String(err.message || err) + ')');
    });
}

function listOllamaModels(baseUrl, apiKey, curated, timeoutMs) {
    var root = (baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    var headers = {};
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (apiKey) {
        headers.Authorization = 'Bearer ' + apiKey;
    }
    if (controller && timeoutMs) {
        timer = setTimeout(function() { controller.abort(); }, timeoutMs);
    }
    return fetch(root + '/api/tags', {
        headers: headers,
        signal: controller ? controller.signal : undefined
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                throw new Error((body && body.error) || res.statusText);
            }
            var models = (body.models || []).map(function(m) {
                return m.name || m.model;
            }).filter(Boolean);
            return mergeCatalog(models, curated, 'Installed/available models + common suggestions');
        });
    }).catch(function(err) {
        return mergeCatalog([], curated, 'Using common Ollama model ids (' + String(err.message || err) + ')');
    }).then(function(result) {
        if (timer) {
            clearTimeout(timer);
        }
        return result;
    });
}

function listModels(config) {
    var provider = (config.ai_provider || 'openai').toLowerCase();
    if (provider === 'openai') {
        return listOpenAiModels(config.openai_api_key || process.env.OPENAI_API_KEY);
    }
    if (provider === 'anthropic') {
        var msg = (config.anthropic_api_key || process.env.ANTHROPIC_API_KEY)
            ? 'Anthropic model catalog'
            : 'Showing Anthropic models (set key to use them)';
        return Promise.resolve(mergeCatalog([], ANTHROPIC_MODEL_SUGGESTIONS, msg));
    }
    if (provider === 'ollama-cloud') {
        // ollama.com /api/tags is not a reliable public catalog — ship curated cloud tags.
        return Promise.resolve(mergeCatalog([], OLLAMA_CLOUD_MODEL_SUGGESTIONS,
            'Ollama Cloud frontiers (glm-5.3, deepseek-v4, kimi, gemma4, …)'));
    }
    if (provider === 'ollama') {
        return listOllamaModels(
            config.ollama_base_url || 'http://127.0.0.1:11434',
            config.ollama_api_key || process.env.OLLAMA_API_KEY,
            OLLAMA_MODEL_SUGGESTIONS,
            2500
        );
    }
    return Promise.resolve({ models: [], message: 'Unknown provider' });
}

/**
 * @param {object} ctx
 * @param {object} ctx.config live config object (mutated on save)
 * @param {object} ctx.aiRouter
 * @param {function} [ctx.onReload]
 */
function createAdminHandler(ctx) {
    return function handleAdmin(req, response, pathname) {
        var parsedUrl = url.parse(req.url, true);
        var isApi = pathname.indexOf('/api/admin/') === 0;
        var allowed = isAdminRequest(req, ctx.config);

        // Public, secrets-free status for the in-game HUD indicator.
        if (pathname === '/api/ai-status' && req.method === 'GET') {
            sendJson(response, 200, { ai_enabled: !!ctx.config.ai_enabled });
            return true;
        }

        if (pathname === '/admin' || pathname === '/admin/' || pathname.indexOf('/admin/') === 0) {
            // Static admin UI is safe to serve; APIs enforce auth.
            // Remote users without a token can still open the page and enter one.
            serveAdminStatic(pathname, response);
            return true;
        }

        if (!isApi) {
            return false;
        }

        if (!allowed) {
            sendJson(response, 403, {
                error: 'Forbidden',
                message: 'Admin access requires localhost or a valid ADMIN_TOKEN',
                localhost: isLoopbackAddress(getClientAddress(req)),
                admin_token_required: true
            });
            return true;
        }

        if (pathname === '/api/admin/ai' && req.method === 'GET') {
            sendJson(response, 200, aiSettings.publicStatus(ctx.config));
            return true;
        }

        if (pathname === '/api/admin/ai' && req.method === 'POST') {
            readBody(req).then(function(body) {
                var result = aiSettings.applyAiSettings(ctx.config, body || {}, aiSettings.loadSecrets());
                ctx.config = result.config;
                if (ctx.aiRouter && typeof ctx.aiRouter.updateConfig === 'function') {
                    ctx.aiRouter.updateConfig(ctx.config);
                }
                if (typeof ctx.onReload === 'function') {
                    ctx.onReload(ctx.config);
                }
                sendJson(response, 200, {
                    ok: true,
                    status: aiSettings.publicStatus(ctx.config, result.secrets)
                });
            }).catch(function(err) {
                sendJson(response, 400, { error: String(err.message || err) });
            });
            return true;
        }

        if (pathname === '/api/admin/ai/models' && req.method === 'GET') {
            var providerOverride = parsedUrl.query && parsedUrl.query.provider;
            var modelConfig = Object.assign({}, ctx.config);
            if (providerOverride) {
                modelConfig.ai_provider = String(providerOverride);
            }
            listModels(modelConfig).then(function(result) {
                sendJson(response, 200, result);
            });
            return true;
        }

        if (pathname === '/api/admin/session' && req.method === 'GET') {
            sendJson(response, 200, {
                authorized: true,
                localhost: isLoopbackAddress(getClientAddress(req))
            });
            return true;
        }

        sendJson(response, 404, { error: 'Not found' });
        return true;
    };
}

module.exports = {
    createAdminHandler: createAdminHandler,
    isAdminRequest: isAdminRequest,
    isLoopbackAddress: isLoopbackAddress
};
