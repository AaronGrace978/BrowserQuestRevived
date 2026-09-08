var DEFAULT_TIMEOUT_MS = 20000;
// Thinking cloud models (glm, qwen, gpt-oss, …) spend many tokens on
// message.thinking before writing message.content. A low num_predict leaves
// content empty and NPC chat looks broken.
var DEFAULT_NUM_PREDICT = 800;

function toOllamaMessages(messages) {
    return messages.map(function(msg) {
        return {
            role: msg.role,
            content: msg.content
        };
    });
}

/**
 * Direct https://ollama.com API expects plain names (glm-5.3).
 * The :cloud / -cloud suffix is only for talking to a local Ollama daemon
 * that then proxies to the cloud.
 */
function normalizeModelForHost(baseUrl, model) {
    var name = String(model || '').trim();
    var host = String(baseUrl || '').toLowerCase();
    if (host.indexOf('ollama.com') !== -1) {
        name = name.replace(/:cloud$/i, '').replace(/-cloud$/i, '');
    }
    return name;
}

function chatCompletion(options) {
    var baseUrl = (options.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    var apiKey = options.apiKey;
    var model = normalizeModelForHost(baseUrl, options.model);
    var messages = options.messages;
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    var numPredict = options.numPredict || DEFAULT_NUM_PREDICT;

    if (!model) {
        return Promise.reject(new Error('Ollama model id is empty'));
    }

    var headers = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers.Authorization = 'Bearer ' + apiKey;
    }

    var controller = new AbortController();
    var timer = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    return fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: toOllamaMessages(messages),
            stream: false,
            options: {
                temperature: 0.8,
                num_predict: numPredict
            }
        }),
        signal: controller.signal
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                var errMsg = (body && (body.error || body.message)) || res.statusText;
                throw new Error('Ollama error: ' + errMsg + ' (model=' + model + ')');
            }
            var text = body.message && body.message.content;
            if (text && String(text).trim()) {
                return String(text).trim();
            }
            var thinking = body.message && body.message.thinking;
            if (thinking) {
                throw new Error(
                    'Ollama model ' + model + ' returned only thinking (no reply). ' +
                    'Try glm-5.3-flash:cloud or gemma4:cloud, or raise ai_timeout_ms.'
                );
            }
            throw new Error('Ollama returned empty content (model=' + model + ')');
        });
    }).finally(function() {
        clearTimeout(timer);
    });
}

module.exports = {
    chatCompletion: chatCompletion,
    normalizeModelForHost: normalizeModelForHost
};
