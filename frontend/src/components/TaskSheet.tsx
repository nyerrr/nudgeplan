import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clockFromMinutes,
  DURATIONS,
  fmtDuration,
  fmtTime,
  parseClock,
  validIsoDate,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { Day, Effort } from '../types';
import { Icon } from './Icon';
import { Button, Segmented } from './ui';

export function TaskSheet() {
  const {
    colors,
    state,
    sheetTaskId,
    closeTaskSheet,
    saveTask,
    deleteTask,
    breakIntoSteps,
    notify,
    go,
  } = useApp();
  const insets = useSafeAreaInsets();
  const visible = sheetTaskId !== undefined;
  const task =
    sheetTaskId != null
      ? state.tasks.find((item) => item.id === sheetTaskId)
      : undefined;

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(45);
  const [effort, setEffort] = useState<Effort>('med');
  const [day, setDay] = useState<Day>('today');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [startText, setStartText] = useState('');
  const [dueText, setDueText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (sheetTaskId === undefined) return;
    setTitle(task?.title ?? '');
    setDuration(task?.dur ?? 45);
    setEffort(task?.effort ?? 'med');
    setDay(task?.day ?? state.view);
    setPriority(task?.pri ?? 2);
    setStartText(
      task?.fixed && task?.start != null ? clockFromMinutes(task.start) : '',
    );
    setDueText(task?.dueDate ?? '');
    setError(null);
    setWorking(false);
    setConfirmingDelete(false);
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetTaskId]);

  const onSave = () => {
    const clean = title.trim();
    if (!clean) {
      setError('Give the task a name first.');
      return;
    }
    const start = startText.trim() ? parseClock(startText) : null;
    if (startText.trim() && start == null) {
      setError('Use a time like 14:30 or 6pm.');
      return;
    }
    const dueDate = dueText.trim() ? validIsoDate(dueText) : null;
    if (dueText.trim() && dueDate == null) {
      setError('Use a deadline like 2026-11-05.');
      return;
    }
    saveTask({
      id: task?.id ?? null,
      title: clean,
      dur: duration,
      effort,
      day,
      pri: priority,
      start,
      dueDate,
    });
  };

  const onBreakdown = async () => {
    if (!task) return;
    setWorking(true);
    const count = await breakIntoSteps(task.id);
    setWorking(false);
    closeTaskSheet();
    go('focus');
    notify(`Split into ${count} small steps.`);
  };

  const addToCalendar = () => {
    const dueDate = validIsoDate(dueText);
    if (!dueDate) {
      setError('Add a deadline like 2026-11-05 first.');
      return;
    }
    const [year, month, day] = dueDate.split('-').map(Number);
    const start = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const next = new Date(year, month - 1, day + 1);
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(next.getDate()).padStart(2, '0')}`;
    const label = title.trim() || 'NudgePlan deadline';
    const url =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(label)}` +
      `&dates=${start}/${end}` +
      `&details=${encodeURIComponent('Deadline from NudgePlan')}`;
    void Linking.openURL(url).catch(() =>
      notify('Could not open your calendar.', true),
    );
  };

  const confirmDelete = () => {
    if (!task) return;
    setConfirmingDelete(true);
  };

  const autoSlot =
    task && !task.fixed && task.start != null
      ? `Placed at ${fmtTime(task.start)} automatically. `
      : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeTaskSheet}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close task sheet"
          style={StyleSheet.absoluteFill}
          onPress={closeTaskSheet}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                paddingBottom: Math.max(22, insets.bottom + 14),
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.head}>
                <Text
                  style={[
                    type.semibold,
                    { color: colors.ink, fontSize: 18, fontFamily: fonts.bold },
                  ]}
                >
                  {task ? 'Edit task' : 'New task'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={closeTaskSheet}
                  style={[
                    styles.iconButton,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <Icon name="close" size={18} color={colors.ink} />
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Task
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                placeholder="What needs doing?"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    color: colors.ink,
                  },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Duration
              </Text>
              <View style={styles.chipWrap}>
                {DURATIONS.map((minutes) => {
                  const active = duration === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      aria-pressed={active}
                      onPress={() => setDuration(minutes)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? colors.brand
                            : colors.surface,
                          borderColor: active ? colors.brand : colors.line,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? colors.onBrand : colors.ink,
                          fontFamily: active ? fonts.bold : fonts.medium,
                          fontSize: 12.5,
                        }}
                      >
                        {fmtDuration(minutes)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Start time (optional)
              </Text>
              <TextInput
                value={startText}
                onChangeText={setStartText}
                placeholder="e.g. 14:30 or 6pm"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    color: colors.ink,
                  },
                ]}
              />
              <Text
                style={[
                  type.hint,
                  { color: colors.muted, marginTop: 8, fontFamily: fonts.regular },
                ]}
              >
                {autoSlot}
                Leave the time empty to let NudgePlan place it.
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Effort
              </Text>
              <Segmented
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'med', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                value={effort}
                onChange={setEffort}
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Day
              </Text>
              <Segmented
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'tomorrow', label: 'Tomorrow' },
                ]}
                value={day}
                onChange={setDay}
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Deadline (optional)
              </Text>
              <TextInput
                value={dueText}
                onChangeText={setDueText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    color: colors.ink,
                  },
                ]}
              />
              <Text
                style={[
                  type.hint,
                  { color: colors.muted, marginTop: 8, fontFamily: fonts.regular },
                ]}
              >
                Use this for an exam, appointment, or other fixed date.
              </Text>
              {validIsoDate(dueText) ? (
                <Button
                  small
                  ghost
                  icon="calendar-outline"
                  label="Add to calendar"
                  onPress={addToCalendar}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                />
              ) : null}

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>
                Priority
              </Text>
              <Segmented
                options={[
                  { value: 1, label: 'Low' },
                  { value: 2, label: 'Normal' },
                  { value: 3, label: 'High' },
                ]}
                value={priority}
                onChange={setPriority}
              />

              {error ? (
                <Text
                  style={{
                    color: colors.warn,
                    fontFamily: fonts.medium,
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <View style={styles.actions}>
                {confirmingDelete && task ? (
                  <View
                    accessibilityRole="alert"
                    style={[
                      styles.deleteConfirm,
                      { backgroundColor: colors.surface, borderColor: colors.line },
                    ]}
                  >
                    <Text style={[styles.deleteConfirmTitle, { color: colors.ink }]}>
                      Delete &quot;{task.title}&quot;?
                    </Text>
                    <View style={styles.deleteConfirmActions}>
                      <Button
                        small
                        ghost
                        label="Cancel"
                        onPress={() => setConfirmingDelete(false)}
                      />
                      <Button
                        small
                        label="Delete"
                        background={colors.warn}
                        foreground={colors.onWarn}
                        onPress={() => deleteTask(task.id)}
                      />
                    </View>
                  </View>
                ) : null}
                {task ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete task"
                    onPress={confirmDelete}
                    style={[
                      styles.deleteButton,
                      { borderColor: colors.warn },
                    ]}
                  >
                    <Icon name="trash-outline" size={18} color={colors.warn} />
                  </Pressable>
                ) : null}
                {task ? (
                  <Button
                    label={working ? 'Breaking it down...' : 'Break into steps'}
                    ghost
                    small
                    disabled={working}
                    onPress={() => void onBreakdown()}
                  />
                ) : null}
                {working ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Button label="Save" onPress={onSave} style={{ flex: 1 }} />
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    maxHeight: '94%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 5,
  },
  input: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 20,
  },
  deleteConfirm: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  deleteConfirmTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
