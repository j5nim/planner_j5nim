// utils/api.js
// Groq API client. Handles request formatting, auth, and response parsing.
//
// API key is read from config.js (browser-readable). To set your key, edit
// config.js at the project root. That file is gitignored so it won't be committed.

import { GROQ_API_KEY as CONFIG_KEY } from '../config.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.3-70b-versatile';

// ─── API key helpers ───────────────────────────────────────────────

export function setApiKey(key) {
  localStorage.setItem('groq_api_key', key.trim());
}

export function getApiKey() {
  return localStorage.getItem('groq_api_key') || CONFIG_KEY || '';
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
 * Sends a natural language string to Groq and returns an array of
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
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: input.trim() },
    ],
    temperature: 0.2,
    max_tokens:  1024,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
  const raw  = data?.choices?.[0]?.message?.content ?? '';

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
    messages: [
      { role: 'system', content: SUGGEST_SYSTEM },
      { role: 'user',   content: userContent },
    ],
    temperature: 0.2,
    max_tokens:  512,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
  const raw  = (data?.choices?.[0]?.message?.content ?? '').trim();
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

function parseJsonSafely(raw) {
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
    super(`Groq API error ${status}: ${message}`);
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
    super(`Failed to parse Groq response as JSON.\nRaw: ${raw}`);
    this.name = 'ParseError';
  }
}
