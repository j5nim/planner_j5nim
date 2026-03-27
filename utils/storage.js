// utils/storage.js
// localStorage helpers. Read/write tasks, settings, and timer state.

const KEYS = {
  tasks:    'planner_tasks',
  sessions: 'planner_sessions',
};

// ─── Internal helpers ──────────────────────────────────────────────

function readRaw() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.tasks) || '[]');
  } catch {
    return [];
  }
}

function writeRaw(tasks) {
  localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
}

function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Returns all stored tasks.
 * @returns {Task[]}
 */
export function getTasks() {
  return readRaw();
}

/**
 * Saves a new task. Assigns a unique id and createdAt timestamp.
 * Accepts a parsed task object from api.js or a plain object.
 *
 * @param {{ title: string, deadline?: string|null, importance?: string, urgency?: string }} task
 * @returns {Task} The saved task with id and createdAt
 */
export function addTask(task) {
  const tasks = readRaw();
  const newTask = {
    id:         generateId(),
    title:      task.title ?? '(제목 없음)',
    deadline:   task.deadline ?? null,
    importance: task.importance ?? '보통',
    urgency:    task.urgency ?? '이번주',
    done:       false,
    createdAt:  new Date().toISOString(),
  };
  tasks.push(newTask);
  writeRaw(tasks);
  return newTask;
}

/**
 * Saves multiple tasks at once. Returns the array of saved tasks.
 *
 * @param {object[]} taskList
 * @returns {Task[]}
 */
export function addTasks(taskList) {
  return taskList.map(addTask);
}

/**
 * Updates fields of an existing task by id.
 * Only the provided fields are overwritten.
 *
 * @param {string} id
 * @param {Partial<Task>} updates
 * @returns {Task|null} Updated task, or null if not found
 */
export function updateTask(id, updates) {
  const tasks = readRaw();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;

  // Prevent overwriting id and createdAt
  const { id: _id, createdAt: _ts, ...safeUpdates } = updates;
  tasks[index] = { ...tasks[index], ...safeUpdates };
  writeRaw(tasks);
  return tasks[index];
}

/**
 * Toggles the done state of a task.
 *
 * @param {string} id
 * @returns {Task|null}
 */
export function toggleTask(id) {
  const tasks = readRaw();
  const task  = tasks.find(t => t.id === id);
  if (!task) return null;
  return updateTask(id, { done: !task.done });
}

/**
 * Deletes a task by id.
 *
 * @param {string} id
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteTask(id) {
  const tasks   = readRaw();
  const filtered = tasks.filter(t => t.id !== id);
  if (filtered.length === tasks.length) return false;
  writeRaw(filtered);
  return true;
}

/**
 * Deletes all tasks that are marked as done.
 *
 * @returns {number} Number of tasks deleted
 */
export function clearDoneTasks() {
  const tasks   = readRaw();
  const active  = tasks.filter(t => !t.done);
  writeRaw(active);
  return tasks.length - active.length;
}

/**
 * Deletes every task. Use with caution.
 */
export function clearAllTasks() {
  writeRaw([]);
}

/**
 * Returns tasks filtered by one or more fields.
 * All provided fields must match (AND logic).
 *
 * @param {{ done?: boolean, urgency?: string, importance?: string }} filter
 * @returns {Task[]}
 *
 * @example
 * getTasksBy({ done: false, urgency: '오늘' })
 */
export function getTasksBy(filter) {
  return readRaw().filter(task =>
    Object.entries(filter).every(([key, val]) => task[key] === val)
  );
}

// ─── Focus session log ─────────────────────────────────────────────

/**
 * Records a completed Pomodoro work session.
 *
 * @param {{ taskId: string|null, taskTitle: string|null, minutes: number }} session
 */
export function logSession({ taskId, taskTitle, minutes }) {
  const sessions = getSessions();
  sessions.push({
    id:        `ses_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    taskId:    taskId    ?? null,
    taskTitle: taskTitle ?? null,
    minutes,
    date:      new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

/**
 * Returns all recorded focus sessions.
 * @returns {Session[]}
 */
export function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.sessions) || '[]');
  } catch {
    return [];
  }
}

/**
 * @typedef {{
 *   id:         string,
 *   title:      string,
 *   deadline:   string | null,
 *   importance: '높음' | '보통' | '낮음',
 *   urgency:    '오늘' | '이번주' | '나중에',
 *   done:       boolean,
 *   createdAt:  string,
 *   focusMinutes?: number,
 * }} Task
 *
 * @typedef {{
 *   id:        string,
 *   taskId:    string | null,
 *   taskTitle: string | null,
 *   minutes:   number,
 *   date:      string,
 *   timestamp: string,
 * }} Session
 */
