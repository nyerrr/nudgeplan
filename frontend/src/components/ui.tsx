import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { a11yState } from '../lib/a11y';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  loading,
  fullWidth,
  size = 'md',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      {...a11yState({ disabled: !!isDisabled, busy: !!loading })}
      style={({ pressed }) => [
        styles.btn,
        size === 'lg' && styles.btnLg,
        variantStyles[variant].container,
        pressed && !isDisabled && variantStyles[variant].pressed,
        isDisabled && styles.btnDisabled,
        fullWidth && styles.btnFull,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.accent}
        />
      ) : (
        <Text style={[styles.btnLabel, variantStyles[variant].label, size === 'lg' && styles.btnLabelLg]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; pressed: ViewStyle; label: TextStyle }
> = {
  primary: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed },
    label: { color: colors.white },
  },
  secondary: {
    container: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
    pressed: { backgroundColor: colors.border },
    label: { color: colors.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surfaceRaised },
    label: { color: colors.accent },
  },
  danger: {
    container: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
    pressed: { backgroundColor: 'rgba(255,107,107,0.2)' },
    label: { color: colors.danger },
  },
};

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

/* -------------------------------------------------------------------- Chip */

export function Chip({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const tones = {
    neutral: { bg: colors.surfaceRaised, fg: colors.textMuted, border: colors.border },
    accent: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentBorder },
    success: { bg: 'rgba(74,222,128,0.12)', fg: colors.success, border: 'rgba(74,222,128,0.28)' },
    warning: { bg: 'rgba(255,184,77,0.12)', fg: colors.warning, border: 'rgba(255,184,77,0.28)' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'rgba(255,107,107,0.28)' },
  } as const;
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.chipLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- Checkbox */

export function Checkbox({
  checked,
  onToggle,
  disabled,
  size = 22,
}: {
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      disabled={disabled}
      {...a11yState({ checked, disabled: !!disabled })}
      onPress={(e) => {
        // The checkbox frequently sits inside a pressable card. Stop the
        // event so ticking a task does not also open the task.
        e.stopPropagation?.();
        onToggle?.();
      }}
      hitSlop={10}
      style={[
        styles.checkbox,
        { width: size, height: size, borderRadius: size / 3 },
        checked && styles.checkboxOn,
        disabled && styles.checkboxDisabled,
      ]}
    >
      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------- SectionHead */

export function SectionHead({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHead, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- StatTile */

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const tones = {
    neutral: colors.text,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    accent: colors.accent,
  } as const;
  return (
    <View style={[styles.statTile, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tones[tone] }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------- ProgressBar */

export function ProgressBar({
  value,
  tone = colors.accent,
  height = 6,
  style,
}: {
  value: number;
  tone?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }, style]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: tone,
        }}
      />
    </View>
  );
}

/* ----------------------------------------------------------------- Divider */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} style={styles.emptyAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnLg: { minHeight: 54, borderRadius: radius.lg },
  btnFull: { alignSelf: 'stretch' },
  btnDisabled: { opacity: 0.45 },
  btnLabel: { ...type.bodyStrong },
  btnLabelLg: { fontSize: 16 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPadded: { padding: spacing.lg },

  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipLabel: { ...type.micro },

  checkbox: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxDisabled: { opacity: 0.4 },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: '900', lineHeight: 16 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionAction: { ...type.caption, color: colors.accent },

  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { ...type.micro, color: colors.textFaint, textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  statSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  progressTrack: {
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    width: '100%',
  },

  divider: { height: 1, backgroundColor: colors.border },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  emptyBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  emptyAction: { marginTop: spacing.lg },
});
