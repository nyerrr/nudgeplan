import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state';
import { elevationStyle, fonts } from '../theme';
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
        style={({ pressed }) => [
          styles.tab,
          active ? { backgroundColor: colors.surface2 } : null,
          { opacity: pressed ? 0.7 : 1 },
        ]}
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
        elevationStyle(colors, 'md'),
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          paddingBottom: Math.max(10, insets.bottom),
          shadowOffset: { width: 0, height: -4 },
        },
      ]}
    >
      {renderTab(TABS[0])}
      {renderTab(TABS[1])}
      <View style={styles.centerTab}>
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
              borderColor: colors.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name="sparkles-outline" size={22} color={colors.onBrand} />
        </Pressable>
        <Text
          style={[
            styles.tabLabel,
            {
              color: screen === 'checkin' ? colors.brand : colors.muted,
              fontFamily: screen === 'checkin' ? fonts.bold : fonts.medium,
            },
          ]}
        >
          Check-in
        </Text>
      </View>
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
    paddingVertical: 5,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 10,
  },
  add: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    flexShrink: 0,
  },
  centerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
});
