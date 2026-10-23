import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '../components/Icon';
import { Button, Card, Empty, Label, Meter } from '../components/ui';
import {
  fmtDuration,
  fmtTimer,
  sortedTasks,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';

export function FocusScreen() {
  const {
    state,
    colors,
    setFocus,
    timer,
    timerToggle,
    timerReset,
    timerSkip,
    syncTimer,
    toggleStep,
    makeSmaller,
    addStep,
    breakIntoSteps,
    notify,
  } = useApp();
  const [stepText, setStepText] = useState('');
  const [breaking, setBreaking] = useState(false);

  const candidates = sortedTasks(state.tasks, 'today').filter(
    (task) => !task.done,
  );
  const selected =
    candidates.find((task) => task.id === state.focusId) ??
    candidates.find((task) => task.steps.length) ??
    candidates[0] ??
    null;

  const currentStep = selected?.steps.find((step) => !step.done) ?? null;
  const doneSteps = selected
    ? selected.steps.filter((step) => step.done).length
    : 0;

  useEffect(() => {
    if (!selected) return;
    if (currentStep) {
      syncTimer(currentStep.id, currentStep.min * 60);
    } else if (timer.stepId) {
      timerReset('', 600);
    }
    // Only react when the selected task or current step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, currentStep?.id]);

  const breakdown = async () => {
    if (!selected) return;
    setBreaking(true);
    const count = await breakIntoSteps(selected.id);
    setBreaking(false);
    notify(`Split into ${count} small steps.`);
  };

  const submitStep = () => {
    if (!selected || !stepText.trim()) return;
    addStep(selected.id, stepText);
    setStepText('');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[type.title, { color: colors.ink }]}>Focus</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
        One small step at a time.
      </Text>

      {!selected ? (
        <Card style={{ marginTop: 18 }}>
          <Empty>No open tasks today. Check in to add some.</Empty>
        </Card>
      ) : (
        <View style={{ marginTop: 14 }}>
          <View style={styles.pickerHead}>
            <Label style={{ marginTop: 0 }}>Choose a task</Label>
            <Text
              style={{
                color: colors.muted,
                fontFamily: fonts.regular,
                fontSize: 12.5,
              }}
            >
              {candidates.length} open
            </Text>
          </View>
          <View style={styles.picker}>
            {candidates.map((task) => {
              const active = task.id === selected.id;
              return (
                <Pressable
                  key={task.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  aria-selected={active}
                  accessibilityLabel={`Focus on ${task.title}`}
                  onPress={() => setFocus(task.id)}
                  style={[
                    styles.pickChip,
                    {
                      backgroundColor: active ? colors.brand : colors.surface,
                      borderColor: active ? colors.brand : colors.line,
                    },
                  ]}
                >
                  <Icon
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={active ? colors.onBrand : colors.muted}
                  />
                  <Text
                    style={{
                      color: active ? colors.onBrand : colors.ink,
                      fontFamily: fonts.medium,
                      fontSize: 12.5,
                    }}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Card style={{ marginTop: 14 }}>
            <View style={styles.spread}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.bold,
                  fontSize: 14,
                  flex: 1,
                }}
              >
                {selected.title}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.medium,
                  fontSize: 12,
                }}
              >
                {fmtDuration(selected.dur)}
              </Text>
            </View>

            {!selected.steps.length ? (
              <>
                <Text
                  style={[
                    type.hint,
                    {
                      color: colors.muted,
                      fontFamily: fonts.regular,
                      marginTop: 8,
                      marginBottom: 12,
                    },
                  ]}
                >
                  Stuck or dreading it? The Micro-Step Guard splits it into steps
                  of 10 minutes or less.
                </Text>
                {breaking ? (
                  <View style={styles.working}>
                    <ActivityIndicator color={colors.brand} />
                    <Text
                      style={{
                        color: colors.muted,
                        fontFamily: fonts.regular,
                        fontSize: 13,
                      }}
                    >
                      Breaking it down...
                    </Text>
                  </View>
                ) : (
                  <Button
                    block
                    icon="footsteps-outline"
                    label="Break it down"
                    onPress={() => void breakdown()}
                  />
                )}
              </>
            ) : (
              <>
                <Meter
                  percent={(doneSteps / selected.steps.length) * 100}
                  color={colors.accent}
                  track={colors.line}
                  style={{ marginTop: 10 }}
                />
                <Text
                  style={[
                    type.hint,
                    {
                      color: colors.muted,
                      fontFamily: fonts.regular,
                      marginTop: 6,
                    },
                  ]}
                >
                  {doneSteps} of {selected.steps.length} steps done
                </Text>
              </>
            )}
          </Card>

          {selected.steps.length && currentStep ? (
            <>
              <Card style={[styles.timerCard, { marginTop: 12 }]}>
                <Text
                  style={[
                    type.sub,
                    { color: colors.muted, textAlign: 'center' },
                  ]}
                >
                  Step {doneSteps + 1} of {selected.steps.length}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                    textAlign: 'center',
                    marginTop: 2,
                  }}
                >
                  {currentStep.text}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.light,
                    fontSize: 56,
                    lineHeight: 62,
                    letterSpacing: -1.1,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                    marginTop: 6,
                    marginBottom: 12,
                  }}
                >
                  {fmtTimer(timer.secs)}
                </Text>
                <View style={styles.timerActions}>
                  <Button
                    small
                    icon={timer.running ? 'pause' : 'play'}
                    label={timer.running ? 'Pause' : 'Start'}
                    onPress={timerToggle}
                  />
                  <Button
                    small
                    ghost
                    label="Reset"
                    onPress={() =>
                      timerReset(currentStep.id, currentStep.min * 60)
                    }
                  />
                  <Button
                    small
                    ghost
                    label="Skip 1 min"
                    onPress={timerSkip}
                  />
                </View>
                <View style={[styles.timerActions, { marginTop: 10 }]}>
                  <Button
                    small
                    icon="checkmark"
                    label="Done with this step"
                    onPress={() => toggleStep(selected.id, currentStep.id)}
                  />
                  <Button
                    small
                    ghost
                    label="Make it smaller"
                    onPress={() => makeSmaller(selected.id)}
                  />
                </View>
              </Card>

              <Label>Steps</Label>
              <View style={styles.steps}>
                {selected.steps.map((step) => {
                  const current = step.id === currentStep.id;
                  return (
                    <View
                      key={step.id}
                      style={[
                        styles.step,
                        {
                          backgroundColor: colors.surface,
                          borderColor: current ? colors.brand : colors.line,
                          borderWidth: current ? 1.5 : 1,
                        },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: step.done }}
                        aria-checked={step.done}
                        accessibilityLabel={`Toggle step: ${step.text}`}
                        onPress={() => toggleStep(selected.id, step.id)}
                        style={[
                          styles.check,
                          {
                            borderColor: step.done
                              ? colors.brand
                              : colors.low,
                            backgroundColor: step.done
                              ? colors.brand
                              : 'transparent',
                          },
                        ]}
                      >
                        <Icon
                          name="checkmark"
                          size={15}
                          color={step.done ? colors.onBrand : 'transparent'}
                        />
                      </Pressable>
                      <Text
                        style={{
                          flex: 1,
                          color: step.done ? colors.muted : colors.ink,
                          fontFamily: fonts.regular,
                          fontSize: 13.5,
                          textDecorationLine: step.done
                            ? 'line-through'
                            : 'none',
                        }}
                      >
                        {step.text}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontFamily: fonts.regular,
                          fontSize: 12,
                        }}
                      >
                        {step.min}m
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.addRow}>
                <TextInput
                  value={stepText}
                  onChangeText={setStepText}
                  onSubmitEditing={submitStep}
                  placeholder="Add your own step"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.brand}
                  style={[
                    styles.stepInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.line,
                      color: colors.ink,
                    },
                  ]}
                />
                <Button small label="Add" onPress={submitStep} />
              </View>
            </>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 11,
    maxWidth: '100%',
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  working: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  timerCard: {
    paddingVertical: 16,
  },
  timerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  steps: {
    gap: 6,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  stepInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
});
