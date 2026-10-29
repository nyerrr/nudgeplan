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
import { effortLabel, elevationStyle, fonts, radius, space, type } from '../theme';
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

/**
 * Section header + content. The trailing hairline rule gives each block a clear
 * visual boundary, which is what separates one card group from the next.
 */
export function Section({
  label,
  hint,
  action,
  children,
  style,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>
          {label}
        </Text>
        <View style={[styles.sectionRule, { backgroundColor: colors.line }]} />
        {hint ? (
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            {hint}
          </Text>
        ) : null}
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.line,
        },
        style,
      ]}
    />
  );
}

type CardTone = 'default' | 'muted' | 'accent' | 'warn';

export function Card({
  children,
  style,
  tone = 'default',
  padded = true,
  elevated = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
  padded?: boolean;
  elevated?: boolean;
}) {
  const { colors } = useApp();
  const background =
    tone === 'accent'
      ? colors.accent
      : tone === 'muted'
        ? colors.surface2
        : colors.surface;
  const border =
    tone === 'warn'
      ? colors.warn
      : tone === 'accent'
        ? colors.brand
        : colors.line;

  return (
    <View
      style={[
        styles.card,
        padded ? styles.cardPadded : null,
        { backgroundColor: background, borderColor: border },
        elevated ? elevationStyle(colors) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A single card that holds a list of rows. Rows are separated by hairlines
 * instead of each row becoming its own floating card.
 */
export function Group({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card padded={false} style={[{ overflow: 'hidden' }, style]}>
      {children}
    </Card>
  );
}

export function GroupRow({
  children,
  onPress,
  accessibilityLabel,
  last,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const base: StyleProp<ViewStyle> = [
    styles.groupRow,
    last
      ? null
      : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.65 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function Stat({
  value,
  label,
  tone = 'default',
}: {
  value: string;
  label: string;
  tone?: 'default' | 'accent';
}) {
  const { colors } = useApp();
  return (
    <Card tone={tone} style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          { color: tone === 'accent' ? colors.onAccent : colors.ink },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: tone === 'accent' ? colors.onAccent : colors.muted },
        ]}
      >
        {label}
      </Text>
    </Card>
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
      style={styles.toggleHit}
    >
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: checked ? colors.brand : colors.low },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { marginLeft: checked ? 23 : 3 },
          ]}
        />
      </View>
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
    marginTop: space.xxl,
    marginBottom: space.sm,
  },
  section: {
    marginTop: space.xxl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
    minHeight: 18,
  },
  sectionLabel: {
    ...type.label,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  sectionHint: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  sectionBody: {
    gap: space.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  cardPadded: {
    padding: space.lg,
  },
  groupRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingVertical: space.lg,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonSmall: {
    minHeight: 44,
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
    minHeight: 44,
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    paddingBottom: 12,
    alignSelf: 'flex-start',
  },
  toggleHit: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 99,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
});
