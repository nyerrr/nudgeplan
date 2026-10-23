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

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
