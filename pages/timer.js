// pages/timer.js
// Pomodoro timer page. Focus/break session logic and display.

import { getTasks, updateTask, logSession } from '../utils/storage.js';

const SETTINGS_KEY  = 'planner_timer_settings';
const RADIUS        = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 552.92

// ─── Settings ──────────────────────────────────────────────────────

function loadSettings() {
  try {
    return { workMin: 25, breakMin: 5, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { workMin: 25, breakMin: 5 };
  }
}

function persistSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Module state ──────────────────────────────────────────────────

let cfg          = loadSettings();
let phase        = 'idle';   // 'idle' | 'work' | 'break'
let running      = false;
let remaining    = 0;
let totalSec     = 0;
let sessionsDone = 0;
let taskId       = null;
let intervalId   = null;

// ─── Render ────────────────────────────────────────────────────────

export function render(container) {
  clearInterval(intervalId);

  cfg          = loadSettings();
  phase        = 'idle';
  running      = false;
  remaining    = cfg.workMin * 60;
  totalSec     = cfg.workMin * 60;
  sessionsDone = 0;
  taskId       = null;
  intervalId   = null;

  const tasks = getTasks().filter(t => !t.done);

  container.innerHTML = `
    <section class="timer-page" id="timerPage" data-phase="idle">

      <!-- Task selector -->
      <div class="timer-task-row">
        <label class="timer-label" for="timerTask">집중할 할 일</label>
        <select class="timer-select" id="timerTask">
          <option value="">선택 안 함</option>
          ${tasks.map(t => `
            <option value="${escapeHtml(t.id)}">
              ${escapeHtml(t.title)}${t.focusMinutes ? ` (${t.focusMinutes}분 집중)` : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Ring timer -->
      <div class="timer-ring-wrap">
        <svg class="timer-ring" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <circle class="ring-track" cx="100" cy="100" r="${RADIUS}" />
          <circle class="ring-progress" cx="100" cy="100" r="${RADIUS}"
            id="ringProgress"
            stroke-dasharray="${CIRCUMFERENCE.toFixed(3)}"
            stroke-dashoffset="0"
          />
        </svg>
        <div class="timer-inner">
          <span class="timer-phase-label" id="timerPhaseLabel">대기</span>
          <span class="timer-display"     id="timerDisplay">${formatTime(remaining)}</span>
          <span class="timer-sessions"    id="timerSessions">0 세션</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="timer-controls">
        <button class="timer-btn timer-btn--primary" id="timerToggle">시작</button>
        <button class="timer-btn timer-btn--ghost"   id="timerReset">초기화</button>
      </div>

      <!-- Settings toggle -->
      <div class="timer-settings-wrap">
        <button class="timer-settings-toggle" id="timerSettingsBtn">⚙ 타이머 설정</button>
        <div class="timer-settings" id="timerSettings" hidden>
          <div class="settings-field">
            <label class="settings-label" for="settingWork">집중 시간 (분)</label>
            <div class="settings-input-row">
              <button class="settings-step" data-target="settingWork" data-delta="-1">−</button>
              <input type="number" class="settings-input" id="settingWork"
                min="1" max="120" value="${cfg.workMin}" />
              <button class="settings-step" data-target="settingWork" data-delta="1">+</button>
            </div>
          </div>
          <div class="settings-field">
            <label class="settings-label" for="settingBreak">휴식 시간 (분)</label>
            <div class="settings-input-row">
              <button class="settings-step" data-target="settingBreak" data-delta="-1">−</button>
              <input type="number" class="settings-input" id="settingBreak"
                min="1" max="60" value="${cfg.breakMin}" />
              <button class="settings-step" data-target="settingBreak" data-delta="1">+</button>
            </div>
          </div>
          <button class="settings-apply" id="settingsApply">적용</button>
        </div>
      </div>

    </section>
  `;

  bindEvents();
  syncDisplay();
}

// ─── Events ────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('timerTask').addEventListener('change', e => {
    taskId = e.target.value || null;
  });

  document.getElementById('timerToggle').addEventListener('click', toggleTimer);
  document.getElementById('timerReset').addEventListener('click', resetTimer);

  document.getElementById('timerSettingsBtn').addEventListener('click', () => {
    const panel = document.getElementById('timerSettings');
    panel.hidden = !panel.hidden;
  });

  // Step buttons (− / +)
  document.querySelectorAll('.settings-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const delta = parseInt(btn.dataset.delta, 10);
      const min   = parseInt(input.min, 10);
      const max   = parseInt(input.max, 10);
      input.value = Math.min(max, Math.max(min, parseInt(input.value, 10) + delta));
    });
  });

  document.getElementById('settingsApply').addEventListener('click', applySettings);
}

// ─── Timer logic ───────────────────────────────────────────────────

function toggleTimer() {
  if (phase === 'idle') {
    startWork();
    return;
  }
  running ? pauseTimer() : resumeTimer();
}

function startWork() {
  phase     = 'work';
  remaining = cfg.workMin * 60;
  totalSec  = cfg.workMin * 60;
  startTicking();
}

function startBreak() {
  phase     = 'break';
  remaining = cfg.breakMin * 60;
  totalSec  = cfg.breakMin * 60;
  startTicking();
}

function startTicking() {
  running = true;
  clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
  syncDisplay();
}

function pauseTimer() {
  running = false;
  clearInterval(intervalId);
  syncDisplay();
}

function resumeTimer() {
  running = true;
  intervalId = setInterval(tick, 1000);
  syncDisplay();
}

function resetTimer() {
  clearInterval(intervalId);
  phase     = 'idle';
  running   = false;
  remaining = cfg.workMin * 60;
  totalSec  = cfg.workMin * 60;
  syncDisplay();
}

function tick() {
  remaining--;
  syncDisplay();

  if (remaining <= 0) {
    clearInterval(intervalId);
    running = false;
    onPhaseEnd();
  }
}

function onPhaseEnd() {
  if (phase === 'work') {
    sessionsDone++;
    recordFocusTime(cfg.workMin);
    flashPhase();
    setTimeout(() => startBreak(), 800);
  } else {
    flashPhase();
    setTimeout(() => startWork(), 800);
  }
}

function flashPhase() {
  const page = document.getElementById('timerPage');
  if (!page) return;
  page.classList.add('timer-flash');
  setTimeout(() => page.classList.remove('timer-flash'), 600);
}

// ─── Focus time recording ──────────────────────────────────────────

function recordFocusTime(minutes) {
  // Always log the session (even without a linked task)
  const tasks     = getTasks();
  const task      = taskId ? tasks.find(t => t.id === taskId) : null;
  const taskTitle = task?.title ?? null;

  logSession({ taskId: taskId ?? null, taskTitle, minutes });

  if (task) {
    updateTask(taskId, { focusMinutes: (task.focusMinutes ?? 0) + minutes });
  }
}

// ─── Settings ──────────────────────────────────────────────────────

function applySettings() {
  const workVal  = parseInt(document.getElementById('settingWork').value,  10);
  const breakVal = parseInt(document.getElementById('settingBreak').value, 10);

  if (!workVal || !breakVal || workVal < 1 || breakVal < 1) return;

  cfg = { workMin: workVal, breakMin: breakVal };
  persistSettings(cfg);

  // Reset timer to reflect new durations (only when not mid-session)
  if (phase !== 'work' && phase !== 'break') {
    resetTimer();
  }

  document.getElementById('timerSettings').hidden = true;
}

// ─── Display sync ──────────────────────────────────────────────────

function syncDisplay() {
  const page         = document.getElementById('timerPage');
  const displayEl    = document.getElementById('timerDisplay');
  const phaseEl      = document.getElementById('timerPhaseLabel');
  const sessionsEl   = document.getElementById('timerSessions');
  const toggleBtn    = document.getElementById('timerToggle');
  const ringProgress = document.getElementById('ringProgress');

  if (!page) return;

  // Phase attribute drives ring color via CSS
  page.setAttribute('data-phase', phase);

  // Time display
  displayEl.textContent = formatTime(remaining);

  // Phase label
  const phaseLabels = { idle: '대기', work: '집중', break: '휴식' };
  phaseEl.textContent = phaseLabels[phase] ?? '';

  // Session count
  sessionsEl.textContent = sessionsDone > 0
    ? `${sessionsDone} 세션 완료`
    : '0 세션';

  // Start / Pause label
  if (phase === 'idle')        toggleBtn.textContent = '시작';
  else if (running)            toggleBtn.textContent = '일시정지';
  else                         toggleBtn.textContent = '계속';

  // Ring progress
  const progress = totalSec > 0 ? remaining / totalSec : 1;
  const offset   = CIRCUMFERENCE * (1 - progress);
  ringProgress.setAttribute('stroke-dashoffset', offset.toFixed(3));
}
