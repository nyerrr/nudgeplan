import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EnergyStrip } from '../components/EnergyStrip';
import { Icon } from '../components/Icon';
import { Button, Card, Empty, Meter, Section, Segmented } from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import {
  availableMinutesFor,
  capacityPercent,
  dayLabel,
  fmtDuration,
  fmtHour,
  isPeak,
  peakHoursFor,
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
  const available = availableMinutesFor(
    day,
    state.startH,
    state.endH,
    state.energy,
  );
  const peaks = peakHoursFor(day, state.startH, state.endH, state.energy);
  const highEffort = placed.filter((task) => task.effort === 'high');
  const inPeak = highEffort.filter(
    (task) => task.start != null && isPeak(task.start, state, day),
  ).length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
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

      <Section label="Capacity">
        <Card>
          <View style={styles.spread}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 14 }}>
                {fmtDuration(planned)} planned · {fmtDuration(available)} available
              </Text>
              <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 4 }}>
                {percent > 100
                  ? 'Your day is overloaded. Move a few tasks before you start.'
                  : 'Your schedule leaves room for realistic progress.'}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: percent > 100 ? colors.warn : colors.accent,
                borderRadius: 99,
                paddingHorizontal: 9,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: percent > 100 ? colors.onWarn : colors.onAccent,
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
            style={{ marginTop: 10 }}
          />
        </Card>
      </Section>

      <Section
        label="Timeline"
        hint={placed.length ? `${placed.length} scheduled` : undefined}
      >
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
      </Section>

      {loose.length ? (
        <Section
          label="Needs a time"
          hint={`${loose.length} unscheduled`}
        >
          <View style={styles.list}>
            {loose.map((task) => (
              <TaskRow key={task.id} task={task} withTime />
            ))}
          </View>
          <View style={[styles.looseNote, { backgroundColor: colors.surface2 }]}>
            <Icon name="information-circle-outline" size={16} color={colors.brand} />
            <Text
              style={[
                type.hint,
                { color: colors.muted, fontFamily: fonts.regular, flex: 1 },
              ]}
            >
              These tasks do not fit in today&apos;s open hours.
            </Text>
          </View>
          {day === 'today' ? (
            <Button
              small
              ghost
              label="Move all to tomorrow"
              onPress={moveLoose}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </Section>
      ) : null}

      <Section label="Energy guidance">
        <Card>
          <EnergyStrip day={day} />
          <Text style={[type.hint, { color: colors.muted, marginTop: 8, fontFamily: fonts.regular }]}>
            {peaks.length
              ? `Peak: ${fmtHour(peaks[0])} to ${fmtHour(peaks[peaks.length - 1] + 1)}. `
              : ''}
            {highEffort.length
              ? `${inPeak} of ${highEffort.length} high-effort tasks start in your peak.`
              : 'No high-effort tasks yet.'}
          </Text>
        </Card>
      </Section>
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
    gap: 10,
  },
  looseNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
});
