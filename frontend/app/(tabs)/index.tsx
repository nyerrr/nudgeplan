import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskCard } from '../../src/components/task';
import { Button, Card, Chip, ProgressBar, SectionHead, StatTile } from '../../src/components/ui';
import { formatMinutes, greetingFor, todayLabel } from '../../src/lib/time';
import { usePlan } from '../../src/store/PlanContext';
import { colors, energyColor, radius, spacing, type } from '../../src/theme';

const HOW_IT_WORKS = [
  { title: 'Dump it', body: 'Say it messy. One blob of text is fine.' },
  { title: 'Reality Check', body: 'See what actually fits the hours and energy you have.' },
  { title: 'Micro-steps', body: 'Every task shrinks until the first step is obvious.' },
];

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    todaysTasks,
    deferredTasks,
    plannedMinutes,
    capacityMinutes,
    overloadRatio,
    doneCount,
    progress,
    toggleTask,
    state,
  } = usePlan();

  const now = useMemo(() => new Date(), []);
  const overload = overloadRatio > 1;
  const remaining = Math.max(0, capacityMinutes - plannedMinutes);
  const energy = state.checkIn.energy;
  const isFresh = state.tasks.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greetingFor(now)}</Text>
          <Text style={styles.date}>{todayLabel(now)}</Text>
        </View>
        <View style={styles.energyBadge}>
          <View style={[styles.energyBar, { backgroundColor: energyColor(energy) }]} />
          <Text style={styles.energyText}>
            {energy === 'low' ? 'Low' : energy === 'high' ? 'Wired' : 'Steady'}
          </Text>
        </View>
      </View>

      {isFresh ? (
        <>
          <Card style={styles.hero}>
            <Text style={styles.heroIcon}>✳</Text>
            <Text style={styles.heroTitle}>Nothing on the plan yet</Text>
            <Text style={styles.heroBody}>
              Dump everything that is in your head. NudgePlan turns it into steps small enough
              to actually start.
            </Text>
            <Button
              label="Brain dump"
              size="lg"
              fullWidth
              style={styles.heroBtn}
              onPress={() => router.push('/dump')}
            />
          </Card>

          <SectionHead title="How it works" style={styles.sectionHead} />
          <Card style={styles.howCard}>
            {HOW_IT_WORKS.map((step, index) => (
              <View
                key={step.title}
                style={[styles.howRow, index > 0 && styles.howRowSpaced]}
              >
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{index + 1}</Text>
                </View>
                <View style={styles.howTextWrap}>
                  <Text style={styles.howTitle}>{step.title}</Text>
                  <Text style={styles.howBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          {/* Reality Check summary */}
          <Card style={styles.summary}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryHeadings}>
                <Text style={styles.summaryTitle}>
                  {overload ? 'More than you have time for' : "Today's plan fits"}
                </Text>
                <Text style={styles.summaryBody}>
                  {overload
                    ? `You're planning ${formatMinutes(plannedMinutes)} against ${formatMinutes(
                        capacityMinutes
                      )} of realistic capacity. Let's fix that.`
                    : `${formatMinutes(plannedMinutes)} planned, ${formatMinutes(
                        remaining
                      )} to spare.`}
                </Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <StatTile
                label="Planned"
                value={formatMinutes(plannedMinutes)}
                tone={overload ? 'danger' : 'neutral'}
              />
              <StatTile
                label="Capacity"
                value={formatMinutes(capacityMinutes)}
                tone="accent"
                style={styles.statGap}
              />
              <StatTile
                label="Done"
                value={`${doneCount}/${todaysTasks.length}`}
                tone={doneCount > 0 ? 'success' : 'neutral'}
                style={styles.statGap}
              />
            </View>

            <ProgressBar
              value={progress}
              tone={overload ? colors.warning : colors.accent}
              style={styles.progress}
            />

            {overload ? (
              <View style={styles.alert}>
                <Text style={styles.alertIcon}>⚠</Text>
                <Text style={styles.alertText}>
                  {formatMinutes(plannedMinutes - capacityMinutes)} over. Review the plan to see
                  what to move.
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Today's micro-steps */}
          <SectionHead
            title="Your steps"
            action="Edit plan"
            onAction={() => router.push('/plan')}
            style={styles.sectionHead}
          />

          {todaysTasks.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Everything is moved off today</Text>
              <Text style={styles.emptyBody}>
                Your tasks are waiting in the Plan tab under Later.
              </Text>
            </Card>
          ) : (
            todaysTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            ))
          )}

          {/* Deferred */}
          {deferredTasks.length > 0 ? (
            <View style={styles.deferredSection}>
              <SectionHead title="Moved off today" style={styles.sectionHead} />
              {deferredTasks.map((task) => (
                <View key={task.id} style={styles.deferredRow}>
                  <Chip label="deferred" tone="warning" />
                  <Text style={styles.deferredText} numberOfLines={1}>
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.ctaRow}>
            <Pressable
              style={({ pressed }) => [styles.ctaTap, pressed && styles.ctaPressed]}
              onPress={() => router.push('/reality-check')}
              accessibilityRole="button"
            >
              <View style={styles.ctaInner}>
                <Text style={styles.ctaIcon}>⚖</Text>
                <View style={styles.ctaTextWrap}>
                  <Text style={styles.ctaTitle}>Reality Check</Text>
                  <Text style={styles.ctaBody}>Adjust hours and energy</Text>
                </View>
                <Text style={styles.ctaChevron}>›</Text>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerLeft: { gap: 2 },
  greeting: { ...type.display, color: colors.text },
  date: { ...type.caption, color: colors.textMuted },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  energyBar: { width: 4, height: 12, borderRadius: 2 },
  energyText: { ...type.caption, color: colors.text },

  hero: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  heroIcon: {
    fontSize: 28,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  heroTitle: { ...type.heading, color: colors.text },
  heroBody: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },
  heroBtn: { marginTop: spacing.xl },

  howCard: { padding: spacing.lg },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  howRowSpaced: { marginTop: spacing.lg },
  howNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: { ...type.caption, color: colors.accent, fontWeight: '700' },
  howTextWrap: { flex: 1 },
  howTitle: { ...type.bodyStrong, color: colors.text },
  howBody: { ...type.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },

  summary: { marginBottom: spacing.xl },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryHeadings: { flex: 1 },
  summaryTitle: { ...type.heading, color: colors.text, marginBottom: 4 },
  summaryBody: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  statRow: { flexDirection: 'row', marginTop: spacing.lg },
  statGap: { marginLeft: spacing.sm },
  progress: { marginTop: spacing.md },

  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,184,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,77,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  alertIcon: { color: colors.warning, fontSize: 15 },
  alertText: { ...type.caption, color: colors.warning, flex: 1, lineHeight: 18 },

  sectionHead: { marginTop: spacing.sm },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
  },

  deferredSection: { marginTop: spacing.lg },
  deferredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  deferredText: { ...type.caption, color: colors.textMuted, flex: 1 },

  ctaRow: { marginTop: spacing.xl },
  ctaTap: { borderRadius: radius.lg },
  ctaPressed: { opacity: 0.7 },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ctaIcon: { fontSize: 20 },
  ctaTextWrap: { flex: 1 },
  ctaTitle: { ...type.bodyStrong, color: colors.text },
  ctaBody: { ...type.caption, color: colors.textMuted, marginTop: 1 },
  ctaChevron: { color: colors.textFaint, fontSize: 22 },
});
