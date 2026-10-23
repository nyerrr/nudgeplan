import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EnergyStrip } from '../components/EnergyStrip';
import { Card, Empty, Label } from '../components/ui';
import {
  capacityPercent,
  fmtHour,
  peakHours,
  streakFromDays,
  weekdayLabel,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';

const SAMPLE_COMPLETION = [72, 85, 64, 90, 78, 100];

export function InsightsScreen() {
  const { state, colors } = useApp();
  const today = state.tasks.filter((task) => task.day === 'today');
  const done = today.filter((task) => task.done).length;
  const steps = state.tasks.reduce(
    (total, task) => total + task.steps.filter((step) => step.done).length,
    0,
  );
  const rate = today.length ? Math.round((done / today.length) * 100) : 0;
  const values = [...SAMPLE_COMPLETION, rate];
  const days = [6, 5, 4, 3, 2, 1, 0].map((offset) => weekdayLabel(-offset));
  const peaks = peakHours(state.startH, state.endH, state.energy);
  const streak = streakFromDays(state.checkins);

  const tiles = [
    { value: `${done}/${today.length}`, label: 'Done today' },
    { value: `${capacityPercent(state, 'today')}%`, label: 'Capacity today' },
    { value: String(steps), label: 'Micro-steps finished' },
    {
      value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
      label: 'Check-in streak',
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
    >
      <Text style={[type.title, { color: colors.ink }]}>Insights</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
        Six sample days plus today.
      </Text>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Card key={tile.label} style={styles.tile}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.bold,
                fontSize: 26,
                lineHeight: 29,
                fontVariant: ['tabular-nums'],
              }}
            >
              {tile.value}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontFamily: fonts.regular,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {tile.label}
            </Text>
          </Card>
        ))}
      </View>

      <Label>Completion by day</Label>
      <Card>
        <View style={styles.bars}>
          {values.map((value, index) => (
            <View key={`${days[index]}-${index}`} style={styles.barColumn}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 11,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {value}%
              </Text>
              <View
                style={{
                  width: '100%',
                  height: `${Math.max(4, value * 0.8)}%`,
                  backgroundColor:
                    index === values.length - 1
                      ? colors.accent
                      : colors.high,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                }}
              />
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 11,
                }}
              >
                {days[index]}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Label>Energy by hour</Label>
      <Card>
        <EnergyStrip height={84} />
        <Text
          style={[
            type.hint,
            {
              color: colors.muted,
              fontFamily: fonts.regular,
              marginTop: 8,
            },
          ]}
        >
          {peaks.length
            ? `Your peak is ${fmtHour(peaks[0])} to ${fmtHour(
                peaks[peaks.length - 1] + 1,
              )}. Heavy tasks go there first.`
            : 'Set your working hours to see your energy curve.'}
        </Text>
      </Card>

      <Label>Recent reality checks</Label>
      <Card style={styles.history}>
        {state.history.length ? (
          state.history.slice(0, 3).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 13,
                }}
              >
                {entry.when}
              </Text>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  flex: 1,
                  textAlign: 'right',
                }}
              >
                {entry.text}
              </Text>
            </View>
          ))
        ) : (
          <Empty style={{ paddingVertical: 18 }}>
            No reality checks yet. Move a task and it will show up here.
          </Empty>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 140,
    marginTop: 4,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  history: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
