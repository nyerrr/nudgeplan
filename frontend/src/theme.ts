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

const light: Palette = {
  bg: '#F3F5FF',
  glow: '#D5D9F8',
  surface: '#FFFFFF',
  surface2: '#EAEDFF',
  ink: '#0A1160',
  muted: '#5F6694',
  line: '#DEE1F6',
  brand: '#2433B8',
  onBrand: '#FFFFFF',
  accent: '#00BF9A',
  onAccent: '#00302A',
  warn: '#E5604D',
  onWarn: '#3A0B05',
  high: '#3D32C8',
  med: '#0A8F7C',
  low: '#8A90C7',
  bezel: '#0B0E3D',
  shadow: 'rgba(10,20,100,.18)',
  overlay: 'rgba(8,12,70,.45)',
};

const dark: Palette = {
  bg: '#0F133D',
  glow: '#2932A3',
  surface: '#191F66',
  surface2: '#222978',
  ink: '#F1F3FF',
  muted: '#BCC1EE',
  line: '#383F9C',
  brand: '#5A64FF',
  onBrand: '#FFFFFF',
  accent: '#37DCB8',
  onAccent: '#002A22',
  warn: '#FF9F90',
  onWarn: '#3A0B05',
  high: '#A5A0FF',
  med: '#37DCB8',
  low: '#969CD6',
  bezel: '#000000',
  shadow: 'rgba(0,0,0,.45)',
  overlay: 'rgba(3,6,35,.55)',
};

export const palettes: Record<ResolvedTheme, Palette> = { light, dark };

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
