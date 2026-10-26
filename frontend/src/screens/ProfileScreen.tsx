import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import {
  BackButton,
  Button,
  Card,
  Label,
  Segmented,
  Toggle,
} from '../components/ui';
import { useAuth } from '../auth';
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
    resetPreferences,
    resetApp,
    testNudge,
    storageWarning,
    aiStatus,
    aiInfo,
    checkAi,
  } = useApp();
  const { user, signOut } = useAuth();
  const [nameDraft, setNameDraft] = useState(state.name);
  const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setNameDraft(state.name);
  }, [state.name]);

  useEffect(() => {
    setConfirmSignOut(false);
  }, [user?.id]);

  const accountProvider =
    user?.provider === 'google'
      ? 'Google'
      : user?.provider === 'email'
        ? 'Email link'
        : 'Guest';
  const signingOut = () => {
    setConfirmSignOut(false);
    go('home');
    void signOut();
  };

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
      <View style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.ink }]}>
            {(state.name.trim()[0] || '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.ink }]}>Profile</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Shape how NudgePlan plans your day.
          </Text>
        </View>
      </View>

      <Label>Account</Label>
      <Card style={{ paddingVertical: 2 }}>
        <View style={styles.accountRow}>
          <View
            style={[styles.accountIcon, { backgroundColor: colors.surface2 }]}
          >
            <Icon
              name={
                user?.provider === 'google'
                  ? 'logo-google'
                  : user?.provider === 'email'
                    ? 'mail-outline'
                    : 'person-outline'
              }
              size={18}
              color={colors.brand}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accountTitle, { color: colors.ink }]}>
              {user?.provider === 'guest'
                ? 'Guest mode'
                : user?.name || user?.email || 'Signed in'}
            </Text>
            <Text style={[styles.accountMeta, { color: colors.muted }]}>
              {user?.provider === 'guest'
                ? 'Your plan is stored on this device.'
                : `${user?.email ?? ''} · Signed in with ${accountProvider}`}
            </Text>
          </View>
          {user?.provider !== 'guest' ? (
            <View
              style={[styles.accountBadge, { backgroundColor: colors.accent }]}
            >
              <Text
                style={[
                  styles.accountBadgeText,
                  { color: colors.onAccent },
                ]}
              >
                {accountProvider}
              </Text>
            </View>
          ) : null}
        </View>

        {confirmSignOut ? (
          <View
            style={[
              styles.signOutConfirm,
              { borderTopColor: colors.line },
            ]}
          >
            <Text style={[styles.signOutTitle, { color: colors.ink }]}>
              {user?.provider === 'guest'
                ? 'Leave guest mode?'
                : 'Log out of NudgePlan?'}
            </Text>
            <Text style={[styles.signOutBody, { color: colors.muted }]}>
              Your plan and history stay on this device.
            </Text>
            <View style={styles.signOutActions}>
              <Button
                small
                ghost
                label="Cancel"
                onPress={() => setConfirmSignOut(false)}
              />
              <Button
                small
                label={user?.provider === 'guest' ? 'Sign in' : 'Log out'}
                onPress={signingOut}
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              user?.provider === 'guest'
                ? 'Sign in or create an account'
                : 'Log out'
            }
            onPress={() => setConfirmSignOut(true)}
            style={({ pressed }) => [
              styles.accountAction,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.line,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon
              name={
                user?.provider === 'guest'
                  ? 'log-in-outline'
                  : 'log-out-outline'
              }
              size={17}
              color={colors.brand}
            />
            <Text style={[styles.accountActionText, { color: colors.brand }]}>
              {user?.provider === 'guest'
                ? 'Sign in or create an account'
                : 'Log out'}
            </Text>
          </Pressable>
        )}
      </Card>

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

        <View style={[styles.scheduleSummary, { borderTopColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 0 }]}>
              Planning window
            </Text>
            <Text style={[styles.scheduleValue, { color: colors.ink }]}>
              {fmtHour(state.startH)} – {fmtHour(state.endH)}
            </Text>
            <Text style={[styles.scheduleHint, { color: colors.muted }]}>
              NudgePlan will plan tasks during these hours.
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12 }}>
            Tap a time to change
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Day starts at ${fmtHour(state.startH)}`}
          onPress={() => setTimePicker('start')}
          style={[styles.timeRow, { borderTopColor: colors.line }]}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 }}>
            Day starts
          </Text>
          <View style={styles.timeValue}>
            <Text style={{ color: colors.brand, fontFamily: fonts.bold, fontSize: 14 }}>
              {fmtHour(state.startH)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Day ends at ${fmtHour(state.endH)}`}
          onPress={() => setTimePicker('end')}
          style={[styles.timeRow, { borderTopColor: colors.line }]}
        >
          <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 }}>
            Day ends
          </Text>
          <View style={styles.timeValue}>
            <Text style={{ color: colors.brand, fontFamily: fonts.bold, fontSize: 14 }}>
              {fmtHour(state.endH)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
          </View>
        </Pressable>

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

      </Card>

      <Label>Appearance</Label>
      <Card>
        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 0 }]}>Theme</Text>
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

      <Modal
        visible={timePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePicker(null)}
      >
        <View style={[styles.pickerOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close time picker"
            style={StyleSheet.absoluteFill}
            onPress={() => setTimePicker(null)}
          />
          <View
            style={[
              styles.pickerSheet,
              {
                backgroundColor: colors.bg,
                paddingBottom: Math.max(18, insets.bottom + 10),
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <View>
                <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
                  {timePicker === 'start' ? 'Day starts' : 'Day ends'}
                </Text>
                <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 3 }}>
                  Choose a time for your planning window.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close time picker"
                onPress={() => setTimePicker(null)}
                style={[styles.closeButton, { backgroundColor: colors.surface2 }]}
              >
                <Text style={{ color: colors.ink, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(timePicker === 'start' ? startHours : endHours)
                .filter((hour) => timePicker === 'start' ? hour < state.endH : hour > state.startH)
                .map((hour) => {
                  const active = timePicker === 'start' ? state.startH === hour : state.endH === hour;
                  return (
                    <Pressable
                      key={hour}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        if (timePicker === 'start') setHours(hour, state.endH);
                        else setHours(state.startH, hour);
                        setTimePicker(null);
                      }}
                      style={[
                        styles.pickerOption,
                        { borderBottomColor: colors.line },
                        active ? { backgroundColor: colors.surface2 } : null,
                      ]}
                    >
                      <Text style={{ color: colors.ink, fontFamily: active ? fonts.bold : fonts.medium, fontSize: 15 }}>
                        {fmtHour(hour)}
                      </Text>
                      {active ? <Text style={{ color: colors.brand, fontFamily: fonts.bold, fontSize: 18 }}>✓</Text> : null}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Label>Notifications</Label>
      <Card style={{ paddingVertical: 2 }}>
        <View style={[styles.statusRow, { borderBottomColor: colors.line }]}>
          <View style={[styles.statusDot, { backgroundColor: state.nudges ? colors.accent : colors.muted }]} />
          <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 }}>
            {state.nudges ? 'Gentle reminders are enabled' : 'Gentle reminders are off'}
          </Text>
        </View>
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

      <Label>Planning engine</Label>
      <Card>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.semibold,
              fontSize: 14,
            }}
          >
            Ready to plan
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontFamily: fonts.regular,
              fontSize: 13,
            }}
          >
            {aiStatus === 'checking'
              ? 'Checking readiness...'
              : aiStatus === 'online'
                ? 'Ready to help plan your day'
                : 'Offline planning is available on this device'}
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
              Recheck connection
            </Text>
          </Pressable>
          {aiInfo ? (
            <Text style={[styles.technical, { color: colors.muted }]}>
              Technical: {aiInfo.model} · Demo mode: {aiInfo.mock_mode ? 'on' : 'off'}
            </Text>
          ) : null}
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
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 }}>
              Export data
            </Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 }}>
              Save a copy of your tasks and preferences
            </Text>
          </View>
          <Icon name="share-outline" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            'Reset preferences',
            'Reset your planning hours, energy, nudges, and theme without deleting tasks or history?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', onPress: resetPreferences },
            ],
          )
        }
        style={[styles.linkrow, { borderTopWidth: 1, borderTopColor: colors.line }]}
        >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 }}>
            Reset preferences
          </Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 }}>
            Keep your tasks and history
          </Text>
        </View>
        <Icon name="refresh-outline" size={18} color={colors.muted} />
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  accountMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  accountBadge: {
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  accountBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  accountAction: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2,
    marginBottom: 12,
  },
  accountActionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  signOutConfirm: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 12,
  },
  signOutTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  signOutBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  signOutActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  scheduleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 4,
  },
  scheduleValue: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  scheduleHint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    marginTop: 3,
  },
  technical: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  input: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 18,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOption: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
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
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
