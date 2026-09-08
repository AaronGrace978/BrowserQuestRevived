(function () {
  var TOKEN_KEY = 'bq_admin_token';
  var currentModel = '';

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    return headers;
  }

  function api(path, options) {
    options = options || {};
    return fetch(path, {
      method: options.method || 'GET',
      headers: authHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().then(function (body) {
        return { ok: res.ok, status: res.status, body: body };
      });
    });
  }

  function setKeyHint(id, isSet) {
    $(id).textContent = isSet ? 'Key is set on server' : 'No key stored';
  }

  function selectedModel() {
    var custom = ($('ai_model_custom').value || '').trim();
    if (custom) {
      return custom;
    }
    return $('ai_model').value || '';
  }

  function fillModelDropdown(models, preferred) {
    var select = $('ai_model');
    var list = models || [];
    select.innerHTML = '';

    if (list.length === 0) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No models yet — refresh or type a custom id';
      select.appendChild(empty);
      return;
    }

    if (preferred && list.indexOf(preferred) === -1) {
      list = [preferred].concat(list);
    }

    list.forEach(function (id) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      select.appendChild(opt);
    });

    if (preferred) {
      select.value = preferred;
    }
  }

  function fillForm(status) {
    currentModel = status.ai_model || '';
    $('ai_enabled').checked = !!status.ai_enabled;
    $('ai_provider').value = status.ai_provider || 'openai';
    $('ai_model_custom').value = '';
    $('ai_timeout_ms').value = status.ai_timeout_ms || 12000;
    $('ollama_base_url').value = status.ollama_base_url || '';
    $('ollama_cloud_base_url').value = status.ollama_cloud_base_url || '';
    setKeyHint('openai_api_key_set', status.openai_api_key_set);
    setKeyHint('anthropic_api_key_set', status.anthropic_api_key_set);
    setKeyHint('ollama_api_key_set', status.ollama_api_key_set);
    setKeyHint('admin_token_set', status.admin_token_set);
  }

  function showGate(show) {
    $('token-gate').classList.toggle('hidden', !show);
    $('ai-form').classList.toggle('hidden', show);
  }

  function loadModels() {
    var provider = $('ai_provider').value || 'openai';
    $('models-message').textContent = 'Loading models…';
    return api('/api/admin/ai/models?provider=' + encodeURIComponent(provider)).then(function (result) {
      if (!result.ok) {
        fillModelDropdown([], currentModel);
        $('models-message').textContent = (result.body && result.body.message) || 'Could not load models';
        return;
      }
      fillModelDropdown(result.body.models || [], currentModel || selectedModel());
      $('models-message').textContent = result.body.message ||
        ((result.body.models || []).length + ' models in dropdown');
    });
  }

  function loadStatus() {
    return api('/api/admin/ai').then(function (result) {
      if (result.status === 403) {
        showGate(true);
        $('token-error').textContent = (result.body && result.body.message) || 'Token required';
        return false;
      }
      if (!result.ok) {
        showGate(true);
        $('token-error').textContent = 'Failed to load settings';
        return false;
      }
      showGate(false);
      fillForm(result.body);
      loadModels();
      return true;
    });
  }

  $('token-save').addEventListener('click', function () {
    var token = $('token-input').value.trim();
    setToken(token);
    $('token-error').textContent = '';
    loadStatus();
  });

  $('refresh-models').addEventListener('click', function () {
    loadModels();
  });

  $('ai_provider').addEventListener('change', function () {
    currentModel = '';
    $('ai_model_custom').value = '';
    loadModels();
  });

  $('ai_model').addEventListener('change', function () {
    currentModel = $('ai_model').value;
    // Dropdown is primary — clear override so password managers / old values
    // cannot silently replace the selected model.
    $('ai_model_custom').value = '';
  });

  $('ai-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var statusEl = $('form-status');
    statusEl.className = 'status';
    statusEl.textContent = 'Saving…';

    var model = selectedModel();
    if (!model) {
      statusEl.className = 'status err';
      statusEl.textContent = 'Pick a model from the dropdown or enter a custom model id.';
      return;
    }
    // Autofill sometimes dumps API keys into the custom model field — reject those.
    if (/^[a-f0-9]{20,}\.[A-Za-z0-9_-]{16,}$/i.test(model) || model.length > 80) {
      statusEl.className = 'status err';
      statusEl.textContent = 'That looks like an API key, not a model id. Put keys in the key fields; pick e.g. glm-5.3:cloud for the model.';
      return;
    }

    var body = {
      ai_enabled: $('ai_enabled').checked,
      ai_provider: $('ai_provider').value,
      ai_model: model,
      ai_timeout_ms: parseInt($('ai_timeout_ms').value, 10) || 12000,
      ollama_base_url: $('ollama_base_url').value.trim(),
      ollama_cloud_base_url: $('ollama_cloud_base_url').value.trim(),
      openai_api_key: $('openai_api_key').value,
      anthropic_api_key: $('anthropic_api_key').value,
      ollama_api_key: $('ollama_api_key').value,
      admin_token: $('admin_token').value,
      clear_openai_api_key: $('clear_openai_api_key').checked,
      clear_anthropic_api_key: $('clear_anthropic_api_key').checked,
      clear_ollama_api_key: $('clear_ollama_api_key').checked,
      clear_admin_token: $('clear_admin_token').checked
    };

    api('/api/admin/ai', { method: 'POST', body: body }).then(function (result) {
      if (!result.ok) {
        statusEl.className = 'status err';
        statusEl.textContent = (result.body && (result.body.error || result.body.message)) || 'Save failed';
        if (result.status === 403) {
          showGate(true);
        }
        return;
      }
      statusEl.className = 'status ok';
      statusEl.textContent = 'Saved. AI settings are live (no restart needed).';
      $('openai_api_key').value = '';
      $('anthropic_api_key').value = '';
      $('ollama_api_key').value = '';
      $('admin_token').value = '';
      $('clear_openai_api_key').checked = false;
      $('clear_anthropic_api_key').checked = false;
      $('clear_ollama_api_key').checked = false;
      $('clear_admin_token').checked = false;
      fillForm(result.body.status);
      loadModels();
    }).catch(function (err) {
      statusEl.className = 'status err';
      statusEl.textContent = String(err.message || err);
    });
  });

  loadStatus();
})();
