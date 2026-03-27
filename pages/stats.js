// pages/stats.js
// Stats page. Visualizes completed tasks, focus time, and productivity trends.

import { getTasks, getSessions } from '../utils/storage.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const IMP_ORDER = { '높음': 0, '보통': 1, '낮음': 2 };

// ─── Render ────────────────────────────────────────────────────────

export function render(container) {
  const { summary, daily, taskFocus, byImportance } = computeStats();

  container.innerHTML = `
    <section class="stats-page">

      <!-- Summary cards -->
      <div class="stats-cards">
        ${card('이번 주 집중', formatMinutes(summary.weekMinutes), '⏱')}
        ${card('오늘 집중',    formatMinutes(summary.todayMinutes), '◷')}
        ${card('완료된 할 일', `${summary.done} / ${summary.total}`, '☑')}
        ${card('완료율',       `${summary.rate}%`, '≈')}
      </div>

      <!-- Daily bar chart -->
      <div class="stats-section">
        <div class="stats-section-header">
          <h2 class="stats-section-title">지난 7일 집중 시간</h2>
          <span class="stats-section-sub">단위: 분</span>
        </div>
        ${buildBarChart(daily)}
      </div>

      <!-- Completion by importance -->
      <div class="stats-section">
        <div class="stats-section-header">
          <h2 class="stats-section-title">중요도별 완료율</h2>
        </div>
        ${buildImportanceRows(byImportance)}
      </div>

      <!-- Task focus breakdown -->
      <div class="stats-section">
        <div class="stats-section-header">
          <h2 class="stats-section-title">할 일별 집중 시간</h2>
        </div>
        ${buildTaskFocusRows(taskFocus)}
      </div>

    </section>
  `;
}

// ─── Data computation ──────────────────────────────────────────────

function computeStats() {
  const tasks    = getTasks();
  const sessions = getSessions();
  const today    = toDateStr(new Date());

  // Summary
  const done          = tasks.filter(t => t.done).length;
  const total         = tasks.length;
  const rate          = total > 0 ? Math.round((done / total) * 100) : 0;
  const todayMinutes  = sessions.filter(s => s.date === today)
                                .reduce((s, r) => s + r.minutes, 0);
  const weekDates     = new Set(getLast7Days());
  const weekMinutes   = sessions.filter(s => weekDates.has(s.date))
                                .reduce((s, r) => s + r.minutes, 0);

  // Daily chart: last 7 days
  const last7   = getLast7Days();
  const daily   = last7.map(date => ({
    date,
    label:   weekdayLabel(date),
    minutes: sessions.filter(s => s.date === date).reduce((s, r) => s + r.minutes, 0),
    isToday: date === today,
  }));

  // Per-task focus (only tasks with focusMinutes > 0, sorted desc)
  const taskFocus = tasks
    .filter(t => (t.focusMinutes ?? 0) > 0)
    .sort((a, b) => (b.focusMinutes ?? 0) - (a.focusMinutes ?? 0));

  // By importance
  const levels = ['높음', '보통', '낮음'];
  const byImportance = levels.map(imp => {
    const group    = tasks.filter(t => t.importance === imp);
    const doneGrp  = group.filter(t => t.done).length;
    const rate     = group.length > 0 ? Math.round((doneGrp / group.length) * 100) : null;
    return { imp, total: group.length, done: doneGrp, rate };
  }).filter(r => r.total > 0);

  return {
    summary: { done, total, rate, todayMinutes, weekMinutes },
    daily,
    taskFocus,
    byImportance,
  };
}

// ─── Chart builders ────────────────────────────────────────────────

function buildBarChart(daily) {
  const maxMin = Math.max(...daily.map(d => d.minutes), 1);
  const totalFocus = daily.reduce((s, d) => s + d.minutes, 0);

  if (totalFocus === 0) {
    return `<div class="stats-empty">아직 기록된 집중 시간이 없어요. 타이머를 시작해보세요!</div>`;
  }

  const bars = daily.map(d => {
    const pct   = Math.round((d.minutes / maxMin) * 100);
    const label = d.minutes > 0 ? formatMinutes(d.minutes) : '';
    return `
      <div class="bar-col${d.isToday ? ' today' : ''}">
        <span class="bar-value">${label}</span>
        <div class="bar-track">
          <div class="bar-fill" style="height:${pct}%"></div>
        </div>
        <span class="bar-label">${d.label}</span>
      </div>
    `;
  }).join('');

  return `<div class="bar-chart">${bars}</div>`;
}

function buildImportanceRows(byImportance) {
  if (byImportance.length === 0) {
    return `<div class="stats-empty">등록된 할 일이 없어요.</div>`;
  }

  const IMP_ICON = { '높음': '🔴', '보통': '🟡', '낮음': '🔵' };

  return byImportance.map(({ imp, total, done, rate }) => `
    <div class="imp-row">
      <div class="imp-row-header">
        <span class="imp-row-label">${IMP_ICON[imp]} ${imp}</span>
        <span class="imp-row-count">${done} / ${total} (${rate}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${rate}%"
             data-imp="${imp}"></div>
      </div>
    </div>
  `).join('');
}

function buildTaskFocusRows(taskFocus) {
  if (taskFocus.length === 0) {
    return `<div class="stats-empty">아직 집중 시간이 기록된 할 일이 없어요.</div>`;
  }

  const maxMin = taskFocus[0].focusMinutes ?? 1;

  return `
    <div class="task-focus-list">
      ${taskFocus.map(task => {
        const pct  = Math.round(((task.focusMinutes ?? 0) / maxMin) * 100);
        const done = task.done ? 'done' : '';
        return `
          <div class="task-focus-row ${done}">
            <div class="task-focus-meta">
              <span class="task-focus-title">${escapeHtml(task.title)}</span>
              <span class="task-focus-time">${formatMinutes(task.focusMinutes ?? 0)}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill progress-fill--focus" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── Summary card ──────────────────────────────────────────────────

function card(label, value, icon) {
  return `
    <div class="stats-card">
      <span class="stats-card-icon">${icon}</span>
      <span class="stats-card-value">${value}</span>
      <span class="stats-card-label">${label}</span>
    </div>
  `;
}

// ─── Utilities ─────────────────────────────────────────────────────

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toDateStr(d);
  });
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function weekdayLabel(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = WEEKDAYS[d.getDay()];
  const md  = `${d.getMonth() + 1}/${d.getDate()}`;
  return `${day}\n${md}`;
}

function formatMinutes(min) {
  if (!min || min === 0) return '0분';
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
