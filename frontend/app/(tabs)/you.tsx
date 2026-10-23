import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiHealth, fetchHealth } from '../../src/api/plan';
import { Button, Card, Chip, Divider, SectionHead } from '../../src/components/ui';
import { a11yState } from '../../src/lib/a11y';
import { usePlan } from '../../src/store/PlanContext';
import { colors, radius, spacing, type } from '../../src/theme';

const HOUR_OPTIONS = [1, 2, 3, 4, 6, 8];

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { state, setCheckIn, resetAll } = usePlan();

  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [morningBrief, setMorningBrief] = useState(true);
  const [weekendPace, setWeekendPace] = useState(false);

  // Ask the backend what it is actually running, so this screen never shows a
  // hardcoded model name that drifts away from the server.
  useEffect(() => {
    let active = true;
    fetchHealth().then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>You</Text>
      <Text style={styles.subtitle}>How NudgePlan should work for you</Text>

      {/* Profile */}
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>◆</Text>
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>Local profile</Text>
          <Text style={styles.profileEmail}>
            No account yet. Your tasks stay on this device.
          </Text>
        </View>
        {health ? (
          <Chip
            label={health.reachable ? 'Online' : 'Offline'}
            tone={health.reachable ? 'success' : 'danger'}
          />
        ) : null}
      </Card>

      {/* Defaults */}
      <SectionHead title="Your defaults" style={styles.sectionHead} />
      <Card style={styles.card}>
        <Text style={styles.fieldLabel}>TYPICAL HOURS PER DAY</Text>
        <View
          style={styles.hourRow}
          accessibilityRole="radiogroup"
          accessibilityLabel="Typical hours per day"
        >
          {HOUR_OPTIONS.map((hours) => {
            const active = hours === state.checkIn.hours;
            return (
              <Pressable
                key={hours}
                onPress={() => setCheckIn({ hours })}
                accessibilityRole="radio"
                {...a11yState({ checked: active })}
                style={[styles.hourChip, active && styles.hourChipOn]}
              >
                <Text style={[styles.hourChipText, active && styles.hourChipTextOn]}>
                  {hours}h
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Divider style={styles.divider} />

        <Text style={styles.fieldLabel}>USUAL ENERGY</Text>
        <View
          style={styles.energyRow}
          accessibilityRole="radiogroup"
          accessibilityLabel="Usual energy"
        >
          {(['low', 'medium', 'high'] as const).map((level) => {
            const active = level === state.checkIn.energy;
            return (
              <Pressable
                key={level}
                onPress={() => setCheckIn({ energy: level })}
                accessibilityRole="radio"
                {...a11yState({ checked: active })}
                style={[styles.energyChip, active && styles.energyChipOn]}
              >
                <Text style={[styles.energyChipText, active && styles.energyChipTextOn]}>
                  {level === 'low' ? 'Running low' : level === 'high' ? 'Wired' : 'Steady'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Notifications */}
      <SectionHead title="Notifications" style={styles.sectionHead} />
      <Card style={styles.card}>
        <SettingRow
          title="Daily reminder"
          body="Nudge me at 8am if today's plan isn't started"
          value={reminders}
          onChange={setReminders}
        />
        <Divider style={styles.divider} />
        <SettingRow
          title="Morning brief"
          body="A short summary of what's ahead"
          value={morningBrief}
          onChange={setMorningBrief}
        />
        <Divider style={styles.divider} />
        <SettingRow
          title="Gentler weekends"
          body="Suggest lighter plans on Saturday and Sunday"
          value={weekendPace}
          onChange={setWeekendPace}
        />
      </Card>

      {/* About */}
      <SectionHead title="About" style={styles.sectionHead} />
      <Card style={styles.card}>
        <AboutRow
          label="AI model"
          value={
            health === null
              ? 'Checking…'
              : health.reachable
                ? health.model
                : 'Backend not running'
          }
        />
        <Divider style={styles.divider} />
        <AboutRow
          label="Planner"
          value={
            health === null
              ? 'Checking…'
              : health.mockMode
                ? 'Offline fallback'
                : health.geminiConfigured
                  ? 'Gemini'
                  : 'No API key'
          }
        />
        <Divider style={styles.divider} />
        <AboutRow label="Version" value="0.2.0 (prototype)" />
      </Card>

      <View style={styles.resetWrap}>
        {confirmReset ? (
          <View style={styles.confirmRow}>
            <Button
              label="Keep my data"
              variant="secondary"
              onPress={() => setConfirmReset(false)}
              style={styles.confirmBtn}
            />
            <Button
              label="Clear everything"
              variant="danger"
              onPress={() => {
                resetAll();
                setConfirmReset(false);
              }}
              style={styles.confirmBtn}
            />
          </View>
        ) : (
          <Pressable
            style={styles.resetBtn}
            onPress={() => setConfirmReset(true)}
            accessibilityRole="button"
          >
            <Text style={styles.resetText}>Clear all tasks and settings</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function SettingRow({
  title,
  body,
  value,
  onChange,
}: {
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingBody}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  title: { ...type.display, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.heading, color: colors.accent },
  profileBody: { flex: 1 },
  profileName: { ...type.bodyStrong, color: colors.text },
  profileEmail: { ...type.caption, color: colors.textMuted, marginTop: 1, lineHeight: 18 },

  sectionHead: { marginTop: spacing.xl, marginBottom: spacing.md },
  card: { padding: spacing.lg },
  fieldLabel: { ...type.micro, color: colors.textFaint, marginBottom: spacing.md },

  hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hourChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hourChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  hourChipText: { ...type.caption, color: colors.textMuted },
  hourChipTextOn: { color: colors.white, fontWeight: '700' },

  energyRow: { flexDirection: 'row', gap: spacing.sm },
  energyChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  energyChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  energyChipText: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  energyChipTextOn: { color: colors.accent, fontWeight: '700' },

  divider: { marginVertical: spacing.lg },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingBody: { flex: 1 },
  settingTitle: { ...type.body, color: colors.text },
  settingSub: { ...type.caption, color: colors.textFaint, marginTop: 2, fontSize: 12 },

  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aboutLabel: { ...type.body, color: colors.textMuted },
  aboutValue: { ...type.caption, color: colors.text },

  resetWrap: { marginTop: spacing.xxl },
  resetBtn: { alignSelf: 'center', padding: spacing.md },
  resetText: { ...type.caption, color: colors.textFaint },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: { flex: 1 },
});
