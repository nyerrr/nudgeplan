import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon, type IoniconName } from '../components/Icon';
import {
  BackButton,
  Card,
  Label,
  Segmented,
  Toggle,
} from '../components/ui';
import { fmtHour } from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { ThemeMode } from '../types';

const DEMOS: Array<{
  id: string;
  icon: IoniconName;
  title: string;
  description: string;
}> = [
  {
    id: 'dump',
    icon: 'chatbubble-ellipses-outline',
    title: 'Brain dump a day',
    description: 'Send a messy list and watch it become a plan.',
  },
  {
    id: 'overload',
    icon: 'shield-checkmark-outline',
    title: 'Overload the day',
    description: 'Push past 100% and meet the Reality Check.',
  },
  {
    id: 'stuck',
    icon: 'footsteps-outline',
    title: 'Get unstuck',
    description: 'Turn one heavy task into small steps.',
  },
  {
    id: 'tired',
    icon: 'flash-outline',
    title: 'Report low energy',
    description: 'Capacity shrinks and heavy work moves.',
  },
  {
    id: 'reset',
    icon: 'close',
    title: 'Reset the demo',
    description: 'Restore the starting data.',
  },
];

export function ProfileScreen() {
  const {
    state,
    colors,
    go,
    setName,
    setHours,
    toggleNudges,
    setThemeMode,
    demo,
  } = useApp();
  const [nameDraft, setNameDraft] = useState(state.name);

  useEffect(() => {
    setNameDraft(state.name);
  }, [state.name]);

  const startHours = [5, 6, 7, 8, 9, 10, 11, 12];
  const endHours = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton label="Home" onPress={() => go('home')} />
      <Text style={[type.title, { color: colors.ink }]}>Profile</Text>

      <Card style={{ marginTop: 14 }}>
        <Text
          style={[
            styles.fieldLabel,
            { color: colors.muted, marginTop: 0 },
          ]}
        >
          Your name
        </Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          onBlur={() => setName(nameDraft)}
          onSubmitEditing={() => setName(nameDraft)}
          maxLength={24}
          selectionColor={colors.brand}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              color: colors.ink,
            },
          ]}
        />

        <Text style={[styles.fieldLabel, { color: colors.muted }]}>
          Day starts
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {startHours.map((hour) => {
            const active = state.startH === hour;
            return (
              <Pressable
                key={hour}
                onPress={() => setHours(hour, state.endH)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brand : colors.surface2,
                    borderColor: active ? colors.brand : colors.line,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.onBrand : colors.ink,
                    fontFamily: fonts.medium,
                    fontSize: 12.5,
                  }}
                >
                  {fmtHour(hour)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.fieldLabel, { color: colors.muted }]}>
          Day ends
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {endHours.map((hour) => {
            const active = state.endH === hour;
            return (
              <Pressable
                key={hour}
                onPress={() => setHours(state.startH, hour)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brand : colors.surface2,
                    borderColor: active ? colors.brand : colors.line,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.onBrand : colors.ink,
                    fontFamily: fonts.medium,
                    fontSize: 12.5,
                  }}
                >
                  {fmtHour(hour)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.setrow, { borderBottomColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.semibold,
                fontSize: 14,
              }}
            >
              Nudges
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontFamily: fonts.regular,
                fontSize: 13,
              }}
            >
              Gentle reminders on Home
            </Text>
          </View>
          <Toggle
            checked={state.nudges}
            onChange={toggleNudges}
            label="Nudges"
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Theme</Text>
        <Segmented<ThemeMode>
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={state.theme}
          onChange={setThemeMode}
        />
      </Card>

      <Label>About</Label>
      <Card style={{ paddingVertical: 2 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => go('about')}
          style={styles.linkrow}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            About NudgePlan
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Label>Try the prototype</Label>
      <View style={styles.demos}>
        {DEMOS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => demo(item.id)}
            style={({ pressed }) => [
              styles.demo,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Icon name={item.icon} size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 12.5,
                }}
              >
                {item.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  chips: {
    gap: 8,
    paddingRight: 18,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  setrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 10,
  },
  linkrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  demos: {
    gap: 8,
  },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
