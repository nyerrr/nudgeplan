/**
 * NudgePlan design tokens.
 *
 * One dark theme, tuned for low-light evening use and for a focus app:
 * low chroma surfaces so task content is the only saturated thing on
 * screen, with energy/priority colour used sparingly as signal.
 */

export const colors = {
  // Surfaces, darkest to lightest
  bg: '#0B0D12',
  surface: '#141821',
  surfaceRaised: '#1C2029',
  surfaceInput: '#11141B',
  border: '#232833',
  borderStrong: '#313746',

  // Text
  text: '#F2F5F9',
  textMuted: '#98A1B0',
  textFaint: '#5D6675',
  textInverse: '#0B0D12',

  // Brand
  accent: '#6C8CFF',
  accentPressed: '#5A7BF0',
  accentSoft: 'rgba(108, 140, 255, 0.14)',
  accentBorder: 'rgba(108, 140, 255, 0.32)',

  // Energy scale - used for check-in and per-task energy load
  energyLow: '#FF6B6B',
  energyMedium: '#FFB84D',
  energyHigh: '#4ADE80',

  // Status
  success: '#4ADE80',
  warning: '#FFB84D',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',

  // Overlays
  scrim: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const type = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

/** Minimum comfortable touch target on mobile. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;

export const energyColor = (level: EnergyLevel) => {
  switch (level) {
    case 'low':
      return colors.energyLow;
    case 'high':
      return colors.energyHigh;
    default:
      return colors.energyMedium;
  }
};

export const priorityColor = (priority: Priority) => {
  switch (priority) {
    case 'high':
      return colors.danger;
    case 'medium':
      return colors.warning;
    default:
      return colors.textFaint;
  }
};

export type EnergyLevel = 'low' | 'medium' | 'high';
export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'done';

/** A task as the app understands it. */
export type Task = {
  id: string;
  title: string;
  /** Estimated minutes of focused work. */
  minutes: number;
  energy: EnergyLevel;
  priority: Priority;
  /** ISO date, e.g. "2026-10-22". */
  due?: string;
  /** Micro-steps. Present once the Micro-Step Guard has run. */
  steps: string[];
  done: boolean;
  /** True when the Reality Check moved this off today. */
  deferred?: boolean;
  note?: string;
};

/**
 * A task the user has seen but not yet committed to their plan.
 * The difference from `Task` is that pending tasks have no completion
 * state and no scheduling decisions yet.
 */
export type PendingTask = Omit<Task, 'done' | 'deferred'>;
