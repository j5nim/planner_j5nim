// pages/timetable.js
// Timetable page. Matrix grid: rows = hours (06:00~06:00), columns = 10-min slots.

import { getTasks } from '../utils/storage.js';

const SLOT_COUNT = 144; // 24h × 6 slots (10 min each), starting at 06:00
const BLOCKS_KEY = 'planner_timetable_blocks';
const COLORS = [
  { hex: '#FFE066', label: '노랑' },
  { hex: '#FF6B6B', label: '빨강' },
  { hex: '#69DB7C', label: '초록' },
  { hex: '#74C0FC', label: '파랑' },
  { hex: '#DA77F2', label: '보라' },
  { hex: '#FFA94D', label: '주황' },
  { hex: '#F783AC', label: '분홍' },
];

// ─── Storage ───────────────────────────────────────────────────────

function loadBlocks() {
  try { return JSON.parse(localStorage.getItem(BLOCKS_KEY) || '[]'); }
  catch { return []; }
}

function persistBlocks(blocks) {
  localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
}

// ─── Module state ──────────────────────────────────────────────────

let blocks      = [];
let activeColor = COLORS[0].hex;
let drag        = { active: false, startSlot: null, endSlot: null };
let pending     = null;

// ─── Helpers ───────────────────────────────────────────────────────

// slot 0 = 06:00, slot 143 = 05:50 (next day)
function slotToTime(slot) {
  const totalMinutes = (slot * 10 + 6 * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clamp(slot) {
  return Math.max(0, Math.min(SLOT_COUNT - 1, slot));
}

function normalizeRange(a, b) {
  return [Math.min(a, b), Math.max(a, b)];
}

function generateId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Render ────────────────────────────────────────────────────────

export function render(container) {
  blocks      = loadBlocks();
  activeColor = COLORS[0].hex;
  drag        = { active: false, startSlot: null, endSlot: null };
  pending     = null;

  container.innerHTML = `
    <section class="timetable-page">

      <div class="tt-toolbar">
        <span class="tt-toolbar-label">색상</span>
        <div class="tt-palette" id="ttPalette">
          ${COLORS.map((c, i) => `
            <button
              class="palette-swatch${i === 0 ? ' active' : ''}"
              data-color="${c.hex}"
              style="background:${c.hex}"
              aria-label="${c.label}"
            ></button>
          `).join('')}
        </div>
        <button class="tt-clear-btn" id="ttClearAll">전체 초기화</button>
      </div>

      <div class="tt-grid-wrap">
        <div class="tt-grid" id="ttGrid">
          ${buildGrid()}
        </div>
      </div>

      <!-- Step 1: Confirm time range -->
      <div class="tt-overlay" id="ttConfirmOverlay" hidden>
        <div class="tt-modal">
          <p class="tt-modal-msg" id="ttConfirmMsg"></p>
          <div class="tt-modal-btns">
            <button class="tt-btn-primary" id="ttConfirmYes">확인</button>
            <button class="tt-btn-ghost"   id="ttConfirmNo">취소</button>
          </div>
        </div>
      </div>

      <!-- Step 2: Link a task -->
      <div class="tt-overlay" id="ttTaskOverlay" hidden>
        <div class="tt-modal tt-modal--wide">
          <p class="tt-modal-title">할 일과 연결할까요?</p>
          <ul class="tt-task-pick" id="ttTaskPick"></ul>
          <button class="tt-btn-ghost tt-skip-btn" id="ttSkip">연결 없이 저장</button>
        </div>
      </div>

    </section>
  `;

  applyBlocks();
  bindEvents();
}

// ─── Grid builder ──────────────────────────────────────────────────

function buildGrid() {
  let html = '';

  // Header row: corner + minute labels
  html += '<div class="tt-corner"></div>';
  for (let m = 0; m < 6; m++) {
    html += `<div class="tt-min-label">:${String(m * 10).padStart(2, '0')}</div>`;
  }

  // 24 hour rows (06:00 ~ 05:00 next day)
  for (let h = 0; h < 24; h++) {
    const baseSlot  = h * 6;
    const timeStr   = slotToTime(baseSlot);
    const isMidnight = baseSlot === 108; // slot 108 = 00:00 next day

    html += `<div class="tt-hour-label">${timeStr}</div>`;

    for (let m = 0; m < 6; m++) {
      const slot = baseSlot + m;
      html += `<div class="tt-cell" data-slot="${slot}"></div>`;
    }
  }

  return html;
}

// ─── Block painting ────────────────────────────────────────────────

function applyBlocks() {
  document.querySelectorAll('.tt-cell').forEach(cell => {
    cell.style.backgroundColor = '';
    cell.classList.remove('tt-cell--filled');
    cell.removeAttribute('data-block-id');
    cell.title = '';
  });

  blocks.forEach(block => {
    for (let s = block.startSlot; s <= block.endSlot; s++) {
      const cell = document.querySelector(`.tt-cell[data-slot="${s}"]`);
      if (!cell) continue;
      cell.style.backgroundColor = block.color;
      cell.classList.add('tt-cell--filled');
      cell.setAttribute('data-block-id', block.id);
      if (block.taskTitle) cell.title = block.taskTitle;
    }
  });
}

function applyPreview(startSlot, endSlot) {
  clearPreview();
  const [s, e] = normalizeRange(startSlot, endSlot);
  for (let i = s; i <= e; i++) {
    const cell = document.querySelector(`.tt-cell[data-slot="${i}"]`);
    if (!cell) continue;
    cell.classList.add('tt-cell--preview');
    cell.style.backgroundColor = activeColor;
  }
}

function clearPreview() {
  document.querySelectorAll('.tt-cell--preview').forEach(cell => {
    cell.classList.remove('tt-cell--preview');
    const slot  = parseInt(cell.dataset.slot, 10);
    const block = blocks.find(b => b.startSlot <= slot && slot <= b.endSlot);
    cell.style.backgroundColor = block ? block.color : '';
  });
}

// ─── Events ────────────────────────────────────────────────────────

function bindEvents() {
  const grid = document.getElementById('ttGrid');

  // Palette
  document.getElementById('ttPalette').addEventListener('click', e => {
    const swatch = e.target.closest('.palette-swatch');
    if (!swatch) return;
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    activeColor = swatch.dataset.color;
  });

  // Clear all
  document.getElementById('ttClearAll').addEventListener('click', () => {
    blocks = [];
    persistBlocks(blocks);
    applyBlocks();
  });

  // Drag: start
  grid.addEventListener('mousedown', e => {
    const cell = e.target.closest('.tt-cell');
    if (!cell) return;
    e.preventDefault();
    const slot = clamp(parseInt(cell.dataset.slot, 10));
    drag = { active: true, startSlot: slot, endSlot: slot };
    applyPreview(slot, slot);
  });

  // Drag: move
  grid.addEventListener('mousemove', e => {
    if (!drag.active) return;
    const cell = e.target.closest('.tt-cell');
    if (!cell) return;
    const slot = clamp(parseInt(cell.dataset.slot, 10));
    if (slot === drag.endSlot) return;
    drag.endSlot = slot;
    applyPreview(drag.startSlot, drag.endSlot);
  });

  // Drag: end
  document.addEventListener('mouseup', onMouseUp);

  // Confirm modal
  document.getElementById('ttConfirmYes').addEventListener('click', () => {
    hideOverlay('ttConfirmOverlay');
    showTaskModal();
  });

  document.getElementById('ttConfirmNo').addEventListener('click', () => {
    hideOverlay('ttConfirmOverlay');
    clearPreview();
    pending = null;
  });

  // Task modal: skip
  document.getElementById('ttSkip').addEventListener('click', () => {
    commitBlock(null, null);
    hideOverlay('ttTaskOverlay');
  });
}

function onMouseUp() {
  if (!drag.active) return;
  drag.active = false;

  const [start, end] = normalizeRange(drag.startSlot, drag.endSlot);
  pending = { startSlot: start, endSlot: end, color: activeColor };
  showConfirmModal(start, end);
}

// ─── Confirm modal ─────────────────────────────────────────────────

function showConfirmModal(start, end) {
  const startTime = slotToTime(start);
  const endTime   = slotToTime((end + 1) % SLOT_COUNT);
  document.getElementById('ttConfirmMsg').textContent =
    `${startTime} ~ ${endTime} 이 시간대가 맞나요?`;
  showOverlay('ttConfirmOverlay');
}

// ─── Task link modal ───────────────────────────────────────────────

function showTaskModal() {
  const tasks = getTasks().filter(t => !t.done);

  if (tasks.length === 0) {
    commitBlock(null, null);
    return;
  }

  const listEl = document.getElementById('ttTaskPick');
  listEl.innerHTML = tasks.map(task => `
    <li class="tt-task-item" data-id="${escapeHtml(task.id)}" data-title="${escapeHtml(task.title)}">
      <div class="tt-task-info">
        <span class="tt-task-name">${escapeHtml(task.title)}</span>
        <div class="tt-task-badges">
          <span class="meta-badge">${task.importance}</span>
          <span class="meta-badge">${task.urgency}</span>
          ${task.deadline ? `<span class="meta-badge">📅 ${escapeHtml(task.deadline)}</span>` : ''}
        </div>
      </div>
      <span class="tt-task-arrow">→</span>
    </li>
  `).join('');

  listEl.querySelectorAll('.tt-task-item').forEach(item => {
    item.addEventListener('click', () => {
      commitBlock(item.dataset.id, item.dataset.title);
      hideOverlay('ttTaskOverlay');
    });
  });

  showOverlay('ttTaskOverlay');
}

// ─── Save block ────────────────────────────────────────────────────

function commitBlock(taskId, taskTitle) {
  if (!pending) return;
  blocks.push({
    id:        generateId(),
    startSlot: pending.startSlot,
    endSlot:   pending.endSlot,
    color:     pending.color,
    taskId:    taskId ?? null,
    taskTitle: taskTitle ?? null,
  });
  persistBlocks(blocks);
  clearPreview();
  applyBlocks();
  pending = null;
}

// ─── Overlay helpers ───────────────────────────────────────────────

function showOverlay(id) { document.getElementById(id).hidden = false; }
function hideOverlay(id) { document.getElementById(id).hidden = true; }
