// utils/api.js
// Claude API client. Handles request formatting, auth, and response parsing.
//
// NOTE: Pure browser apps cannot read .env files at runtime — that requires a
// build tool (Vite, webpack) or a backend proxy. This client stores the API key
// in localStorage instead. Call setApiKey(key) once from the settings UI.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL          = 'claude-haiku-4-5-20251001';

// ─── API key helpers ───────────────────────────────────────────────

export function setApiKey(key) {
  localStorage.setItem('anthropic_api_key', key.trim());
}

export function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

export function hasApiKey() {
  return getApiKey().length > 0;
}

// ─── Task parser ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a task structuring assistant.
The user will describe their to-do items in natural language (Korean or English).
Extract every distinct task and return ONLY a valid JSON array — no markdown, no explanation.

Each task object must follow this exact shape:
{
  "title":      string,           // concise task title in the user's language
  "deadline":   string | null,    // specific date (YYYY-MM-DD) if mentioned, else null
  "importance": "높음" | "보통" | "낮음",
  "urgency":    "오늘" | "이번주" | "나중에"
}

Rules:
- Infer importance and urgency from context (words like 급하게, 꼭, 중요, ASAP → 높음/오늘).
- If no deadline is mentioned set deadline to null.
- Return at least one task even if the input is vague.
- Output must be parseable by JSON.parse() with no surrounding text.`;

/**
 * Sends a natural language string to Claude and returns an array of
 * structured task objects.
 *
 * @param {string} input  Raw user input
 * @returns {Promise<Task[]>}
 *
 * @typedef {{ title: string, deadline: string|null, importance: string, urgency: string }} Task
 */
export async function parseTasks(input) {
  const apiKey = getApiKey();
  if (!apiKey) throw new ApiKeyMissingError();

  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: input.trim() }
    ],
  };

  let response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'x-api-key':               apiKey,
        'anthropic-version':       '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new NetworkError(err.message);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(response.status, detail?.error?.message ?? response.statusText);
  }

  const data = await response.json();
  const raw  = data?.content?.[0]?.text ?? '';

  return parseJsonSafely(raw);
}

// ─── Next-step suggester ───────────────────────────────────────────

const SUGGEST_SYSTEM = `You are a productivity assistant.
The user will give you their current task list.
Identify ONE specific next step that is logically missing or would naturally follow from the existing tasks.
Return ONLY a valid JSON object — no markdown, no explanation.

Shape:
{
  "title":      string,           // concise action in Korean
  "deadline":   string | null,    // YYYY-MM-DD if time-sensitive, else null
  "importance": "높음" | "보통" | "낮음",
  "urgency":    "오늘" | "이번주" | "나중에",
  "reason":     string            // one short sentence in Korean explaining why
}

If the task list is empty or you have no meaningful suggestion, return null.
Output must be parseable by JSON.parse() with no surrounding text.`;

/**
 * Analyzes a list of tasks and returns a single suggested next step,
 * or null if no suggestion is available.
 *
 * @param {Task[]} tasks
 * @returns {Promise<(Task & { reason: string }) | null>}
 */
export async function suggestNextTask(tasks) {
  const apiKey = getApiKey();
  if (!apiKey) throw new ApiKeyMissingError();

  const taskLines = tasks
    .map(t => `- [${t.done ? '완료' : '미완료'}] ${t.title} (중요도: ${t.importance}, 긴박도: ${t.urgency})`)
    .join('\n');

  const userContent = taskLines.length
    ? `현재 할 일 목록:\n${taskLines}`
    : '현재 등록된 할 일이 없습니다.';

  const body = {
    model: MODEL,
    max_tokens: 512,
    system: SUGGEST_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  };

  let response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new NetworkError(err.message);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(response.status, detail?.error?.message ?? response.statusText);
  }

  const data = await response.json();
  const raw  = (data?.content?.[0]?.text ?? '').trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  if (cleaned === 'null' || cleaned === '') return null;

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    throw new ParseError(raw);
  }
}

// ─── JSON extraction ───────────────────────────────────────────────

/**
 * Strips any accidental markdown fences and parses the JSON array.
 * @param {string} raw
 * @returns {Task[]}
 */
function parseJsonSafely(raw) {
  // Remove ```json ... ``` fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ParseError(raw);
  }

  if (!Array.isArray(parsed)) throw new ParseError(raw);
  return parsed;
}

// ─── Custom errors ─────────────────────────────────────────────────

export class ApiKeyMissingError extends Error {
  constructor() {
    super('API key is not set. Call setApiKey() first.');
    this.name = 'ApiKeyMissingError';
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(`Claude API error ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(`Network error: ${message}`);
    this.name = 'NetworkError';
  }
}

export class ParseError extends Error {
  constructor(raw) {
    super(`Failed to parse Claude response as JSON.\nRaw: ${raw}`);
    this.name = 'ParseError';
  }
}
