// pages/home.js
// Home page. Natural language task input and AI parsing via Claude API.

import { getGreeting } from '../utils/greeting.js';
import { parseTasks, hasApiKey, setApiKey, ApiKeyMissingError } from '../utils/api.js';

/**
 * Renders the home page into the given container element.
 * @param {HTMLElement} container
 */
export function render(container) {
  container.innerHTML = `
    <section class="home">
      <div class="home-greeting" id="homeGreeting"></div>

      ${!hasApiKey() ? `
      <div class="api-key-banner" id="apiKeyBanner">
        <p>Claude API 키를 입력해야 AI 기능을 사용할 수 있어요.</p>
        <div class="api-key-row">
          <input
            type="password"
            id="apiKeyInput"
            class="api-key-input"
            placeholder="sk-ant-..."
            autocomplete="off"
          />
          <button class="api-key-save-btn" id="apiKeySave">저장</button>
        </div>
      </div>` : ''}

      <div class="home-input-area">
        <label class="input-label" for="taskInput">오늘 할 일을 자유롭게 입력해보세요.</label>
        <div class="input-wrapper">
          <textarea
            id="taskInput"
            class="task-input"
            placeholder="예) 오전 중에 보고서 초안 쓰고, 점심 전에 팀 미팅 준비하기"
            rows="4"
            autocomplete="off"
            spellcheck="false"
          ></textarea>
          <button class="submit-btn" id="submitTask" aria-label="Submit task">
            <span class="submit-icon">↑</span>
          </button>
        </div>
        <p class="input-hint">Ctrl+Enter 또는 버튼을 눌러 AI에게 전달해요.</p>
      </div>

      <div class="home-result" id="homeResult" hidden>
        <div class="result-header">AI가 정리한 할 일</div>
        <ul class="result-list" id="resultList"></ul>
      </div>

      <div class="home-error" id="homeError" hidden></div>
    </section>
  `;

  document.getElementById('homeGreeting').textContent = getGreeting();

  bindEvents();
}

// ─── Events ───────────────────────────────────────────────────────

function bindEvents() {
  const textarea  = document.getElementById('taskInput');
  const submitBtn = document.getElementById('submitTask');
  const apiKeySaveBtn = document.getElementById('apiKeySave');

  submitBtn.addEventListener('click', handleSubmit);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  });

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  if (apiKeySaveBtn) {
    apiKeySaveBtn.addEventListener('click', () => {
      const val = document.getElementById('apiKeyInput').value.trim();
      if (!val) return;
      setApiKey(val);
      document.getElementById('apiKeyBanner').remove();
    });
  }
}

// ─── Submit ────────────────────────────────────────────────────────

async function handleSubmit() {
  const textarea  = document.getElementById('taskInput');
  const submitBtn = document.getElementById('submitTask');
  const input     = textarea.value.trim();
  if (!input) return;

  setLoading(true);
  clearError();

  try {
    const tasks = await parseTasks(input);
    renderResults(tasks);
    textarea.value = '';
    textarea.style.height = 'auto';
  } catch (err) {
    if (err instanceof ApiKeyMissingError) {
      showError('API 키가 없어요. 위에서 먼저 저장해주세요.');
    } else {
      showError(err.message);
    }
  } finally {
    setLoading(false);
  }
}

// ─── Result rendering ──────────────────────────────────────────────

const IMPORTANCE_LABEL = { '높음': '🔴 높음', '보통': '🟡 보통', '낮음': '🔵 낮음' };
const URGENCY_LABEL    = { '오늘': '오늘', '이번주': '이번주', '나중에': '나중에' };

function renderResults(tasks) {
  const resultSection = document.getElementById('homeResult');
  const resultList    = document.getElementById('resultList');

  resultList.innerHTML = tasks.map(task => `
    <li class="result-item">
      <div class="result-item-title">${escapeHtml(task.title)}</div>
      <div class="result-item-meta">
        <span class="meta-badge importance">${IMPORTANCE_LABEL[task.importance] ?? task.importance}</span>
        <span class="meta-badge urgency">${URGENCY_LABEL[task.urgency] ?? task.urgency}</span>
        ${task.deadline ? `<span class="meta-badge deadline">📅 ${escapeHtml(task.deadline)}</span>` : ''}
      </div>
    </li>
  `).join('');

  resultSection.hidden = false;
}

// ─── UI helpers ────────────────────────────────────────────────────

function setLoading(on) {
  const btn = document.getElementById('submitTask');
  if (!btn) return;
  btn.disabled   = on;
  btn.innerHTML  = on
    ? '<span class="submit-spinner"></span>'
    : '<span class="submit-icon">↑</span>';
}

function showError(msg) {
  const el = document.getElementById('homeError');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('homeError');
  if (el) el.hidden = true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
