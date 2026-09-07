var DEFAULT_TIMEOUT_MS = 12000;

function chatCompletion(options) {
    var apiKey = options.apiKey;
    var model = options.model;
    var messages = options.messages;
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (!apiKey) {
        return Promise.reject(new Error('ANTHROPIC_API_KEY is not set'));
    }

    var systemParts = [];
    var anthropicMessages = [];
    messages.forEach(function(msg) {
        if (msg.role === 'system') {
            systemParts.push(msg.content);
        } else {
            anthropicMessages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        }
    });

    if (anthropicMessages.length === 0) {
        anthropicMessages.push({ role: 'user', content: 'Hello' });
    }

    var controller = new AbortController();
    var timer = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 120,
            temperature: 0.8,
            system: systemParts.join('\n\n'),
            messages: anthropicMessages
        }),
        signal: controller.signal
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                var errMsg = (body && body.error && body.error.message) || res.statusText;
                throw new Error('Anthropic error: ' + errMsg);
            }
            var block = body.content && body.content[0];
            var text = block && block.text;
            if (!text) {
                throw new Error('Anthropic returned empty content');
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
