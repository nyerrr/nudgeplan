import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { useApp } from '../state';
import { fonts, type } from '../theme';
import { fmtDuration, fmtTime } from '../lib/engine';
import type { Task } from '../types';
import { Icon } from './Icon';
import { EffortPill } from './ui';

export function TaskRow({
  task,
  withTime,
}: {
  task: Task;
  withTime?: boolean;
}) {
  const { colors, openTaskSheet, toggleTask } = useApp();
  const doneSteps = task.steps.filter((step) => step.done).length;

  const onCheck = (event: GestureResponderEvent) => {
    event.stopPropagation();
    toggleTask(task.id);
  };

  return (
    <View style={styles.row}>
      {withTime ? (
        <View style={styles.time}>
          {task.start != null ? (
            <>
              <Text style={[styles.timeText, { color: colors.muted }]}>
                {fmtTime(task.start).replace(' ', '\u00A0')}
              </Text>
              <Text style={[styles.timeSub, { color: colors.muted }]}>
                {fmtTime(task.start + task.dur).replace(' ', '\u00A0')}
              </Text>
            </>
          ) : (
            <Text style={[styles.timeText, { color: colors.muted }]}>
              No slot
            </Text>
          )}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={() => openTaskSheet(task.id)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          aria-checked={task.done}
          accessibilityLabel={`Mark done: ${task.title}`}
          onPress={onCheck}
          style={[
            styles.check,
            {
              borderColor: task.done ? colors.brand : colors.low,
              backgroundColor: task.done ? colors.brand : 'transparent',
            },
          ]}
        >
          <Icon
            name="checkmark"
            size={16}
            color={task.done ? colors.onBrand : 'transparent'}
          />
        </Pressable>

        <View style={styles.body}>
          <Text
            style={[
              styles.title,
              {
                color: task.done ? colors.muted : colors.ink,
                textDecorationLine: task.done ? 'line-through' : 'none',
              },
            ]}
          >
            {task.title}
          </Text>
          <View style={styles.meta}>
            <EffortPill effort={task.effort} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {fmtDuration(task.dur)}
            </Text>
            {task.steps.length ? (
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {doneSteps}/{task.steps.length} steps
              </Text>
            ) : null}
          </View>
        </View>
        <Icon name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  time: {
    width: 58,
    paddingTop: 13,
  },
  timeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  timeSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  card: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  metaText: {
    ...type.hint,
    fontFamily: fonts.regular,
  },
});
