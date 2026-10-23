import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TaskCard } from '../../src/components/task';
import { Button, Card, EmptyState } from '../../src/components/ui';
import { a11yState } from '../../src/lib/a11y';
import { formatMinutes } from '../../src/lib/time';
import { usePlan } from '../../src/store/PlanContext';
import { colors, radius, spacing, type, type Task } from '../../src/theme';

type Filter = 'all' | 'today' | 'later' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'later', label: 'Later' },
  { key: 'done', label: 'Done' },
];

export default function PlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, toggleTask, removeTasks } = usePlan();

  const [filter, setFilter] = useState<Filter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const visible = useMemo(() => {
    switch (filter) {
      case 'today':
        return state.tasks.filter((task) => !task.deferred);
      case 'later':
        return state.tasks.filter((task) => task.deferred);
      case 'done':
        return state.tasks.filter((task) => task.done);
      default:
        return state.tasks;
    }
  }, [state.tasks, filter]);

  const openCount = state.tasks.filter((task) => !task.done).length;
  const allVisibleSelected =
    visible.length > 0 && visible.every((task) => selected.has(task.id));
  const selectedMinutes = state.tasks
    .filter((task) => selected.has(task.id))
    .reduce((sum, task) => sum + task.minutes, 0);

  function leaveSelectMode() {
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
  }

  function toggleSelected(id: string) {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      for (const task of visible) {
        if (allVisibleSelected) next.delete(task.id);
        else next.add(task.id);
      }
      return next;
    });
  }

  function handleDelete() {
    if (selected.size === 0) return;

    // Two-step confirm: the first press asks, the second press deletes.
    // `Alert` is a no-op on react-native-web, so this stays in the UI.
    if (!confirming) {
      setConfirming(true);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    removeTasks(Array.from(selected));
    leaveSelectMode();
  }

  const count = selected.size;
  const taskWord = count === 1 ? 'task' : 'tasks';
  const deleteLabel =
    count === 0
      ? 'Select tasks to delete'
      : confirming
        ? `Delete ${count} ${taskWord}? Tap again`
        : `Delete ${count} ${taskWord}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Plan</Text>
            <Text style={styles.subtitle}>
              {openCount} open · {state.tasks.length} total
            </Text>
          </View>
          {state.tasks.length > 0 ? (
            <Pressable
              onPress={() => (selecting ? leaveSelectMode() : setSelecting(true))}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.selectBtn}
            >
              <Text style={styles.selectText}>{selecting ? 'Cancel' : 'Select'}</Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={styles.filters}
          accessibilityRole="radiogroup"
          accessibilityLabel="Filter tasks"
        >
          {FILTERS.map((option) => {
            const active = option.key === filter;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                accessibilityRole="radio"
                {...a11yState({ checked: active })}
                style={[styles.filter, active && styles.filterOn]}
              >
                <Text style={[styles.filterText, active && styles.filterTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selecting && visible.length > 0 ? (
          <Pressable
            onPress={toggleSelectAll}
            accessibilityRole="checkbox"
            {...a11yState({ checked: allVisibleSelected })}
            style={styles.selectAllRow}
          >
            <View style={[styles.selCircle, allVisibleSelected && styles.selCircleOn]}>
              {allVisibleSelected ? <Text style={styles.selTick}>✓</Text> : null}
            </View>
            <Text style={styles.selectAllText}>
              {allVisibleSelected ? 'Clear selection' : 'Select all shown'}
            </Text>
          </Pressable>
        ) : null}

        {visible.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="✓"
              title={
                state.tasks.length === 0
                  ? 'Your plan is empty'
                  : filter === 'done'
                    ? 'Nothing finished yet'
                    : 'Nothing here'
              }
              body={
                state.tasks.length === 0
                  ? 'Dump your brain and the tasks land here.'
                  : filter === 'done'
                    ? 'Completed tasks will show up here.'
                    : 'No tasks match this filter.'
              }
              action={state.tasks.length === 0 ? 'Brain dump' : undefined}
              onAction={state.tasks.length === 0 ? () => router.push('/dump') : undefined}
            />
          </Card>
        ) : selecting ? (
          visible.map((task) => (
            <SelectableRow
              key={task.id}
              task={task}
              selected={selected.has(task.id)}
              onPress={() => toggleSelected(task.id)}
            />
          ))
        ) : (
          visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onPress={() => router.push(`/task/${task.id}`)}
            />
          ))
        )}
      </ScrollView>

      {selecting ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.footerRow}>
            <Text style={styles.footerCount}>
              {count === 0
                ? 'Nothing selected'
                : `${count} ${taskWord} · ${formatMinutes(selectedMinutes)}`}
            </Text>
            <Text style={styles.footerHint}>Deleted tasks cannot be recovered</Text>
          </View>
          <Button
            label={deleteLabel}
            variant="danger"
            size="lg"
            fullWidth
            disabled={count === 0}
            onPress={handleDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------- selectable row */

function SelectableRow({
  task,
  selected,
  onPress,
}: {
  task: Task;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      {...a11yState({ checked: selected })}
      style={({ pressed }) => [
        styles.selRow,
        selected && styles.selRowOn,
        pressed && styles.selRowPressed,
      ]}
    >
      <View style={[styles.selCircle, selected && styles.selCircleOn]}>
        {selected ? <Text style={styles.selTick}>✓</Text> : null}
      </View>
      <View style={styles.selBody}>
        <Text
          style={[styles.selTitle, selected && styles.selTitleOn, task.done && styles.selTitleDone]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <Text style={styles.selMeta}>
          {formatMinutes(task.minutes)} · {task.energy} energy
          {task.done ? ' · done' : ''}
          {task.deferred ? ' · later' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleWrap: { flex: 1 },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4 },
  selectBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectText: { ...type.caption, color: colors.accent, fontWeight: '600' },

  filters: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  filter: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  filterOn: { backgroundColor: colors.surfaceRaised },
  filterText: { ...type.caption, color: colors.textFaint },
  filterTextOn: { color: colors.text, fontWeight: '700' },

  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  selectAllText: { ...type.caption, color: colors.textMuted },

  selRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  selRowOn: { borderColor: colors.danger, backgroundColor: 'rgba(255,107,107,0.07)' },
  selRowPressed: { opacity: 0.75 },
  selCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCircleOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  selTick: { color: colors.white, fontSize: 12, fontWeight: '900' },
  selBody: { flex: 1 },
  selTitle: { ...type.body, color: colors.text, lineHeight: 21 },
  selTitleOn: { color: colors.text },
  selTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  selMeta: { ...type.caption, color: colors.textFaint, marginTop: 2 },

  emptyCard: { alignItems: 'center' },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  footerCount: { ...type.caption, color: colors.text },
  footerHint: { ...type.micro, color: colors.textFaint, flexShrink: 1, textAlign: 'right' },
});
