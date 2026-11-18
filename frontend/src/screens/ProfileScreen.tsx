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
  Group,
  GroupRow,
  Section,
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
    cloudSyncStatus,
    retryCloudSync,
    aiStatus,
    aiInfo,
    checkAi,
  } = useApp();
  const { user, signOut } = useAuth();
  const [nameDraft, setNameDraft] = useState(state.name);
  const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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

  const planningStatusLabel =
    aiStatus === 'checking'
      ? 'Checking connection'
      : aiStatus === 'online'
        ? 'Smart planning available'
        : 'Offline planning active';
  const planningStatusDetail =
    aiStatus === 'checking'
      ? 'Verifying the planning service…'
      : aiStatus === 'online'
        ? 'Your check-ins can use the planning service when available.'
        : 'NudgePlan can still plan on this device. Recheck when you’re back online.';
  const planningDotColor =
    aiStatus === 'checking'
      ? colors.muted
      : aiStatus === 'online'
        ? colors.low
        : colors.warn;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton label="Home" onPress={() => go('home')} />
      <View style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.onAccent }]}>
            {(state.name.trim()[0] || '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.title, { color: colors.ink }]}>Settings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Shape how NudgePlan plans your day.
          </Text>
        </View>
      </View>

      <Section label="Account">
        <Card>
          <View style={styles.accountRow}>
            <View style={[styles.accountIcon, { backgroundColor: colors.surface2 }]}>
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {user?.provider === 'guest'
                  ? 'Guest mode'
                  : user?.name || user?.email || 'Signed in'}
              </Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                {user?.provider === 'guest'
                  ? 'Your plan is stored on this device.'
                  : `${user?.email ?? ''}${user?.email ? ' · ' : ''}Signed in with ${accountProvider}`}
              </Text>
            </View>
            {user?.provider !== 'guest' ? (
              <View style={[styles.accountBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.accountBadgeText, { color: colors.onAccent }]}>
                  {accountProvider}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.inlineRow, styles.dividerTop, { borderTopColor: colors.line }]}>
            <View style={[styles.statusDot, { backgroundColor:
              cloudSyncStatus === 'failed'
                ? colors.warn
                : cloudSyncStatus === 'synced'
                  ? colors.low
                  : colors.muted,
            }]} />
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.statusText,
                {
                  color: cloudSyncStatus === 'failed' ? colors.warn : colors.muted,
                  flex: 1,
                },
              ]}
            >
              {cloudSyncStatus === 'local'
                ? 'Saved locally'
                : cloudSyncStatus === 'syncing'
                  ? 'Syncing…'
                  : cloudSyncStatus === 'synced'
                    ? 'Synced'
                    : 'Sync failed'}
            </Text>
            {cloudSyncStatus === 'failed' ? (
              <Pressable
                accessibilityRole="button"
                onPress={retryCloudSync}
                style={({ pressed }) => [styles.inlineAction, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={[styles.inlineActionText, { color: colors.brand }]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>

          {confirmSignOut ? (
            <View style={[styles.dividerTop, { borderTopColor: colors.line, paddingTop: 12 }]}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {user?.provider === 'guest' ? 'Leave guest mode?' : 'Log out of NudgePlan?'}
              </Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Your plan and history stay on this device.
              </Text>
              <View style={styles.signOutActions}>
                <Button small ghost label="Cancel" onPress={() => setConfirmSignOut(false)} />
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
                user?.provider === 'guest' ? 'Sign in or create an account' : 'Log out'
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
                name={user?.provider === 'guest' ? 'log-in-outline' : 'log-out-outline'}
                size={17}
                color={colors.brand}
              />
              <Text style={[styles.accountActionText, { color: colors.brand }]}>
                {user?.provider === 'guest' ? 'Sign in or create an account' : 'Log out'}
              </Text>
            </Pressable>
          )}
        </Card>
      </Section>

      <Section label="Preferences">
        <Card>
          <View style={styles.block}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Your name</Text>
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
          </View>

          <View style={[styles.dividerTop, { borderTopColor: colors.line, paddingTop: 14 }]}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Planning window</Text>
            <Text style={[styles.scheduleValue, { color: colors.ink }]}>
              {fmtHour(state.startH)} – {fmtHour(state.endH)}
            </Text>
            <Text style={[styles.rowDescription, { color: colors.muted }]}>
              NudgePlan will plan tasks during these hours.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Day starts at ${fmtHour(state.startH)}`}
            onPress={() => setTimePicker('start')}
            style={({ pressed }) => [styles.settingRow, styles.dividerTop, { borderTopColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Day starts</Text>
            </View>
            <View style={styles.rowTrailing}>
              <Text style={[styles.valueText, { color: colors.brand }]}>{fmtHour(state.startH)}</Text>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Day ends at ${fmtHour(state.endH)}`}
            onPress={() => setTimePicker('end')}
            style={({ pressed }) => [styles.settingRow, styles.dividerTop, { borderTopColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Day ends</Text>
            </View>
            <View style={styles.rowTrailing}>
              <Text style={[styles.valueText, { color: colors.brand }]}>{fmtHour(state.endH)}</Text>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>

          <View style={[styles.settingRow, styles.dividerTop, { borderTopColor: colors.line }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Nudges</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Gentle reminders on Home
              </Text>
            </View>
            <Toggle checked={state.nudges} onChange={toggleNudges} label="Nudges" />
          </View>
        </Card>
      </Section>

      <Section label="Appearance">
        <Card>
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
      </Section>

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
              <View style={{ flex: 1, minWidth: 0 }}>
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
                .filter((hour) => (timePicker === 'start' ? hour < state.endH : hour > state.startH))
                .map((hour) => {
                  const active =
                    timePicker === 'start' ? state.startH === hour : state.endH === hour;
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

      <Section label="Notifications">
        <Card>
          <View style={[styles.settingRow, { paddingTop: 0 }]}>
            <View style={styles.statusLead}>
              <View style={[styles.statusDot, { backgroundColor: state.nudges ? colors.low : colors.muted }]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Notification status</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                {state.nudges
                  ? 'Gentle reminders are enabled on this device.'
                  : 'Gentle reminders are off. Turn them on in Preferences.'}
              </Text>
            </View>
          </View>

          <View style={[styles.settingRow, styles.dividerTop, { borderTopColor: colors.line }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Send a test nudge</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Check notification permissions on this device.
              </Text>
            </View>
            <View style={styles.rowTrailing}>
              <Button small ghost label="Test" onPress={() => void testNudge()} />
            </View>
          </View>
        </Card>
      </Section>

      <Section label="Planning">
        <Card>
          <View style={styles.settingRow}>
            <View style={styles.statusLead}>
              <View style={[styles.statusDot, { backgroundColor: planningDotColor }]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{planningStatusLabel}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                {planningStatusDetail}
              </Text>
            </View>
          </View>

          <View style={[styles.dividerTop, { borderTopColor: colors.line, paddingTop: 12 }]}>
            <Button
              small
              ghost
              label={aiStatus === 'checking' ? 'Checking…' : 'Recheck connection'}
              onPress={() => void checkAi()}
              disabled={aiStatus === 'checking'}
              style={{ alignSelf: 'flex-start' }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showTechnicalDetails ? 'Hide technical details' : 'Show technical details'}
              onPress={() => setShowTechnicalDetails((v) => !v)}
              style={({ pressed }) => [styles.detailsToggle, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.detailsToggleText, { color: colors.brand }]}>
                Technical details
              </Text>
              <Icon
                name={showTechnicalDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brand}
              />
            </Pressable>

            {showTechnicalDetails ? (
              <View style={[styles.detailsBox, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
                <Text style={[styles.detailsText, { color: colors.muted }]}>
                  Status: {aiStatus}
                </Text>
                <Text style={[styles.detailsText, { color: colors.muted }]}>
                  Model: {aiInfo?.model ?? 'Unavailable'}
                </Text>
                <Text style={[styles.detailsText, { color: colors.muted }]}>
                  Demo mode: {aiInfo ? (aiInfo.mock_mode ? 'on' : 'off') : 'Unknown'}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      </Section>

      <Section label="Data">
        <Group>
          <GroupRow
            accessibilityLabel="Export data"
            onPress={async () => {
              const json = exportData();
              try {
                await Share.share({ message: json, title: 'NudgePlan data export' });
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
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Export data</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Save a copy of your tasks and preferences
              </Text>
            </View>
            <View style={styles.rowIcon}>
              <Icon name="share-outline" size={20} color={colors.muted} />
            </View>
          </GroupRow>
          <GroupRow
            accessibilityLabel="Reset preferences"
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
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Reset preferences</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Keep your tasks and history
              </Text>
            </View>
            <View style={styles.rowIcon}>
              <Icon name="refresh-outline" size={20} color={colors.muted} />
            </View>
          </GroupRow>
          <GroupRow
            last
            accessibilityLabel="Delete all data"
            onPress={() =>
              Alert.alert(
                'Delete all data',
                'This removes all tasks, history, and settings from this device, and deletes your synced rows from your account. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => void resetApp(),
                  },
                ],
              )
            }
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.warn }]}>Delete all data</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>
                Remove tasks, history, and settings from this device
              </Text>
            </View>
            <View style={styles.rowIcon}>
              <Icon name="trash-outline" size={20} color={colors.warn} />
            </View>
          </GroupRow>
        </Group>
        {storageWarning ? (
          <Text style={[styles.warningText, { color: colors.warn }]}>
            Storage warning: changes may not be saved fully on this device.
          </Text>
        ) : null}
      </Section>

      <Section label="About">
        <Group>
          <GroupRow accessibilityLabel="About NudgePlan" onPress={() => go('about')}>
            <Text style={[styles.rowTitle, { color: colors.ink, flex: 1 }]}>About NudgePlan</Text>
            <View style={styles.rowIcon}>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </GroupRow>
          <GroupRow last accessibilityLabel="Privacy" onPress={() => go('privacy')}>
            <Text style={[styles.rowTitle, { color: colors.ink, flex: 1 }]}>Privacy</Text>
            <View style={styles.rowIcon}>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </GroupRow>
        </Group>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
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
    lineHeight: 18,
    marginTop: 2,
  },
  block: {
    gap: 6,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  rowDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  settingRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  inlineRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  dividerTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  rowIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  accountBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  statusLead: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  inlineAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inlineActionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  accountAction: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  accountActionText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  signOutTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  signOutBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  signOutActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  scheduleValue: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
  },
  detailsToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  detailsToggleText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  detailsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  detailsText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  warningText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 10,
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
    paddingHorizontal: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
});
