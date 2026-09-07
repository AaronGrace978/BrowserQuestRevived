var DEFAULT_TIMEOUT_MS = 12000;

function toOllamaMessages(messages) {
    return messages.map(function(msg) {
        return {
            role: msg.role,
            content: msg.content
        };
    });
}

function chatCompletion(options) {
    var baseUrl = (options.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
    var apiKey = options.apiKey;
    var model = options.model;
    var messages = options.messages;
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

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
                num_predict: 120
            }
        }),
        signal: controller.signal
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                var errMsg = (body && (body.error || body.message)) || res.statusText;
                throw new Error('Ollama error: ' + errMsg);
            }
            var text = body.message && body.message.content;
            if (!text) {
                throw new Error('Ollama returned empty content');
            }
            return text;
        });
    }).finally(function() {
        clearTimeout(timer);
    });
}

module.exports = {
    chatCompletion: chatCompletion
};
