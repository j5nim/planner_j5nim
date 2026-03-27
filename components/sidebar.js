// components/sidebar.js
// Collapsible sidebar. Navigation links and toggle behavior.
// Collapsed = icon-only (52px). Expanded = icon + label (220px).

const PAGES = [
  { key: 'home',      label: '홈',          icon: '⌂' },
  { key: 'tasklist',  label: '할 일',        icon: '☑' },
  { key: 'timetable', label: '타임테이블',   icon: '⊞' },
  { key: 'timer',     label: '타이머',       icon: '◷' },
  { key: 'stats',     label: '통계',         icon: '≈' },
];

const USAGE_TIPS = [
  '<b>홈</b> — 자연어로 할 일을 입력하면 AI가 구조화해줘요',
  '<b>할 일</b> — 중요도·긴박도로 필터링할 수 있어요',
  '<b>타임테이블</b> — 드래그로 시간대를 칠하고 할 일을 연결해요',
  '<b>타이머</b> — 뽀모도로 세션을 시작하면 집중 시간이 기록돼요',
  '<b>Ctrl + Enter</b> — 입력창에서 빠르게 제출해요',
  '<b>AI 추천</b> — 우하단 카드에서 다음 단계를 제안해줘요',
];

// ─── Module state ──────────────────────────────────────────────────

let sidebarEl    = null;
let iconOnly     = false;
let activePage   = 'home';
let _onNavigate  = () => {};
let _onTheme     = () => {};
let navTooltipEl = null; // body-level floating tooltip for icon-only mode

// ─── Init ──────────────────────────────────────────────────────────

/**
 * Mounts the sidebar into #sidebar and wires up all interactions.
 *
 * @param {{ onNavigate: (page: string) => void, onThemeToggle: () => void }} opts
 * @returns {{ toggle: () => void, setActive: (page: string) => void }}
 */
export function initSidebar({ onNavigate, onThemeToggle }) {
  sidebarEl   = document.getElementById('sidebar');
  _onNavigate = onNavigate  ?? _onNavigate;
  _onTheme    = onThemeToggle ?? _onTheme;

  iconOnly = localStorage.getItem('sidebar_icon_only') === 'true';

  sidebarEl.innerHTML = buildHTML();
  applyIconOnly(false);
  syncThemeIcon();
  mountNavTooltip();
  bindEvents();

  return { toggle, setActive };
}

// ─── HTML ──────────────────────────────────────────────────────────

function buildHTML() {
  return `
    <div class="sidebar-header">
      <span class="sidebar-logo">Planner</span>
      <button class="sb-toggle-btn" id="sbToggleBtn" aria-label="사이드바 접기">‹</button>
    </div>

    <nav class="sidebar-nav" id="sbNav">
      ${PAGES.map(p => `
        <a class="nav-item${p.key === activePage ? ' active' : ''}"
           href="#"
           data-page="${p.key}"
           aria-label="${p.label}">
          <span class="nav-icon" aria-hidden="true">${p.icon}</span>
          <span class="nav-label">${p.label}</span>
        </a>
      `).join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="sb-footer-row">

        <!-- ⓘ info with tooltip -->
        <div class="sb-info-wrap">
          <button class="sb-foot-btn" id="sbInfo" aria-label="사용법">ⓘ</button>
          <div class="sb-tooltip" id="sbTooltip" role="tooltip" aria-hidden="true">
            <p class="sb-tooltip-title">사용법</p>
            <ul class="sb-tooltip-list">
              ${USAGE_TIPS.map(t => `<li>${t}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- theme toggle -->
        <button class="sb-foot-btn sb-theme-btn" id="sbThemeBtn" aria-label="테마 전환">
          <span id="sbThemeIcon"></span>
        </button>

        <!-- ? feedback -->
        <button class="sb-foot-btn" id="sbFeedbackBtn" aria-label="피드백">?</button>

      </div>
    </div>

    <!-- Feedback modal — fixed overlay, scoped inside sidebar el -->
    <div class="sb-feedback-overlay" id="sbFeedbackOverlay" hidden>
      <div class="sb-feedback-modal" role="dialog" aria-modal="true" aria-label="의견 보내기">
        <div class="sb-feedback-header">
          <span class="sb-feedback-title">의견 보내기</span>
          <button class="sb-feedback-close" id="sbFeedbackClose" aria-label="닫기">✕</button>
        </div>
        <p class="sb-feedback-desc">
          버그, 개선 아이디어, 기능 요청 등 자유롭게 남겨주세요.<br />
          GitHub Issues로 직접 남기거나 아래에 작성 후 복사하세요.
        </p>
        <textarea
          class="sb-feedback-textarea"
          id="sbFeedbackText"
          placeholder="의견을 입력해주세요..."
          rows="5"
        ></textarea>
        <div class="sb-feedback-actions">
          <button class="sb-feedback-copy-btn" id="sbFeedbackCopy">클립보드에 복사</button>
          <a class="sb-feedback-link"
             href="https://github.com/j5nim/planner_j5nim/issues"
             target="_blank"
             rel="noopener noreferrer">
            GitHub Issues →
          </a>
        </div>
      </div>
    </div>
  `;
}

// ─── Nav tooltip (body-level, escapes overflow:hidden) ─────────────

function mountNavTooltip() {
  navTooltipEl = document.createElement('div');
  navTooltipEl.className = 'sb-nav-tooltip';
  navTooltipEl.hidden = true;
  document.body.appendChild(navTooltipEl);
}

function showNavTooltip(item) {
  if (!iconOnly || !navTooltipEl) return;
  const rect = item.getBoundingClientRect();
  navTooltipEl.textContent = item.getAttribute('aria-label');
  navTooltipEl.style.top  = `${rect.top + rect.height / 2}px`;
  navTooltipEl.style.left = `${rect.right + 10}px`;
  navTooltipEl.hidden = false;
}

function hideNavTooltip() {
  if (navTooltipEl) navTooltipEl.hidden = true;
}

// ─── Events ────────────────────────────────────────────────────────

function bindEvents() {
  // Sidebar collapse toggle (inside)
  document.getElementById('sbToggleBtn').addEventListener('click', toggle);

  // Topbar hamburger
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', toggle);

  // Navigation + nav tooltip
  const sbNav = document.getElementById('sbNav');
  sbNav.addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    hideNavTooltip();
    setActive(item.dataset.page);
    _onNavigate(item.dataset.page);
  });

  sbNav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mouseenter', () => showNavTooltip(item));
    item.addEventListener('mouseleave', hideNavTooltip);
  });

  // Theme
  document.getElementById('sbThemeBtn').addEventListener('click', () => {
    _onTheme();
    syncThemeIcon();
  });

  // ⓘ tooltip — position using getBoundingClientRect so it escapes overflow
  const infoBtn = document.getElementById('sbInfo');
  const tooltip = document.getElementById('sbTooltip');

  infoBtn.addEventListener('mouseenter', () => {
    const rect = infoBtn.getBoundingClientRect();
    tooltip.style.left   = `${rect.right + 10}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.bottom - 8}px`;
    tooltip.style.top    = 'auto';
    tooltip.classList.add('visible');
  });
  infoBtn.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!tooltip.matches(':hover')) tooltip.classList.remove('visible');
    }, 80);
  });
  tooltip.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

  // ? feedback
  document.getElementById('sbFeedbackBtn').addEventListener('click', openFeedback);
  document.getElementById('sbFeedbackClose').addEventListener('click', closeFeedback);
  document.getElementById('sbFeedbackOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeFeedback();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeFeedback();
  });

  // Copy
  document.getElementById('sbFeedbackCopy').addEventListener('click', () => {
    const text = document.getElementById('sbFeedbackText').value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('sbFeedbackCopy');
      const orig = btn.textContent;
      btn.textContent = '복사됐어요 ✓';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  });
}

// ─── Toggle ────────────────────────────────────────────────────────

export function toggle() {
  iconOnly = !iconOnly;
  localStorage.setItem('sidebar_icon_only', iconOnly);
  applyIconOnly(true);
}

function applyIconOnly(animate) {
  if (!sidebarEl) return;
  if (!animate) sidebarEl.classList.add('sb-no-transition');

  sidebarEl.classList.toggle('icon-only', iconOnly);

  const btn = document.getElementById('sbToggleBtn');
  if (btn) btn.textContent = iconOnly ? '›' : '‹';

  if (!animate) {
    // Force reflow then re-enable transitions
    void sidebarEl.offsetWidth;
    sidebarEl.classList.remove('sb-no-transition');
  }
}

// ─── Active page ───────────────────────────────────────────────────

export function setActive(pageKey) {
  activePage = pageKey;

  document.querySelectorAll('#sbNav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageKey);
  });

  const page    = PAGES.find(p => p.key === pageKey);
  const titleEl = document.getElementById('pageTitle');
  if (titleEl && page) titleEl.textContent = page.label;
}

// ─── Theme icon ────────────────────────────────────────────────────

function syncThemeIcon() {
  const theme  = document.documentElement.getAttribute('data-theme');
  const iconEl = document.getElementById('sbThemeIcon');
  if (iconEl) iconEl.textContent = theme === 'dark' ? '☀' : '☾';
}

// ─── Feedback ──────────────────────────────────────────────────────

function openFeedback() {
  const overlay = document.getElementById('sbFeedbackOverlay');
  if (!overlay) return;
  overlay.hidden = false;
  setTimeout(() => document.getElementById('sbFeedbackText')?.focus(), 50);
}

function closeFeedback() {
  const overlay = document.getElementById('sbFeedbackOverlay');
  if (overlay) overlay.hidden = true;
}
