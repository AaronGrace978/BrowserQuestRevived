var Utils = require('../utils');
var scripts = require('./scripts');
var openai = require('./providers/openai');
var anthropic = require('./providers/anthropic');
var ollama = require('./providers/ollama');

var MAX_REPLY_CHARS = 180;
var MAX_HISTORY_TURNS = 6;

function AiRouter(config) {
    this.config = config || {};
}

AiRouter.prototype.updateConfig = function(config) {
    this.config = config || {};
};

AiRouter.prototype.isEnabled = function() {
    return !!this.config.ai_enabled;
};

AiRouter.prototype._providerName = function() {
    return (this.config.ai_provider || process.env.AI_PROVIDER || 'openai').toLowerCase();
};

AiRouter.prototype._model = function() {
    return this.config.ai_model || process.env.AI_MODEL || '';
};

AiRouter.prototype.truncate = function(text) {
    var cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= MAX_REPLY_CHARS) {
        return cleaned;
    }
    return cleaned.substring(0, MAX_REPLY_CHARS - 1).trim() + '…';
};

AiRouter.prototype.sanitizeReply = function(text) {
    return Utils.sanitize(this.truncate(text));
};

AiRouter.prototype.buildMessages = function(kindName, history, userText) {
    var persona = scripts.getPersona(kindName);
    var system = persona.system;
    if (persona.greeting_hint) {
        system += ' Tone hint: ' + persona.greeting_hint;
    }

    var messages = [{ role: 'system', content: system }];
    (history || []).forEach(function(turn) {
        messages.push({ role: turn.role, content: turn.content });
    });

    var content = userText && String(userText).trim()
        ? String(userText).trim()
        : (persona.greeting_hint || 'The adventurer greets you. Respond in character.');
    messages.push({ role: 'user', content: content });
    return messages;
};

AiRouter.prototype.generate = function(kindName, history, userText) {
    var self = this;
    if (!this.isEnabled()) {
        return Promise.reject(new Error('AI is disabled'));
    }

    var provider = this._providerName();
    var model = this._model();
    if (!model) {
        return Promise.reject(new Error('AI_MODEL is not set'));
    }

    var messages = this.buildMessages(kindName, history, userText);
    var timeoutMs = this.config.ai_timeout_ms || 12000;
    var promise;

    if (provider === 'openai') {
        promise = openai.chatCompletion({
            apiKey: process.env.OPENAI_API_KEY || this.config.openai_api_key,
            model: model,
            messages: messages,
            timeoutMs: timeoutMs
        });
    } else if (provider === 'anthropic') {
        promise = anthropic.chatCompletion({
            apiKey: process.env.ANTHROPIC_API_KEY || this.config.anthropic_api_key,
            model: model,
            messages: messages,
            timeoutMs: timeoutMs
        });
    } else if (provider === 'ollama-cloud') {
        promise = ollama.chatCompletion({
            baseUrl: this.config.ollama_cloud_base_url || process.env.OLLAMA_CLOUD_BASE_URL || 'https://ollama.com',
            apiKey: process.env.OLLAMA_API_KEY || this.config.ollama_api_key,
            model: model,
            messages: messages,
            timeoutMs: timeoutMs
        });
    } else if (provider === 'ollama') {
        promise = ollama.chatCompletion({
            baseUrl: this.config.ollama_base_url || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
            apiKey: process.env.OLLAMA_API_KEY || this.config.ollama_api_key,
            model: model,
            messages: messages,
            timeoutMs: timeoutMs
        });
    } else {
        return Promise.reject(new Error('Unknown AI_PROVIDER: ' + provider));
    }

    return promise.then(function(text) {
        return self.sanitizeReply(text);
    });
};

AiRouter.MAX_HISTORY_TURNS = MAX_HISTORY_TURNS;

module.exports = AiRouter;
