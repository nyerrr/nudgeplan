import type { TextStyle } from 'react-native';

import type { Effort, ResolvedTheme } from './types';

export interface Palette {
  bg: string;
  glow: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  brand: string;
  onBrand: string;
  accent: string;
  onAccent: string;
  warn: string;
  onWarn: string;
  high: string;
  med: string;
  low: string;
  bezel: string;
  shadow: string;
  overlay: string;
}

const cleanMistLight: Palette = {
  bg: '#CFE8EF',
  glow: '#E8F7FA',
  surface: '#FFFFFF',
  surface2: '#C6DBF0',
  ink: '#060C5F',
  muted: '#545A88',
  line: '#AED1E6',
  brand: '#060C5F',
  onBrand: '#FFFFFF',
  accent: '#85C7DE',
  onAccent: '#060C5F',
  warn: '#B91C1C',
  onWarn: '#FFFFFF',
  high: '#A43E32',
  med: '#7D5C13',
  low: '#286644',
  bezel: '#AED1E6',
  shadow: 'rgba(6,12,95,.16)',
  overlay: 'rgba(6,12,95,.4)',
};

const cleanMistDark: Palette = {
  bg: '#0F172A',
  glow: '#1E293B',
  surface: '#1E293B',
  surface2: '#334155',
  ink: '#F3F4F6',
  muted: '#CBD5E1',
  line: '#64748B',
  brand: '#60A5FA',
  onBrand: '#0F172A',
  accent: '#93C5FD',
  onAccent: '#0F172A',
  warn: '#FCA5A5',
  onWarn: '#450A0A',
  high: '#60A5FA',
  med: '#93C5FD',
  low: '#94A3B8',
  bezel: '#020617',
  shadow: 'rgba(2,6,23,.45)',
  overlay: 'rgba(2,6,23,.72)',
};

export const palettes: Record<ResolvedTheme, Palette> = {
  light: cleanMistLight,
  dark: cleanMistDark,
};

export function paletteFor(mode: ResolvedTheme): Palette {
  return palettes[mode];
}

export const fonts = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export const type = {
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.24,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  } satisfies TextStyle,
  semibold: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  bold: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
};

export function effortColor(colors: Palette, effort: Effort): string {
  return effort === 'high' ? colors.high : effort === 'med' ? colors.med : colors.low;
}

export function effortLabel(effort: Effort): string {
  return effort === 'high' ? 'High' : effort === 'med' ? 'Medium' : 'Low';
}
