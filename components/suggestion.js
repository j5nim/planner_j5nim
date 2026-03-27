// components/suggestion.js
// AI next-step suggestion panel. Requests and renders Claude's recommendations.
//
// Usage (call once from app.js):
//   import { initSuggestion, refreshSuggestion } from './components/suggestion.js';
//   initSuggestion();

import { suggestNextTask, hasApiKey, ApiKeyMissingError } from '../utils/api.js';
import { getTasks, addTask } from '../utils/storage.js';

// ─── State ─────────────────────────────────────────────────────────

let currentSuggestion = null;    // { title, deadline, importance, urgency, reason }
let cardEl            = null;
let dismissedTitles   = new Set(); // avoid re-showing the same suggestion in a session

// ─── Public API ────────────────────────────────────────────────────

/**
 * Mounts the suggestion card to document.body.
 * Safe to call multiple times — only mounts once.
 */
export function initSuggestion() {
  if (document.getElementById('suggestionCard')) return;

  cardEl = document.createElement('div');
  cardEl.id        = 'suggestionCard';
  cardEl.className = 'suggestion-card';
  cardEl.setAttribute('data-state', 'hidden');
  cardEl.innerHTML = buildCardHTML();
  document.body.appendChild(cardEl);

  bindCardEvents();

  // Auto-fetch on init after a short delay
  if (hasApiKey()) {
    setTimeout(() => fetchSuggestion(), 1200);
  }
}

/**
 * Triggers a fresh suggestion fetch.
 * Can be called after tasks are added or changed.
 */
export function refreshSuggestion() {
  if (!hasApiKey()) return;
  fetchSuggestion();
}

// ─── Card HTML ─────────────────────────────────────────────────────

function buildCardHTML() {
  return `
    <div class="sug-header">
      <span class="sug-icon">💡</span>
      <span class="sug-label">다음 단계 제안</span>
      <button class="sug-refresh-btn" id="sugRefresh" aria-label="새로 분석">↻</button>
    </div>

    <div class="sug-loading" id="sugLoading" hidden>
      <span class="sug-spinner"></span>
      <span>할 일을 분석하고 있어요...</span>
    </div>

    <div class="sug-content" id="sugContent" hidden>
      <p class="sug-title"    id="sugTitle"></p>
      <p class="sug-reason"   id="sugReason"></p>
      <div class="sug-meta"   id="sugMeta"></div>

      <!-- Default action buttons -->
      <div class="sug-actions" id="sugActions">
        <button class="sug-btn sug-btn--primary"   id="sugBtnAdd">바로 추가</button>
        <button class="sug-btn sug-btn--secondary" id="sugBtnEdit">수정 후 추가</button>
        <button class="sug-btn sug-btn--ghost"     id="sugBtnDismiss">괜찮아요</button>
      </div>

      <!-- Edit mode -->
      <div class="sug-edit-mode" id="sugEditMode" hidden>
        <input class="sug-edit-input" id="sugEditInput" type="text" />
        <div class="sug-edit-actions">
          <button class="sug-btn sug-btn--primary" id="sugBtnConfirm">추가 확인</button>
          <button class="sug-btn sug-btn--ghost"   id="sugBtnCancel">취소</button>
        </div>
      </div>
    </div>

    <div class="sug-empty" id="sugEmpty" hidden>
      <span>지금은 제안할 다음 단계가 없어요.</span>
    </div>
  `;
}

// ─── Events ────────────────────────────────────────────────────────

function bindCardEvents() {
  cardEl.querySelector('#sugRefresh').addEventListener('click', fetchSuggestion);

  cardEl.querySelector('#sugBtnAdd').addEventListener('click', handleAdd);

  cardEl.querySelector('#sugBtnEdit').addEventListener('click', () => {
    enterEditMode();
  });

  cardEl.querySelector('#sugBtnDismiss').addEventListener('click', () => {
    if (currentSuggestion) dismissedTitles.add(currentSuggestion.title);
    hide();
  });

  cardEl.querySelector('#sugBtnConfirm').addEventListener('click', handleEditConfirm);

  cardEl.querySelector('#sugBtnCancel').addEventListener('click', exitEditMode);
}

// ─── Fetch ─────────────────────────────────────────────────────────

async function fetchSuggestion() {
  if (!hasApiKey()) return;

  const tasks = getTasks();
  exitEditMode();
  setState('loading');

  try {
    const suggestion = await suggestNextTask(tasks);

    if (!suggestion || dismissedTitles.has(suggestion.title)) {
      setState('empty');
      return;
    }

    currentSuggestion = suggestion;
    renderSuggestion(suggestion);
    setState('content');
  } catch (err) {
    if (err instanceof ApiKeyMissingError) {
      hide();
    } else {
      setState('empty');
      console.warn('[suggestion] fetch failed:', err.message);
    }
  }
}

// ─── Render suggestion ─────────────────────────────────────────────

const IMP_LABEL = { '높음': '🔴 높음', '보통': '🟡 보통', '낮음': '🔵 낮음' };
const URG_LABEL = { '오늘': '오늘', '이번주': '이번주', '나중에': '나중에' };

function renderSuggestion(s) {
  cardEl.querySelector('#sugTitle').textContent  = s.title;
  cardEl.querySelector('#sugReason').textContent = s.reason ?? '';

  const imp      = IMP_LABEL[s.importance] ?? s.importance;
  const urg      = URG_LABEL[s.urgency]    ?? s.urgency;
  const deadline = s.deadline ? `📅 ${s.deadline}` : '';

  cardEl.querySelector('#sugMeta').innerHTML = [imp, urg, deadline]
    .filter(Boolean)
    .map(t => `<span class="meta-badge">${escapeHtml(t)}</span>`)
    .join('');
}

// ─── Actions ───────────────────────────────────────────────────────

function handleAdd() {
  if (!currentSuggestion) return;
  addTask(currentSuggestion);
  showConfirmedState();
}

function enterEditMode() {
  if (!currentSuggestion) return;
  const input = cardEl.querySelector('#sugEditInput');
  input.value = currentSuggestion.title;
  cardEl.querySelector('#sugActions').hidden  = true;
  cardEl.querySelector('#sugEditMode').hidden = false;
  input.focus();
  input.select();
}

function exitEditMode() {
  cardEl.querySelector('#sugActions').hidden  = false;
  cardEl.querySelector('#sugEditMode').hidden = true;
}

function handleEditConfirm() {
  if (!currentSuggestion) return;
  const input    = cardEl.querySelector('#sugEditInput');
  const newTitle = input.value.trim();
  if (!newTitle) return;

  addTask({ ...currentSuggestion, title: newTitle });
  showConfirmedState();
}

// ─── UI states ─────────────────────────────────────────────────────

/**
 * @param {'hidden'|'loading'|'content'|'empty'} state
 */
function setState(state) {
  if (!cardEl) return;
  cardEl.setAttribute('data-state', state);

  const show = id => { const el = cardEl.querySelector(id); if (el) el.hidden = false; };
  const hide = id => { const el = cardEl.querySelector(id); if (el) el.hidden = true;  };

  hide('#sugLoading');
  hide('#sugContent');
  hide('#sugEmpty');

  if (state === 'loading') { show('#sugLoading'); }
  if (state === 'content') { show('#sugContent'); }
  if (state === 'empty')   { show('#sugEmpty');   }
}

function showConfirmedState() {
  if (!cardEl) return;
  const content = cardEl.querySelector('#sugContent');
  if (!content) return;

  exitEditMode();
  content.innerHTML = `<p class="sug-confirmed">✓ 할 일에 추가됐어요!</p>`;

  if (currentSuggestion) dismissedTitles.add(currentSuggestion.title);
  currentSuggestion = null;

  setTimeout(() => hide(), 2000);
}

function hide() {
  if (cardEl) cardEl.setAttribute('data-state', 'hidden');
}

// ─── Util ──────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
