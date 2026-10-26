import React from 'react';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useApp } from '../state';
import { effortLabel, fonts, type } from '../theme';
import type { Effort } from '../types';
import { Icon, type IoniconName } from './Icon';

export function Label({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useApp();
  return (
    <Text style={[styles.label, type.label, { color: colors.muted }, style]}>
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps {
  label?: string;
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  small?: boolean;
  block?: boolean;
  ghost?: boolean;
  danger?: boolean;
  icon?: IoniconName;
  background?: string;
  foreground?: string;
  outline?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  children,
  onPress,
  disabled,
  small,
  block,
  ghost,
  danger,
  icon,
  background,
  foreground,
  outline,
  style,
}: ButtonProps) {
  const { colors } = useApp();
  const bg = background ?? (ghost || danger ? 'transparent' : colors.brand);
  const fg =
    foreground ?? (danger ? colors.warn : ghost ? colors.brand : colors.onBrand);
  const border = outline ?? (danger ? colors.warn : ghost ? colors.brand : 'transparent');

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small ? styles.buttonSmall : null,
        block ? styles.buttonBlock : null,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: ghost || danger ? 1.5 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} /> : null}
      {label ? (
        <Text
          style={{
            color: fg,
            fontFamily: fonts.bold,
            fontSize: small ? 13 : 14,
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
    </Pressable>
  );
}

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: SegmentedProps<T>) {
  const { colors } = useApp();
  return (
    <View
      style={[
        styles.seg,
        { backgroundColor: colors.surface, borderColor: colors.line },
        style,
      ]}
    >
      {options.map((option) => {
        const active = String(option.value) === String(value);
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            aria-pressed={active}
            onPress={() => onChange(option.value)}
            style={[
              styles.segButton,
              active ? { backgroundColor: colors.brand } : null,
            ]}
          >
            <Text
              style={{
                color: active ? colors.onBrand : colors.muted,
                fontFamily: active ? fonts.bold : fonts.semibold,
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Meter({
  percent,
  color,
  track,
  height = 8,
  style,
}: {
  percent: number;
  color: string;
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();

  return (
    <View
      style={[
        styles.meter,
        {
          backgroundColor: track ?? colors.line,
          height,
          borderRadius: height,
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function EffortPill({ effort }: { effort: Effort }) {
  const { colors } = useApp();
  return (
    <View
      style={{
        backgroundColor: colors.accent,
        borderRadius: 99,
        paddingHorizontal: 9,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: colors.onAccent,
          fontFamily: fonts.semibold,
          fontSize: 11,
        }}
      >
        {effortLabel(effort)}
      </Text>
    </View>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={onChange}
      style={{
        width: 48,
        height: 28,
        borderRadius: 99,
        backgroundColor: checked ? colors.brand : colors.low,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#fff',
          marginLeft: checked ? 23 : 3,
        }}
      />
    </Pressable>
  );
}

export function Empty({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.empty, style]}>
      <Text
        style={[
          type.sub,
          { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function BackButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name="chevron-back" size={18} color={colors.brand} />
      <Text
        style={{
          color: colors.brand,
          fontFamily: fonts.semibold,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 22,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  buttonBlock: {
    width: '100%',
  },
  seg: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
  },
  segButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  meter: {
    overflow: 'hidden',
  },
  empty: {
    paddingVertical: 26,
    paddingHorizontal: 10,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 12,
    alignSelf: 'flex-start',
  },
});
