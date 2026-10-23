import { Platform } from 'react-native';
import { EnergyLevel, PendingTask, Priority } from '../theme';

/**
 * The one place that knows where the backend lives.
 *
 * Android emulators reach the host machine through 10.0.2.2, everything else
 * (web, iOS simulator) through localhost. Override with EXPO_PUBLIC_API_URL.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8001',
    default: 'http://localhost:8001',
  })!;

export type PlanResult = {
  tasks: PendingTask[];
  breakdown: string;
  /** Which model answered. "offline-planner" means no Gemini call was made. */
  model: string;
};

export type ApiHealth = {
  model: string;
  geminiConfigured: boolean;
  mockMode: boolean;
  reachable: boolean;
};

export class ApiError extends Error {}

const LEVELS = ['low', 'medium', 'high'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TASKS = 8;
const MIN_MINUTES = 5;
const MAX_MINUTES = 480;

let sequence = 0;

function makeId(): string {
  sequence += 1;
  return `t${Date.now().toString(36)}-${sequence}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asLevel(value: unknown, fallback: EnergyLevel): EnergyLevel {
  const text = asText(value).toLowerCase();
  return (LEVELS as readonly string[]).includes(text) ? (text as EnergyLevel) : fallback;
}

/**
 * Mirror of the backend guard. Network data is never trusted: if a field is
 * missing or nonsense, fall back to something the UI can render.
 */
function asMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(asText(value));
  if (!Number.isFinite(parsed)) return 20;
  const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, parsed));
  return Math.max(MIN_MINUTES, Math.round(clamped / 5) * 5);
}

function asDue(value: unknown): string | undefined {
  const text = asText(value).toLowerCase();
  if (text === 'today' || text === 'tomorrow' || text === 'next-week') return text;
  if (!ISO_DATE.test(text)) return undefined;

  // A model can guess a date from stale training data. A due date in the past
  // is noise, so drop it and let the user set one.
  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const limit = new Date(start.getTime() + 366 * 24 * 60 * 60 * 1000);
  return parsed >= start && parsed <= limit ? text : undefined;
}

function asSteps(value: unknown, title: string): string[] {
  const source = typeof value === 'string' ? value.split(/\n|;/) : Array.isArray(value) ? value : [];
  const steps: string[] = [];

  for (const entry of source) {
    const text =
      entry && typeof entry === 'object'
        ? asText((entry as Record<string, unknown>).text ?? (entry as Record<string, unknown>).step)
        : asText(entry);
    if (text) steps.push(text.slice(0, 120));
    if (steps.length >= 5) break;
  }

  // Micro-Step Guard: a task with no first step is a task that will not start.
  return steps.length > 0 ? steps : [`Start: ${title}`];
}

function normaliseTask(raw: unknown): PendingTask | null {
  const record = typeof raw === 'string' ? { title: raw } : raw;
  if (!record || typeof record !== 'object') return null;

  const fields = record as Record<string, unknown>;
  const title = asText(fields.title).slice(0, 140);
  if (!title) return null;

  return {
    id: makeId(),
    title,
    minutes: asMinutes(fields.minutes),
    energy: asLevel(fields.energy, 'medium'),
    priority: asLevel(fields.priority, 'medium') as Priority,
    due: asDue(fields.due),
    steps: asSteps(fields.steps, title),
  };
}

/** Send a brain dump to the backend and get back editable tasks. */
export async function fetchPlan(text: string): Promise<PlanResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new ApiError(`Could not reach the backend at ${API_URL}. Is it running?`);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Leave body null; the status check below produces the error.
  }

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).detail === 'string'
        ? ((body as Record<string, unknown>).detail as string)
        : `The backend returned ${response.status}.`;
    throw new ApiError(detail);
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const rawTasks = Array.isArray(payload.tasks) ? payload.tasks.slice(0, MAX_TASKS) : [];
  const tasks = rawTasks
    .map(normaliseTask)
    .filter((task): task is PendingTask => task !== null);

  return {
    tasks,
    breakdown: asText(payload.breakdown),
    model: asText(payload.model) || 'unknown',
  };
}

/**
 * Ask the backend what it is actually running. Never throws: the You screen
 * shows connection state, it does not fail because the server is down.
 */
export async function fetchHealth(timeoutMs = 6000): Promise<ApiHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
    if (!response.ok) throw new Error('not ok');

    const body = (await response.json()) as Record<string, unknown>;
    return {
      model: asText(body.model) || 'unknown',
      geminiConfigured: Boolean(body.gemini_configured),
      mockMode: Boolean(body.mock_mode),
      reachable: true,
    };
  } catch {
    return { model: 'unreachable', geminiConfigured: false, mockMode: false, reachable: false };
  } finally {
    clearTimeout(timer);
  }
}
