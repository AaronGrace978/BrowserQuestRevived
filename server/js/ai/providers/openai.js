var DEFAULT_TIMEOUT_MS = 12000;

function chatCompletion(options) {
    var apiKey = options.apiKey;
    var model = options.model;
    var messages = options.messages;
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (!apiKey) {
        return Promise.reject(new Error('OPENAI_API_KEY is not set'));
    }

    var controller = new AbortController();
    var timer = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 120,
            temperature: 0.8
        }),
        signal: controller.signal
    }).then(function(res) {
        return res.json().then(function(body) {
            if (!res.ok) {
                var errMsg = (body && body.error && body.error.message) || res.statusText;
                throw new Error('OpenAI error: ' + errMsg);
            }
            var text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
            if (!text) {
                throw new Error('OpenAI returned empty content');
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
