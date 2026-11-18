import { Platform } from 'react-native';

import type {
  CheckInApiResponse,
  ClarifyState,
  Energy,
  ParsedStep,
  StepsApiResponse,
  TaskKind,
} from '../types';
import { supabase } from './supabase';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8001',
    default: 'http://localhost:8001',
  })!;
// Gemini can take a while on a cold request. Anything shorter silently drops
// the live model and falls back to local parsing without telling the user.
const REQUEST_TIMEOUT_MS = Number(
  process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 60_000,
);

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
  return headers;
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 60_000,
  );
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

export interface CheckInContext {
  /** Recent turns only; the backend also caps these. */
  history?: Array<{ from: 'me' | 'bot'; text: string }>;
  /** A compact view of the current plan with task IDs, start times, and status. */
  tasks?: Array<{
    id?: string;
    title: string;
    dur: number;
    day: string;
    pri: number;
    start?: number | null;
    fixed?: boolean;
    done?: boolean;
    kind?: TaskKind;
    dueDate?: string | null;
  }>;
  plannedMinutes?: number;
  /** The user's local ISO date/time, so relative dates use their clock. */
  nowIso?: string;
  timezone?: string;
  scheduleGaps?: Array<{ start: string; end: string; dur: number }> | string;
  peakHours?: string;
  completionHistory?: string | { rate: number };
  pendingProposals?: Array<{
    index: number;
    key: string;
    title: string;
    dur: number;
    day: string;
    pri: number;
    start?: string | null;
    due?: string | null;
  }>;
  clarifyState?: ClarifyState | null;
  idempotencyKey?: string;
}

export async function requestCheckIn(
  text: string,
  energy: Energy,
  startH: number,
  endH: number,
  context?: CheckInContext,
): Promise<CheckInApiResponse | null> {
  const data = await postJson<CheckInApiResponse>('/plan/checkin', {
    text,
    energy,
    start_h: startH,
    end_h: endH,
    history: context?.history?.slice(-6).map((turn) => ({
      from: turn.from,
      text: turn.text.slice(0, 400),
    })),
    tasks: context?.tasks?.slice(0, 16).map((task) => ({
      id: task.id,
      title: task.title.slice(0, 80),
      dur: task.dur,
      day: task.day,
      pri: task.pri,
      start: task.start ?? null,
      fixed: task.fixed ?? false,
      done: task.done ?? false,
      kind: task.kind,
      dueDate: task.dueDate ?? null,
    })),
    planned_minutes: context?.plannedMinutes ?? 0,
    now: context?.nowIso,
    timezone: context?.timezone,
    schedule_gaps: context?.scheduleGaps,
    peak_hours: context?.peakHours,
    completion_history: context?.completionHistory,
    pending_proposals: context?.pendingProposals,
    clarify_state: context?.clarifyState,
    idempotency_key: context?.idempotencyKey,
  });
  if (!data || !Array.isArray(data.items)) return null;
  // An empty plan can still carry actions, a clarify turn, or chat reply.
  if (
    data.items.length === 0 &&
    !data.actions?.length &&
    data.intent !== 'clarify' &&
    !data.energy &&
    !data.reply?.trim()
  ) {
    return null;
  }
  return data;
}

export async function requestSteps(
  title: string,
  effort: string,
  dur = 45,
): Promise<StepsApiResponse | null> {
  const data = await postJson<StepsApiResponse>('/plan/steps', {
    title,
    effort: effort === 'high' ? 'high' : effort === 'low' ? 'low' : 'med',
    dur,
  });
  if (!data || !Array.isArray(data.steps)) return null;

  const steps = toSteps(data.steps);
  if (!steps.length) return null;
  return {
    steps,
    source: data.source === 'gemini' ? 'gemini' : 'offline',
    model: typeof data.model === 'string' ? data.model : null,
  };
}

export { API_URL };
