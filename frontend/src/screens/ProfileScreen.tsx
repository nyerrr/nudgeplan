import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '../components/Icon';
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

export function ProfileScreen() {
  const {
    state,
    colors,
    go,
    setName,
    setHours,
    toggleNudges,
    setThemeMode,
    exportData,
    resetApp,
    testNudge,
    storageWarning,
    aiStatus,
    aiInfo,
    checkAi,
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
      showsVerticalScrollIndicator={false}
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

      <Label>Notifications</Label>
      <Card style={{ paddingVertical: 2 }}>
        <View style={[styles.linkrow, { paddingVertical: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.semibold,
                fontSize: 14,
              }}
            >
              Send a test nudge
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontFamily: fonts.regular,
                fontSize: 12.5,
              }}
            >
              Check notification permissions on this device
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void testNudge()}
            style={[
              styles.smallBtn,
              { backgroundColor: colors.surface2, borderColor: colors.line },
            ]}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.semibold,
                fontSize: 13,
              }}
            >
              Test
            </Text>
          </Pressable>
        </View>
      </Card>

      <Label>AI status</Label>
      <Card>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            Backend: {aiStatus === 'online' ? 'Online' : 'Offline'}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontFamily: fonts.regular,
              fontSize: 13,
            }}
          >
            {aiInfo
              ? `Model: ${aiInfo.model} • Mock: ${aiInfo.mock_mode ? 'yes' : 'no'}`
              : 'Checking connection...'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void checkAi()}
            style={[
              styles.smallBtn,
              {
                alignSelf: 'flex-start',
                marginTop: 4,
                backgroundColor: colors.surface2,
                borderColor: colors.line,
              },
            ]}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.semibold,
                fontSize: 13,
              }}
            >
              Recheck
            </Text>
          </Pressable>
        </View>
      </Card>

      <Label>Data</Label>
      <Card style={{ paddingVertical: 2 }}>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            const json = exportData();
            try {
              await Share.share({
                message: json,
                title: 'NudgePlan data export',
              });
            } catch {
              if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
                try {
                  await navigator.clipboard?.writeText(json);
                  Alert.alert('Copied', 'Export JSON copied to clipboard.');
                } catch {
                  Alert.alert('Export', 'Copy this data manually.');
                }
              } else {
                Alert.alert('Export', json.slice(0, 200) + (json.length > 200 ? '...' : ''));
              }
            }
          }}
          style={styles.linkrow}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            Export data
          </Text>
          <Icon name="share-outline" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              'Delete all data',
              'This removes all tasks, history, and settings from this device. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => void resetApp(),
                },
              ],
            );
          }}
          style={[styles.linkrow, { borderTopWidth: 1, borderTopColor: colors.line }]}
        >
          <Text
            style={{
              color: colors.warn,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            Delete all data
          </Text>
          <Icon name="trash-outline" size={18} color={colors.warn} />
        </Pressable>
      </Card>
      {storageWarning ? (
        <Text
          style={{
            color: colors.warn,
            fontFamily: fonts.regular,
            fontSize: 12.5,
            marginTop: 8,
          }}
        >
          Storage warning: changes may not be saved fully on this device.
        </Text>
      ) : null}

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
        <Pressable
          accessibilityRole="button"
          onPress={() => go('privacy')}
          style={[styles.linkrow, { borderTopWidth: 1, borderTopColor: colors.line }]}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            Privacy
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
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
  smallBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
