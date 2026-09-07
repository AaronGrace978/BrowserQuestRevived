(function () {
  var TOKEN_KEY = 'bq_admin_token';

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

  function fillForm(status) {
    $('ai_enabled').checked = !!status.ai_enabled;
    $('ai_provider').value = status.ai_provider || 'openai';
    $('ai_model').value = status.ai_model || '';
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
    $('models-message').textContent = 'Loading models…';
    return api('/api/admin/ai/models').then(function (result) {
      var list = $('model-list');
      list.innerHTML = '';
      if (!result.ok) {
        $('models-message').textContent = (result.body && result.body.message) || 'Could not load models';
        return;
      }
      (result.body.models || []).forEach(function (id) {
        var opt = document.createElement('option');
        opt.value = id;
        list.appendChild(opt);
      });
      $('models-message').textContent = result.body.message ||
        ((result.body.models || []).length + ' models available — type or pick one');
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
    loadModels();
  });

  $('ai-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var statusEl = $('form-status');
    statusEl.className = 'status';
    statusEl.textContent = 'Saving…';

    var body = {
      ai_enabled: $('ai_enabled').checked,
      ai_provider: $('ai_provider').value,
      ai_model: $('ai_model').value.trim(),
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
