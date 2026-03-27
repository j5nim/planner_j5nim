// pages/tasklist.js
// Task list page. Displays, filters, and manages all tasks.

import { getTasks, toggleTask, deleteTask, clearDoneTasks } from '../utils/storage.js';

// Active filter state
const filter = { importance: 'all', urgency: 'all' };

/**
 * Renders the task list page into the given container element.
 * @param {HTMLElement} container
 */
export function render(container) {
  container.innerHTML = `
    <section class="tasklist">

      <div class="tasklist-toolbar">
        <div class="filter-group">
          <span class="filter-label">중요도</span>
          <div class="filter-chips" data-filter="importance">
            <button class="chip active" data-value="all">전체</button>
            <button class="chip" data-value="높음">🔴 높음</button>
            <button class="chip" data-value="보통">🟡 보통</button>
            <button class="chip" data-value="낮음">🔵 낮음</button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">긴박도</span>
          <div class="filter-chips" data-filter="urgency">
            <button class="chip active" data-value="all">전체</button>
            <button class="chip" data-value="오늘">오늘</button>
            <button class="chip" data-value="이번주">이번주</button>
            <button class="chip" data-value="나중에">나중에</button>
          </div>
        </div>

        <button class="clear-done-btn" id="clearDoneBtn">완료 항목 삭제</button>
      </div>

      <div class="tasklist-summary" id="taskSummary"></div>

      <ul class="task-list" id="taskList"></ul>

      <div class="task-empty" id="taskEmpty" hidden>
        <p>조건에 맞는 할 일이 없어요.</p>
      </div>

    </section>
  `;

  bindEvents();
  renderList();
}

// ─── Events ───────────────────────────────────────────────────────

function bindEvents() {
  // Filter chips
  document.querySelectorAll('.filter-chips').forEach(group => {
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      const key = group.dataset.filter;
      const val = chip.dataset.value;

      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      filter[key] = val;
      renderList();
    });
  });

  // Clear done
  document.getElementById('clearDoneBtn').addEventListener('click', () => {
    clearDoneTasks();
    renderList();
  });
}

// ─── Render ────────────────────────────────────────────────────────

function getFiltered() {
  return getTasks().filter(task => {
    const impMatch = filter.importance === 'all' || task.importance === filter.importance;
    const urgMatch = filter.urgency    === 'all' || task.urgency    === filter.urgency;
    return impMatch && urgMatch;
  });
}

function renderList() {
  const tasks    = getFiltered();
  const all      = getTasks();
  const listEl   = document.getElementById('taskList');
  const emptyEl  = document.getElementById('taskEmpty');
  const summaryEl = document.getElementById('taskSummary');

  // Summary
  const total = all.length;
  const done  = all.filter(t => t.done).length;
  summaryEl.textContent = `전체 ${total}개 · 완료 ${done}개`;

  if (tasks.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = tasks.map(task => buildTaskItem(task)).join('');

  // Per-item events
  listEl.querySelectorAll('.task-item').forEach(item => {
    const id = item.dataset.id;

    item.querySelector('.task-check').addEventListener('click', () => {
      toggleTask(id);
      renderList();
    });

    item.querySelector('.task-delete').addEventListener('click', () => {
      deleteTask(id);
      renderList();
    });
  });
}

// ─── Item builder ──────────────────────────────────────────────────

const IMP_BADGE  = { '높음': '🔴 높음', '보통': '🟡 보통', '낮음': '🔵 낮음' };
const URG_BADGE  = { '오늘': '오늘', '이번주': '이번주', '나중에': '나중에' };

function buildTaskItem(task) {
  const doneClass    = task.done ? 'done' : '';
  const checkedAttr  = task.done ? 'checked' : '';
  const deadlineHtml = task.deadline
    ? `<span class="meta-badge deadline">📅 ${escapeHtml(task.deadline)}</span>`
    : '';

  return `
    <li class="task-item ${doneClass}" data-id="${escapeHtml(task.id)}">
      <button class="task-check" aria-label="완료 토글" ${checkedAttr}>
        <span class="check-icon">${task.done ? '✓' : ''}</span>
      </button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="meta-badge importance">${IMP_BADGE[task.importance] ?? task.importance}</span>
          <span class="meta-badge urgency">${URG_BADGE[task.urgency] ?? task.urgency}</span>
          ${deadlineHtml}
        </div>
      </div>
      <button class="task-delete" aria-label="삭제">✕</button>
    </li>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
