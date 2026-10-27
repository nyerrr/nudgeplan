import { Platform } from 'react-native';

import type {
  CheckInApiResponse,
  Day,
  Effort,
  Energy,
  ParsedStep,
  ParsedTask,
  StepsApiResponse,
} from '../types';
import { supabase } from './supabase';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8001',
    default: 'http://localhost:8001',
  })!;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname === '[::1]' ||
      parsed.hostname === '10.0.2.2'
    );
  } catch {
    return false;
  }
}

if (!isLoopbackUrl(API_URL) && !API_URL.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL must use HTTPS outside local development.');
}

/**
 * The AI endpoints are gated by the user's Supabase token, not by a key baked
 * into the bundle. Guests have no token, so they get the offline planner.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Treat a broken session as "not signed in" and let the API refuse.
    }
  }
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  // A cold start on a free host can take 30s+; a shorter timeout used to make
  // the app silently fall back to offline planning.
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface BackendHealth {
  status: string;
  model: string;
  gemini_configured: boolean;
  mock_mode: boolean;
}

/** Used by Settings to show whether smart parsing is reachable. */
export async function checkBackend(): Promise<BackendHealth | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_URL}/health`, {
      headers: API_KEY ? { 'X-API-Key': API_KEY } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as BackendHealth;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// /ai/plan -> the shape the app's check-in screen expects
// ---------------------------------------------------------------------------

interface AiTask {
  title?: unknown;
  minutes?: unknown;
  energy?: unknown;
  priority?: unknown;
  due?: unknown;
  steps?: unknown;
}

interface AiPlanResponse {
  tasks?: unknown;
  breakdown?: unknown;
  model?: unknown;
}

interface AiStepsResponse {
  steps?: unknown;
  source?: unknown;
  model?: unknown;
}

function clampMinutes(value: unknown): number {
  const minutes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  return Math.max(5, Math.min(480, Math.round(minutes / 5) * 5));
}

function toEffort(energy: unknown): Effort {
  if (energy === 'high') return 'high';
  if (energy === 'low') return 'low';
  return 'med';
}

function toPriority(priority: unknown): 1 | 2 | 3 {
  if (priority === 'high') return 3;
  if (priority === 'low') return 1;
  return 2;
}

/** The app only has two buckets, so anything beyond today lands tomorrow. */
function toDay(due: unknown): Day {
  return typeof due === 'string' && due && due !== 'today' ? 'tomorrow' : 'today';
}

function toSteps(input: unknown): ParsedStep[] {
  if (!Array.isArray(input)) return [];
  const steps: ParsedStep[] = [];
  for (const entry of input) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text) steps.push({ text, min: 5, done: false });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { text?: unknown; min?: unknown };
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    if (!text) continue;
    const raw = typeof record.min === 'number' ? record.min : 5;
    const min = Number.isFinite(raw)
      ? Math.max(2, Math.min(30, Math.round(raw)))
      : 5;
    steps.push({ text, min, done: false });
  }
  return steps;
}

function toCheckInResponse(data: AiPlanResponse): CheckInApiResponse {
  const rawTasks = Array.isArray(data.tasks) ? (data.tasks as AiTask[]) : [];
  const items: ParsedTask[] = [];

  for (const task of rawTasks) {
    const title = typeof task.title === 'string' ? task.title.trim() : '';
    if (!title) continue;
    items.push({
      title,
      dur: clampMinutes(task.minutes),
      effort: toEffort(task.energy),
      day: toDay(task.due),
      pri: toPriority(task.priority),
      // The backend does not schedule; the app's planner does that locally.
      start: null,
      fixed: false,
      steps: toSteps(task.steps),
    });
  }

  return {
    items,
    energy: null,
    reply: typeof data.breakdown === 'string' ? data.breakdown : '',
    source: 'gemini',
    model: typeof data.model === 'string' ? data.model : null,
  };
}

export async function requestCheckIn(
  text: string,
  _energy: Energy,
  _startH: number,
  _endH: number,
): Promise<CheckInApiResponse | null> {
  const data = await postJson<AiPlanResponse>('/ai/plan', { text });
  if (!data) return null;
  const parsed = toCheckInResponse(data);
  return parsed.items.length ? parsed : null;
}

export async function requestSteps(
  title: string,
  effort: string,
): Promise<StepsApiResponse | null> {
  const data = await postJson<AiStepsResponse>('/ai/steps', {
    title,
    effort: effort === 'high' ? 'high' : effort === 'low' ? 'low' : 'med',
  });
  if (!data) return null;
  const steps = toSteps(data.steps);
  if (!steps.length) return null;
  return {
    steps,
    source: data.source === 'gemini' ? 'gemini' : 'offline',
    model: typeof data.model === 'string' ? data.model : null,
  };
}

export { API_URL };
