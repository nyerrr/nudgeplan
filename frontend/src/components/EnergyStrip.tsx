import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  energyAt,
  hoursForWindow,
  peaksForWindow,
  slotWindow,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts } from '../theme';
import type { Day } from '../types';

export function EnergyStrip({
  height = 64,
  day = 'today',
}: {
  height?: number;
  day?: Day;
}) {
  const { state, colors } = useApp();
  const { from, to } = slotWindow(day, state.startH, state.endH);
  const hours = hoursForWindow(from, to);
  const peaks = peaksForWindow(from, to, state.energy);

  return (
    <View style={[styles.strip, { height }]}>
      {hours.map((hour) => {
        const peak = peaks.includes(hour);
        const percent = Math.round(energyAt(hour, state.energy) * 0.8);
        return (
          <View key={hour} style={styles.column}>
            <View
              style={{
                width: '100%',
                height: `${percent}%`,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
                backgroundColor: peak ? colors.accent : colors.line,
              }}
            />
            <Text style={[styles.hour, { color: colors.muted }]}>
              {((hour + 11) % 12) + 1}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 3,
  },
  hour: {
    fontFamily: fonts.regular,
    fontSize: 10,
  },
});
