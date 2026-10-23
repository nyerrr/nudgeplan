import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, energyColor, priorityColor, radius, spacing, type, type EnergyLevel, type PendingTask, type Priority, type Task } from '../theme';
import { Card, Checkbox, Chip } from './ui';
import { a11yState } from '../lib/a11y';
import { formatDueLabel } from '../lib/time';

/* --------------------------------------------------------------- TaskCard */

export function TaskCard({
  task,
  onToggle,
  onPress,
  showEnergy = true,
}: {
  task: Task;
  onToggle?: () => void;
  onPress?: () => void;
  showEnergy?: boolean;
}) {
  const done = task.done;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={task.title}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={[styles.taskCard, done && styles.taskCardDone]} padded={false}>
        <View style={styles.taskTop}>
          <Checkbox checked={done} onToggle={onToggle} />
          <View style={styles.taskBody}>
            <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
              {task.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{task.minutes} min</Text>
              {task.due ? (
                <>
                  <View style={styles.metaDot} />
                  <Text style={styles.metaText}>due {formatDue(task.due)}</Text>
                </>
              ) : null}
              {task.priority !== 'low' ? (
                <>
                  <View style={styles.metaDot} />
                  <Text style={[styles.metaText, { color: priorityColor(task.priority) }]}>
                    {task.priority} priority
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {showEnergy ? <EnergyDot level={task.energy} /> : null}
        </View>

        {task.steps.length > 0 ? (
          <View style={styles.steps}>
            {task.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepBullet} />
                <Text style={styles.stepText} numberOfLines={1}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

/* ------------------------------------------------------------- EnergyDot */

export function EnergyDot({ level }: { level: EnergyLevel }) {
  return (
    <View
      style={[styles.energyDot, { backgroundColor: energyColor(level) }]}
      accessibilityLabel={`${level} energy`}
    />
  );
}

/* --------------------------------------------------------- EnergySelector */

const ENERGY_OPTIONS: { level: EnergyLevel; label: string; hint: string }[] = [
  { level: 'low', label: 'Running low', hint: 'Keep it tiny' },
  { level: 'medium', label: 'Steady', hint: 'Can hold focus' },
  { level: 'high', label: 'Wired', hint: 'Take on the hard thing' },
];

export function EnergySelector({
  value,
  onChange,
}: {
  value: EnergyLevel;
  onChange: (level: EnergyLevel) => void;
}) {
  return (
    <View
      style={styles.energyRow}
      accessibilityRole="radiogroup"
      accessibilityLabel="Energy level"
    >
      {ENERGY_OPTIONS.map((opt) => {
        const active = opt.level === value;
        const tint = energyColor(opt.level);
        return (
          <Pressable
            key={opt.level}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt.level);
            }}
            accessibilityRole="radio"
            {...a11yState({ checked: active })}
            style={[
              styles.energyOption,
              active && { borderColor: tint, backgroundColor: `${tint}1A` },
            ]}
          >
            <View style={[styles.energySwatch, { backgroundColor: tint }]} />
            <Text style={[styles.energyLabel, active && { color: colors.text }]}>{opt.label}</Text>
            <Text style={styles.energyHint}>{opt.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------- PrioritySelect */

export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <View
      style={styles.priorityRow}
      accessibilityRole="radiogroup"
      accessibilityLabel="Priority"
    >
      {(['low', 'medium', 'high'] as Priority[]).map((p) => {
        const active = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            {...a11yState({ checked: active })}
            style={[styles.priorityOption, active && styles.priorityOptionOn]}
          >
            <Text style={[styles.priorityLabel, active && styles.priorityLabelOn]}>
              {p[0].toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------- MinutesInput */

export function MinutesInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <View style={styles.minutesRow}>
      {[-15, -5, 5, 15].map((delta) => (
        <Pressable
          key={delta}
          onPress={() => {
            const next = Math.max(5, Math.min(480, value + delta));
            onChange(next);
          }}
          style={styles.minutesBtn}
        >
          <Text style={styles.minutesBtnLabel}>
            {delta > 0 ? `+${delta}` : delta}
          </Text>
        </Pressable>
      ))}
      <View style={styles.minutesValue}>
        <Text style={styles.minutesNumber}>{value}</Text>
        <Text style={styles.minutesUnit}>min</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- DuePicker */

export function DuePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (due?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: { label: string; value?: string }[] = [
    { label: 'No date', value: undefined },
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: 'Next week', value: 'next-week' },
  ];
  return (
    <View>
      <Pressable style={styles.dueBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.dueBtnLabel}>{value ? formatDue(value) : 'Set due date'}</Text>
        <Text style={styles.dueChevron}>▾</Text>
      </Pressable>
      {open ? (
        <View style={styles.dueMenu}>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={styles.dueMenuItem}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <Text style={styles.dueMenuLabel}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- StepEditor */

export function StepEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (index: number) => {
    setEditing(index);
    setDraft(steps[index]);
  };

  const commit = () => {
    if (editing === null) return;
    const next = [...steps];
    next[editing] = draft.trim() || next[editing];
    onChange(next);
    setEditing(null);
  };

  return (
    <View style={styles.stepEditor}>
      {steps.map((step, i) => (
        <View key={i} style={styles.stepEditorRow}>
          <View style={styles.stepBullet} />
          {editing === i ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={commit}
              onSubmitEditing={commit}
              autoFocus
              style={styles.stepInput}
              placeholderTextColor={colors.textFaint}
            />
          ) : (
            <Pressable style={styles.stepEditTarget} onPress={() => startEdit(i)}>
              <Text style={styles.stepText}>{step}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onChange(steps.filter((_, idx) => idx !== i))}
            hitSlop={8}
            accessibilityLabel={`Remove step ${step}`}
          >
            <Text style={styles.stepRemove}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        style={styles.stepAdd}
        onPress={() => {
          onChange([...steps, 'New step']);
          setEditing(steps.length);
          setDraft('');
        }}
      >
        <Text style={styles.stepAddLabel}>+ Add step</Text>
      </Pressable>
    </View>
  );
}

/* --------------------------------------------------------- PendingTaskCard */

/**
 * An extracted task the user is reviewing before it becomes part of their
 * plan. Everything is editable here - the point of the confirmation step
 * is that the user corrects the machine before committing.
 */
export function PendingTaskCard({
  task,
  onChange,
  onRemove,
}: {
  task: PendingTask;
  onChange: (patch: Partial<PendingTask>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.pendingCard} padded={false}>
      <View style={styles.pendingHead}>
        <TextInput
          style={styles.pendingTitle}
          value={task.title}
          onChangeText={(title) => onChange({ title })}
          placeholder="Task title"
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${task.title}`}>
          <Text style={styles.stepRemove}>×</Text>
        </Pressable>
      </View>

      <View style={styles.pendingChips}>
        <Chip label={`${task.minutes} min`} />
        <Chip
          label={`${task.energy} energy`}
          tone={task.energy === 'low' ? 'danger' : task.energy === 'high' ? 'success' : 'warning'}
        />
        <Chip
          label={`${task.priority} priority`}
          tone={task.priority === 'high' ? 'danger' : 'neutral'}
        />
        {task.due ? <Chip label={`due ${formatDue(task.due)}`} tone="accent" /> : null}
      </View>

      <Pressable
        style={styles.pendingToggle}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        {...a11yState({ expanded })}
      >
        <Text style={styles.pendingToggleText}>
          {expanded ? 'Hide details' : 'Tune this task'}
        </Text>
        <Text style={styles.pendingChevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.pendingBody}>
          <Text style={styles.pendingLabel}>TIME ESTIMATE</Text>
          <MinutesInput value={task.minutes} onChange={(minutes) => onChange({ minutes })} />

          <Text style={[styles.pendingLabel, styles.pendingLabelSpaced]}>ENERGY NEEDED</Text>
          <EnergySelector value={task.energy} onChange={(energy) => onChange({ energy })} />

          <Text style={[styles.pendingLabel, styles.pendingLabelSpaced]}>PRIORITY</Text>
          <PrioritySelect value={task.priority} onChange={(priority) => onChange({ priority })} />

          <Text style={[styles.pendingLabel, styles.pendingLabelSpaced]}>DUE</Text>
          <DuePicker value={task.due} onChange={(due) => onChange({ due })} />

          <Text style={[styles.pendingLabel, styles.pendingLabelSpaced]}>FIRST STEPS</Text>
          <StepEditor steps={task.steps} onChange={(steps) => onChange({ steps })} />
        </View>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------- formatting */

export function formatDue(due: string): string {
  return formatDueLabel(due);
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  taskCard: { padding: spacing.md, marginBottom: spacing.sm },
  taskCardDone: { opacity: 0.55, backgroundColor: colors.surfaceInput },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  taskBody: { flex: 1 },
  taskTitle: { ...type.bodyStrong, color: colors.text, lineHeight: 21 },
  taskTitleDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6, flexWrap: 'wrap' },
  metaText: { ...type.caption, color: colors.textMuted },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
  },

  steps: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 7,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  stepText: { ...type.caption, color: colors.textMuted, flex: 1 },

  energyDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },

  energyRow: { flexDirection: 'row', gap: spacing.sm },
  energyOption: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  energySwatch: { width: 16, height: 4, borderRadius: 2, marginBottom: 4 },
  energyLabel: { ...type.bodyStrong, color: colors.textMuted },
  energyHint: { ...type.caption, color: colors.textFaint, fontSize: 12 },

  priorityRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  priorityOption: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  priorityOptionOn: { backgroundColor: colors.accent },
  priorityLabel: { ...type.caption, color: colors.textMuted },
  priorityLabelOn: { color: colors.white, fontWeight: '700' },

  minutesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  minutesBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  minutesBtnLabel: { ...type.caption, color: colors.textMuted },
  minutesValue: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginLeft: 'auto' },
  minutesNumber: { fontSize: 24, fontWeight: '700', color: colors.text },
  minutesUnit: { ...type.caption, color: colors.textMuted },

  dueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dueBtnLabel: { ...type.body, color: colors.text },
  dueChevron: { color: colors.textFaint, fontSize: 12 },
  dueMenu: {
    marginTop: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dueMenuItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dueMenuLabel: { ...type.body, color: colors.text },

  stepEditor: { gap: spacing.sm },
  stepEditorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepEditTarget: { flex: 1 },
  stepRemove: { color: colors.textFaint, fontSize: 20, lineHeight: 22 },
  stepInput: {
    flex: 1,
    ...type.caption,
    color: colors.text,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepAdd: { paddingVertical: spacing.sm },
  stepAddLabel: { ...type.caption, color: colors.accent },

  pendingCard: { padding: spacing.md, marginBottom: spacing.sm },
  pendingHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pendingTitle: {
    flex: 1,
    ...type.body,
    color: colors.text,
    lineHeight: 21,
    minHeight: 24,
    paddingVertical: 0,
  },
  pendingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  pendingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pendingToggleText: { ...type.caption, color: colors.accent },
  pendingChevron: { color: colors.textFaint, fontSize: 11 },
  pendingBody: { marginTop: spacing.lg },
  pendingLabel: { ...type.micro, color: colors.textFaint, marginBottom: spacing.md },
  pendingLabelSpaced: { marginTop: spacing.xl },
});
