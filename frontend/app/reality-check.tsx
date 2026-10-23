import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EnergySelector } from '../src/components/task';
import { Button, Card, Chip, SectionHead, StatTile } from '../src/components/ui';
import { buildSuggestions, capacityMinutes } from '../src/lib/realityCheck';
import { a11yState } from '../src/lib/a11y';
import { formatMinutes } from '../src/lib/time';
import { usePlan } from '../src/store/PlanContext';
import { colors, energyColor, radius, spacing, type } from '../src/theme';

const HOUR_OPTIONS = [1, 2, 3, 4, 6, 8];

/** Share of capacity that can go to high-energy work before it is too much. */
const HIGH_ENERGY_SHARE = 0.6;

export default function RealityCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, setCheckIn, todaysTasks, plannedMinutes, updateTask } = usePlan();

  const [stage, setStage] = useState<'input' | 'result'>('input');
  const [moved, setMoved] = useState<{ id: string; title: string }[]>([]);

  const availableMinutes = state.checkIn.hours * 60;
  const capacity = useMemo(
    () => capacityMinutes(availableMinutes, state.checkIn.energy),
    [availableMinutes, state.checkIn.energy]
  );

  const overCapacity = plannedMinutes > capacity;

  const highEnergyLoad = todaysTasks
    .filter((task) => task.energy === 'high')
    .reduce((sum, task) => sum + task.minutes, 0);
  const energyOverspend = highEnergyLoad > capacity * HIGH_ENERGY_SHARE;

  const suggestions = useMemo(
    () => buildSuggestions(todaysTasks, availableMinutes, state.checkIn.energy),
    [todaysTasks, availableMinutes, state.checkIn.energy]
  );

  const needsChange = overCapacity || energyOverspend;

  const suggestedMinutes = suggestions.reduce((sum, item) => sum + item.minutes, 0);
  const afterMinutes = Math.max(0, plannedMinutes - suggestedMinutes);

  function applySuggestion(taskId: string, title: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // "Move to later" is not a vague bucket: the task lands on tomorrow, so it
    // is still visible in the Plan tab instead of quietly disappearing.
    updateTask(taskId, { deferred: true, due: 'tomorrow' });
    setMoved((current) => [...current, { id: taskId, title }]);
  }

  function applyAll() {
    if (suggestions.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const item of suggestions) {
      updateTask(item.taskId, { deferred: true, due: 'tomorrow' });
    }
    setMoved((current) => [
      ...current,
      ...suggestions.map((item) => ({ id: item.taskId, title: item.title })),
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Reality Check</Text>
          <View style={styles.headerSpacer} />
        </View>
        {stage === 'input' ? (
          <>
            <Text style={styles.title}>What can you actually give today?</Text>
            <Text style={styles.subtitle}>
              Be honest. A plan that fits beats a plan that fails.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>{needsChange ? "That won't fit" : 'This fits'}</Text>
            <Text style={styles.subtitle}>
              {!needsChange
                ? 'Your plan fits the time and energy you have.'
                : overCapacity
                  ? `You have ${formatMinutes(plannedMinutes)} of tasks but only ${formatMinutes(
                      capacity
                    )} available. Here is what to move.`
                  : 'The hours fit, but too much of it needs your best focus. Here is what to move.'}
            </Text>
          </>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {stage === 'input' ? (
          <>
            <Text style={styles.label}>HOURS AVAILABLE</Text>
            <View
              style={styles.hourRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Hours available today"
            >
              {HOUR_OPTIONS.map((hours) => {
                const active = hours === state.checkIn.hours;
                return (
                  <Pressable
                    key={hours}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCheckIn({ hours });
                    }}
                    accessibilityRole="radio"
                    {...a11yState({ checked: active })}
                    style={[styles.hourOption, active && styles.hourOptionOn]}
                  >
                    <Text style={[styles.hourValue, active && styles.hourValueOn]}>{hours}</Text>
                    <Text style={[styles.hourUnit, active && styles.hourValueOn]}>h</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>ENERGY RIGHT NOW</Text>
            <EnergySelector
              value={state.checkIn.energy}
              onChange={(energy) => setCheckIn({ energy })}
            />

            <Card style={styles.capacityCard}>
              <View style={styles.capacityHead}>
                <Text style={styles.capacityTitle}>Today's capacity</Text>
                <View
                  style={[styles.capacityDot, { backgroundColor: energyColor(state.checkIn.energy) }]}
                />
              </View>
              <Text style={styles.capacityBody}>
                With {state.checkIn.hours}h and{' '}
                {state.checkIn.energy === 'low'
                  ? 'low'
                  : state.checkIn.energy === 'high'
                    ? 'high'
                    : 'medium'}{' '}
                energy, you can realistically take on about{' '}
                <Text style={styles.capacityStrong}>{formatMinutes(capacity)}</Text> of focused
                work.
              </Text>
              <View style={styles.capacityStatRow}>
                <StatTile
                  label="Planned"
                  value={formatMinutes(plannedMinutes)}
                  tone={overCapacity ? 'danger' : 'neutral'}
                />
                <StatTile
                  label="Capacity"
                  value={formatMinutes(capacity)}
                  tone="accent"
                  style={styles.statGap}
                />
              </View>
            </Card>

            {todaysTasks.length === 0 ? (
              <Text style={styles.noTasks}>
                There is nothing to check yet. Add a few tasks first.
              </Text>
            ) : null}

            <Button
              label="Check my plan"
              size="lg"
              fullWidth
              style={styles.checkBtn}
              disabled={todaysTasks.length === 0}
              onPress={() => setStage('result')}
            />
          </>
        ) : (
          <>
            {needsChange ? (
              <>
                {suggestions.length > 0 ? (
                  <>
                    <SectionHead title="Suggested changes" style={styles.sectionHead} />
                    {suggestions.map((suggestion) => (
                      <Card key={suggestion.id} style={styles.suggestionCard}>
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <View style={styles.issueRow}>
                          <Text style={styles.issueFlag}>●</Text>
                          <Text style={styles.issueText}>{suggestion.issue}</Text>
                        </View>
                        <Text style={styles.suggestionBody}>{suggestion.suggestion}</Text>
                        <Button
                          label="Move to tomorrow"
                          size="md"
                          style={styles.suggestionBtn}
                          onPress={() =>
                            applySuggestion(suggestion.taskId, suggestion.title)
                          }
                        />
                      </Card>
                    ))}

                    <View style={styles.projection}>
                      <Text style={styles.projectionLabel}>AFTER THESE MOVES</Text>
                      <Text style={styles.projectionValue}>
                        {formatMinutes(afterMinutes)} planned against {formatMinutes(capacity)}
                        {afterMinutes <= capacity ? ' · fits' : ''}
                      </Text>
                    </View>

                    {suggestions.length > 1 ? (
                      <Button
                        label={`Move all ${suggestions.length} to tomorrow`}
                        variant="secondary"
                        size="md"
                        fullWidth
                        style={styles.applyAllBtn}
                        onPress={applyAll}
                      />
                    ) : null}
                  </>
                ) : (
                  <Card style={styles.hardLimitCard}>
                    <Text style={styles.hardLimitIcon}>⏳</Text>
                    <Text style={styles.hardLimitTitle}>Everything here is due today</Text>
                    <Text style={styles.hardLimitBody}>
                      Nothing can be moved without dropping something with a real deadline.
                      Add an hour, or split one task into something smaller.
                    </Text>
                  </Card>
                )}
              </>
            ) : (
              <Card style={styles.allGoodCard}>
                <Text style={styles.allGoodIcon}>✓</Text>
                <Text style={styles.allGoodTitle}>Nothing to change</Text>
                <Text style={styles.allGoodBody}>
                  {todaysTasks.length} tasks fit into {formatMinutes(capacity)} of realistic
                  capacity.
                </Text>
              </Card>
            )}

            {moved.length > 0 ? (
              <View style={styles.movedSection}>
                <Text style={styles.movedLabel}>MOVED TO TOMORROW</Text>
                {moved.map((task) => (
                  <View key={task.id} style={styles.movedRow}>
                    <Chip label="moved" tone="success" />
                    <Text style={styles.movedText} numberOfLines={1}>
                      {task.title}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Button
              label="Apply and see my plan"
              size="lg"
              fullWidth
              style={styles.checkBtn}
              onPress={() => {
                // Close the modal stack back to the tab navigator, then switch
                // that navigator to Today. Using `replace` here would push a
                // second copy of the tab navigator onto the stack.
                router.dismissAll();
                router.navigate('/');
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...type.bodyStrong, color: colors.text },
  headerSpacer: { width: 52 },
  cancel: { ...type.caption, color: colors.accent, width: 52 },
  title: { ...type.title, color: colors.text, marginTop: spacing.lg },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4, lineHeight: 19 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  label: {
    ...type.micro,
    color: colors.textFaint,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  hourOption: {
    width: 62,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  hourOptionOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  hourValue: { fontSize: 19, fontWeight: '700', color: colors.text },
  hourValueOn: { color: colors.white },
  hourUnit: { ...type.caption, color: colors.textFaint, marginTop: -2 },

  capacityCard: { marginTop: spacing.xl },
  capacityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capacityTitle: { ...type.heading, color: colors.text },
  capacityDot: { width: 9, height: 9, borderRadius: 5 },
  capacityBody: { ...type.caption, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  capacityStrong: { color: colors.text, fontWeight: '700' },
  capacityStatRow: { flexDirection: 'row', marginTop: spacing.lg },
  statGap: { marginLeft: spacing.sm },

  noTasks: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  checkBtn: { marginTop: spacing.xl },

  sectionHead: { marginBottom: spacing.md },
  suggestionCard: { marginBottom: spacing.md },
  suggestionTitle: { ...type.bodyStrong, color: colors.text },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  issueFlag: { color: colors.warning, fontSize: 8 },
  issueText: { ...type.caption, color: colors.warning, flex: 1 },
  suggestionBody: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  suggestionBtn: { marginTop: spacing.lg, alignSelf: 'flex-start' },

  projection: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  projectionLabel: { ...type.micro, color: colors.textFaint },
  projectionValue: { ...type.caption, color: colors.text, marginTop: 4 },
  applyAllBtn: { marginTop: spacing.md },

  hardLimitCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  hardLimitIcon: { fontSize: 26, marginBottom: spacing.md },
  hardLimitTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  hardLimitBody: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 300,
  },

  allGoodCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  allGoodIcon: {
    fontSize: 26,
    color: colors.success,
    marginBottom: spacing.md,
    width: 52,
    height: 52,
    lineHeight: 50,
    textAlign: 'center',
    borderRadius: 26,
    backgroundColor: 'rgba(74,222,128,0.12)',
    overflow: 'hidden',
  },
  allGoodTitle: { ...type.heading, color: colors.text },
  allGoodBody: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },

  movedSection: { marginTop: spacing.xl },
  movedLabel: { ...type.micro, color: colors.textFaint, marginBottom: spacing.md },
  movedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  movedText: { ...type.caption, color: colors.textMuted, flex: 1 },
});
