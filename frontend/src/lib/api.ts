import { Platform } from 'react-native';

import type {
  CheckInApiResponse,
  Energy,
  StepsApiResponse,
} from '../types';

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

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
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
  const timeout = setTimeout(() => controller.abort(), 4000);
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

export async function requestCheckIn(
  text: string,
  energy: Energy,
  startH: number,
  endH: number,
): Promise<CheckInApiResponse | null> {
  const data = await postJson<CheckInApiResponse>('/plan/checkin', {
    text,
    energy,
    start_h: startH,
    end_h: endH,
  });
  if (!data || !Array.isArray(data.items)) return null;
  return data;
}

export async function requestSteps(
  title: string,
  effort: string,
): Promise<StepsApiResponse | null> {
  const data = await postJson<StepsApiResponse>('/plan/steps', {
    title,
    effort,
  });
  if (!data || !Array.isArray(data.steps) || !data.steps.length) return null;
  return data;
}

export { API_URL };
