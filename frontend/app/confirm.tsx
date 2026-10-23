import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PendingTaskCard } from '../src/components/task';
import { Button, Card, Chip, EmptyState } from '../src/components/ui';
import { usePlan } from '../src/store/PlanContext';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * Task confirmation (Week 2).
 *
 * Shown after a brain dump so the user can accept, tune, or drop each
 * extracted task before it becomes their plan. Nothing is committed to the
 * plan until the user taps through.
 */
export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, updatePending, removePending, commitPending, clearPending } = usePlan();

  const pending = state.pending;
  const totalMinutes = pending.reduce((sum, t) => sum + t.minutes, 0);
  const highEnergy = pending.filter((t) => t.energy === 'high').length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              clearPending();
              router.back();
            }}
            hitSlop={10}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Confirm tasks</Text>
          <View style={styles.spacer} />
        </View>
        <Text style={styles.title}>Does this look right?</Text>
        <Text style={styles.subtitle}>
          {pending.length > 0
            ? 'Tap a task to tune it, or remove anything that is not real.'
            : 'Nothing new to confirm. These are the tasks already in your plan.'}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {pending.length > 0 ? (
          <>
            {state.lastPlan ? (
              <Card style={styles.planNote}>
                <View style={styles.planNoteTop}>
                  <Chip label={state.lastPlan.model} tone="accent" />
                </View>
                {state.lastPlan.breakdown ? (
                  <Text style={styles.planNoteBody}>{state.lastPlan.breakdown}</Text>
                ) : null}
              </Card>
            ) : null}

            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{pending.length}</Text>
                <Text style={styles.summaryLabel}>TASKS</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{totalMinutes}</Text>
                <Text style={styles.summaryLabel}>MINUTES</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, highEnergy > 0 && { color: colors.energyHigh }]}>
                  {highEnergy}
                </Text>
                <Text style={styles.summaryLabel}>HIGH ENERGY</Text>
              </View>
            </View>

            {pending.map((task) => (
              <PendingTaskCard
                key={task.id}
                task={task}
                onChange={(patch) => updatePending(task.id, patch)}
                onRemove={() => removePending(task.id)}
              />
            ))}
          </>
        ) : (
          <>
            {state.tasks.map((task) => (
              <Card key={task.id} style={styles.taskCard} padded={false}>
                <View style={styles.taskRow}>
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <View style={styles.taskMeta}>
                      <Chip label={`${task.minutes} min`} />
                      <Chip
                        label={`${task.energy} energy`}
                        tone={task.energy === 'low' ? 'danger' : 'neutral'}
                      />
                      {task.due ? <Chip label={`due ${task.due}`} tone="accent" /> : null}
                    </View>
                  </View>
                </View>
                {task.steps.length > 0 ? (
                  <View style={styles.taskSteps}>
                    {task.steps.map((s, i) => (
                      <Text key={i} style={styles.taskStep}>
                        · {s}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
            {state.tasks.length === 0 ? (
              <Card>
                <EmptyState
                  icon="✎"
                  title="Nothing to confirm"
                  body="Dump your brain first and the extracted tasks will show up here."
                />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {pending.length > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {pending.length} tasks · {totalMinutes} min
            </Text>
            <Text style={styles.totalHint}>Next: Reality Check</Text>
          </View>
        ) : null}
        <Button
          label={pending.length > 0 ? 'Add to my plan' : 'Reality Check my plan'}
          size="lg"
          fullWidth
          disabled={pending.length === 0 && state.tasks.length === 0}
          onPress={() => {
            if (pending.length > 0) commitPending();
            router.replace('/reality-check');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...type.bodyStrong, color: colors.text },
  cancel: { ...type.caption, color: colors.accent, width: 52 },
  spacer: { width: 52 },
  title: { ...type.title, color: colors.text, marginTop: spacing.lg },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4, lineHeight: 19 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  planNote: { padding: spacing.md, marginBottom: spacing.lg },
  planNoteTop: { flexDirection: 'row', marginBottom: spacing.sm },
  planNoteBody: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryStat: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  summaryValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  summaryLabel: { ...type.micro, color: colors.textFaint, marginTop: 2 },

  taskCard: { padding: spacing.md, marginBottom: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start' },
  taskMain: { flex: 1 },
  taskTitle: { ...type.body, color: colors.text, lineHeight: 21 },
  taskMeta: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  taskSteps: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  taskStep: { ...type.caption, color: colors.textFaint },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  totalLabel: { ...type.caption, color: colors.textMuted },
  totalHint: { ...type.caption, color: colors.textFaint },
});
