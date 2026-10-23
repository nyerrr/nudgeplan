import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  DuePicker,
  EnergySelector,
  MinutesInput,
  PrioritySelect,
  StepEditor,
} from '../../src/components/task';
import { Button, Card, Chip, Divider } from '../../src/components/ui';
import { a11yState } from '../../src/lib/a11y';
import { usePlan } from '../../src/store/PlanContext';
import { colors, radius, spacing, type } from '../../src/theme';

export default function TaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateTask, toggleTask, removeTask } = usePlan();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const task = state.tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.missing}>Task not found</Text>
        <Button label="Go back" onPress={() => router.back()} style={styles.missingBtn} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              updateTask(task.id, { deferred: !task.deferred });
            }}
            hitSlop={10}
          >
            <Text style={[styles.moveBtn, task.deferred && styles.moveBtnOn]}>
              {task.deferred ? 'Move to today' : 'Move to later'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{task.title}</Text>

        <View style={styles.chipRow}>
          <Chip
            label={`${task.energy} energy`}
            tone={task.energy === 'low' ? 'danger' : task.energy === 'high' ? 'success' : 'warning'}
          />
          <Chip label={`${task.priority} priority`} tone={task.priority === 'high' ? 'danger' : 'neutral'} />
          {task.deferred ? <Chip label="deferred" tone="warning" /> : null}
        </View>

        {/* Done toggle */}
        <Pressable
          style={[styles.doneRow, task.done && styles.doneRowOn]}
          onPress={() => toggleTask(task.id)}
          accessibilityRole="checkbox"
          {...a11yState({ checked: task.done })}
        >
          <View style={[styles.doneTick, task.done && styles.doneTickOn]}>
            {task.done ? <Text style={styles.doneTickMark}>✓</Text> : null}
          </View>
          <Text style={[styles.doneText, task.done && styles.doneTextOn]}>
            {task.done ? 'Done' : 'Mark as done'}
          </Text>
        </Pressable>

        <Divider style={styles.divider} />

        {/* Steps */}
        <Text style={styles.label}>MICRO-STEPS</Text>
        <Card style={styles.stepsCard}>
          <StepEditor steps={task.steps} onChange={(steps) => updateTask(task.id, { steps })} />
        </Card>
        <Text style={styles.hint}>
          The guard split this into steps small enough to start in under 10 minutes.
        </Text>

        <Divider style={styles.divider} />

        {/* Estimate */}
        <Text style={styles.label}>TIME ESTIMATE</Text>
        <MinutesInput value={task.minutes} onChange={(minutes) => updateTask(task.id, { minutes })} />

        <Text style={[styles.label, styles.labelSpaced]}>ENERGY NEEDED</Text>
        <EnergySelector
          value={task.energy}
          onChange={(energy) => updateTask(task.id, { energy })}
        />

        <Text style={[styles.label, styles.labelSpaced]}>PRIORITY</Text>
        <PrioritySelect
          value={task.priority}
          onChange={(priority) => updateTask(task.id, { priority })}
        />

        <Text style={[styles.label, styles.labelSpaced]}>DUE</Text>
        <DuePicker value={task.due} onChange={(due) => updateTask(task.id, { due })} />

        <Button
          label={confirmDelete ? 'Tap again to delete' : 'Delete task'}
          variant="danger"
          fullWidth
          style={styles.deleteBtn}
          onPress={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            removeTask(task.id);
            router.back();
          }}
        />
        {confirmDelete ? (
          <Text style={styles.deleteHint}>This removes the task from your plan.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  done: { ...type.caption, color: colors.accent },
  moveBtn: { ...type.caption, color: colors.textMuted },
  moveBtnOn: { color: colors.warning },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  title: { ...type.title, color: colors.text, lineHeight: 30 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md, flexWrap: 'wrap' },

  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  doneRowOn: { backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)' },
  doneTick: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTickOn: { backgroundColor: colors.success, borderColor: colors.success },
  doneTickMark: { color: colors.textInverse, fontSize: 13, fontWeight: '900' },
  doneText: { ...type.body, color: colors.text },
  doneTextOn: { color: colors.success },

  divider: { marginVertical: spacing.xl },

  label: { ...type.micro, color: colors.textFaint, marginBottom: spacing.md },
  labelSpaced: { marginTop: spacing.xl },

  stepsCard: { padding: spacing.md },
  hint: { ...type.caption, color: colors.textFaint, marginTop: spacing.sm, lineHeight: 18 },

  deleteBtn: { marginTop: spacing.xxl },
  deleteHint: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  missing: { ...type.heading, color: colors.text },
  missingBtn: { marginTop: spacing.lg },
});
