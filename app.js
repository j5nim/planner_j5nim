// app.js
// App entry point. Initializes routing, theme, and sidebar state.

import { render as renderHome }      from './pages/home.js';
import { render as renderTasklist }  from './pages/tasklist.js';
import { render as renderTimetable } from './pages/timetable.js';
import { render as renderTimer }     from './pages/timer.js';
import { render as renderStats }     from './pages/stats.js';
import { initSidebar }               from './components/sidebar.js';
import { initSuggestion } from './components/suggestion.js';

const pageRenderers = {
  home:      renderHome,
  tasklist:  renderTasklist,
  timetable: renderTimetable,
  timer:     renderTimer,
  stats:     renderStats,
};

const mainContent = document.getElementById('mainContent');

// ─── Theme ────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ─── Routing ──────────────────────────────────────────────────────

function loadPage(pageKey) {
  const renderer = pageRenderers[pageKey];
  if (renderer) {
    renderer(mainContent);
  } else {
    mainContent.innerHTML = `<p class="page-placeholder">${pageKey} — coming soon.</p>`;
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────

const { setActive } = initSidebar({
  onNavigate:    loadPage,
  onThemeToggle: toggleTheme,
});

// ─── Boot ─────────────────────────────────────────────────────────

setActive('home');
loadPage('home');
initSuggestion();
