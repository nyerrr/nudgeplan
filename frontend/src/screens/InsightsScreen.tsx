import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EnergyStrip } from '../components/EnergyStrip';
import { Card, Empty, Label } from '../components/ui';
import {
  capacityPercent,
  completionRate,
  dailySeries,
  fmtHour,
  peakHours,
  streakFromDays,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';

export function InsightsScreen() {
  const { state, colors } = useApp();
  const today = state.tasks.filter((task) => task.day === 'today');
  const done = today.filter((task) => task.done).length;
  const steps = state.tasks.reduce(
    (total, task) => total + task.steps.filter((step) => step.done).length,
    0,
  );
  const rate = today.length ? Math.round((done / today.length) * 100) : 0;
  const series = dailySeries(state, 7);
  const values = series.map((stat) => completionRate(stat));
  const days = series.map((stat) => {
    const [year, month, day] = stat.date.split('-').map(Number);
    const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  });
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
      showsVerticalScrollIndicator={false}
    >
      <Text style={[type.title, { color: colors.ink }]}>Insights</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
        Your actual progress over the last 7 days.
      </Text>

      <Card style={styles.takeaway}>
        <Text style={[styles.takeawayK, { color: colors.brand }]}>A QUICK READ</Text>
        <Text style={[styles.takeawayTitle, { color: colors.ink }]}>
          {today.length === 0
            ? 'Your plan is ready for its first signal.'
            : rate >= 70
              ? 'You are keeping a steady pace today.'
              : 'A smaller plan may help you finish more consistently.'}
        </Text>
        <Text style={[styles.takeawayBody, { color: colors.muted }]}>
          {today.length === 0
            ? 'Check in and complete a few small steps. NudgePlan will learn from what actually happens.'
            : 'Use these patterns as guidance, not a score. Adjust your workload when your energy changes.'}
        </Text>
      </Card>

      <View style={styles.tiles}>
        {tiles.slice(0, 2).map((tile) => (
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
      <View style={styles.secondarySummary}>
        <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 }}>
          {steps} small {steps === 1 ? 'step' : 'steps'} finished · {streak} day
          {streak === 1 ? '' : 's'} of check-ins
        </Text>
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
            No reality checks yet. Check in, move a task, or adjust your plan to start building a useful history.
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
  secondarySummary: {
    alignItems: 'center',
    marginTop: 8,
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
  takeaway: {
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3F8EFC',
  },
  takeawayK: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  takeawayTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 8,
  },
  takeawayBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
});
