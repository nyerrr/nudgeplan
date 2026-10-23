import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state';
import { fonts } from '../theme';
import type { Screen } from '../types';
import { Icon, type IoniconName } from './Icon';

const TABS: Array<{ screen: Screen; label: string; icon: IoniconName }> = [
  { screen: 'home', label: 'Home', icon: 'home-outline' },
  { screen: 'plan', label: 'Plan', icon: 'calendar-outline' },
  { screen: 'focus', label: 'Focus', icon: 'disc-outline' },
  { screen: 'insights', label: 'Insights', icon: 'bar-chart-outline' },
];

export function TabBar() {
  const { colors, screen, go } = useApp();
  const insets = useSafeAreaInsets();

  const renderTab = (tab: (typeof TABS)[number]) => {
    const active = screen === tab.screen;
    return (
      <Pressable
        key={tab.screen}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        aria-selected={active}
        onPress={() => go(tab.screen)}
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon
          name={tab.icon}
          size={21}
          color={active ? colors.brand : colors.muted}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: active ? colors.brand : colors.muted,
              fontFamily: active ? fonts.bold : fonts.medium,
            },
          ]}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          paddingBottom: Math.max(10, insets.bottom),
        },
      ]}
    >
      {renderTab(TABS[0])}
      {renderTab(TABS[1])}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Check-in"
        accessibilityState={{ selected: screen === 'checkin' }}
        aria-selected={screen === 'checkin'}
        onPress={() => go('checkin')}
        style={({ pressed }) => [
          styles.add,
          {
            backgroundColor: colors.brand,
            opacity: pressed ? 0.85 : 1,
            ...(screen === 'checkin'
              ? { borderWidth: 3, borderColor: colors.bg }
              : null),
          },
        ]}
      >
        <Icon name="add" size={26} color={colors.onBrand} />
      </Pressable>
      {renderTab(TABS[2])}
      {renderTab(TABS[3])}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 2,
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
  },
  add: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },
});
