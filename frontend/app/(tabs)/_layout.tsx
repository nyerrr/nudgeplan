import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../src/theme';

/**
 * Bottom tab navigation.
 *
 * Four destinations, matching the core loop:
 *   Today  - what to do right now
 *   Dump   - get it out of your head
 *   Plan   - everything, reschedulable
 *   You    - preferences and settings
 */

function TabIcon({
  glyph,
  focused,
}: {
  glyph: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dump"
        options={{
          title: 'Dump',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ focused }) => <TabIcon glyph="☺" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  tabItem: { paddingTop: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 22 },
  icon: { fontSize: 18, color: colors.textFaint },
  iconFocused: { color: colors.accent },
});
