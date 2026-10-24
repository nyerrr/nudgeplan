import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EnergyStrip } from '../components/EnergyStrip';
import { Button, Card, Empty, Label, Meter, Segmented } from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import {
  availableMinutes,
  capacityPercent,
  dayLabel,
  fmtDuration,
  fmtHour,
  isPeak,
  peakHours,
  plannedMinutes,
  sortedTasks,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { Day } from '../types';

export function PlanScreen() {
  const { state, colors, setView, openTaskSheet, moveLoose } = useApp();
  const day = state.view;
  const list = sortedTasks(state.tasks, day);
  const placed = list.filter((task) => task.start != null);
  const loose = list.filter((task) => task.start == null);
  const percent = capacityPercent(state, day);
  const planned = plannedMinutes(state.tasks, day);
  const available = availableMinutes(state.startH, state.endH, state.energy);
  const peaks = peakHours(state.startH, state.endH, state.energy);
  const highEffort = placed.filter((task) => task.effort === 'high');
  const inPeak = highEffort.filter(
    (task) => task.start != null && isPeak(task.start, state),
  ).length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View>
          <Text style={[type.title, { color: colors.ink }]}>Plan</Text>
          <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
            {dayLabel(day === 'today' ? 0 : 1)}
          </Text>
        </View>
        <Button
          small
          icon="add"
          label="New task"
          onPress={() => openTaskSheet(null)}
        />
      </View>

      <Segmented<Day>
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
        ]}
        value={day}
        onChange={setView}
      />

      <Card style={{ marginTop: 14 }}>
        <View style={styles.spread}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.bold,
              fontSize: 14,
            }}
          >
            {fmtDuration(planned)} of {fmtDuration(available)}
          </Text>
          <View
            style={{
              backgroundColor: colors.accent,
              borderRadius: 99,
              paddingHorizontal: 9,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: colors.onAccent,
                fontFamily: fonts.semibold,
                fontSize: 11,
              }}
            >
              {percent}%
            </Text>
          </View>
        </View>
        <Meter
          percent={percent}
          color={percent > 100 ? colors.warn : colors.brand}
          track={colors.line}
          style={{ marginTop: 8 }}
        />
        <Text
          style={[
            type.label,
            {
              color: colors.muted,
              marginTop: 14,
              marginBottom: 8,
              fontFamily: fonts.semibold,
            },
          ]}
        >
          Your energy by hour
        </Text>
        <EnergyStrip />
        <Text
          style={[
            type.hint,
            {
              color: colors.muted,
              marginTop: 8,
              fontFamily: fonts.regular,
            },
          ]}
        >
          {peaks.length
            ? `Peak: ${fmtHour(peaks[0])} to ${fmtHour(peaks[peaks.length - 1] + 1)}. `
            : ''}
          {highEffort.length
            ? `${inPeak} of ${highEffort.length} high-effort tasks start in your peak.`
            : 'No high-effort tasks yet.'}
        </Text>
      </Card>

      <Label>Timeline</Label>
      {placed.length ? (
        <View style={styles.list}>
          {placed.map((task) => (
            <TaskRow key={task.id} task={task} withTime />
          ))}
        </View>
      ) : (
        <Card>
          <Empty style={{ paddingVertical: 18 }}>
            No tasks placed. Add one or check in.
          </Empty>
        </Card>
      )}

      {loose.length ? (
        <>
          <Label>Needs room</Label>
          <View style={styles.list}>
            {loose.map((task) => (
              <TaskRow key={task.id} task={task} withTime />
            ))}
          </View>
          <View style={styles.looseHint}>
            <Text
              style={[
                type.hint,
                { color: colors.muted, fontFamily: fonts.regular, flex: 1 },
              ]}
            >
              These do not fit your open hours.
            </Text>
            {day === 'today' ? (
              <Button
                small
                ghost
                label="Move to tomorrow"
                onPress={moveLoose}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  list: {
    gap: 8,
  },
  looseHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
});
