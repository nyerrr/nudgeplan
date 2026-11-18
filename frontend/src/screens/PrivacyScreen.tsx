import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Card, Section } from '../components/ui';
import { useApp } from '../state';
import { fonts, type } from '../theme';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'What stays on your device',
    body: 'Your name, working hours, tasks, focus steps, check-ins, and completion history are cached in this app on this device. You can use NudgePlan without an account. Guest plans stay on the device and are not uploaded.',
  },
  {
    title: 'Cloud sync',
    body: 'If you sign in with Google or email, your tasks, focus steps, and profile preferences sync to your private Supabase account so they follow you to other devices. Row Level Security in the database keeps every account\'s rows private. Your sign-in session is stored on this device.',
  },
  {
    title: 'When text leaves the device',
    body: 'If the optional NudgePlan AI service is connected, the text of a check-in or task title is sent to that service and to Google Gemini to parse it into tasks. NudgePlan does not store your check-ins; Google processes them under its API terms. The entire app still works with the on-device planner.',
  },
  {
    title: 'Voice input',
    body: 'Voice input uses the speech recognition service built into your operating system or browser. Depending on your device settings, audio may be processed by that provider. NudgePlan does not record or keep audio. You can always type instead.',
  },
  {
    title: 'Notifications',
    body: 'Reminders are scheduled locally on your device. NudgePlan does not use a push server, so no task details are sent anywhere to deliver them. You can turn nudges off in Profile or in system settings at any time.',
  },
  {
    title: 'Your controls',
    body: 'Profile lets you export a copy of your data as JSON, reset preferences, or delete all data. Deleting data clears the local database, cancels scheduled reminders, and removes your synced tasks, steps, and profile preferences from Supabase (along with any older history or check-in rows if present). Your Supabase sign-in account itself is not deleted; sign out or contact support to remove the account.',
  },
  {
    title: 'Analytics and ads',
    body: 'There are no analytics SDKs, advertising SDKs, or third-party trackers in the app.',
  },
];

export function PrivacyScreen() {
  const { colors, go } = useApp();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <BackButton label="Profile" onPress={() => go('profile')} />
      <Text style={[type.title, { color: colors.ink }]}>Privacy</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
        The short version: your plan is yours.
      </Text>

      {SECTIONS.map((section) => (
        <Section key={section.title} label={section.title}>
          <Card>
            <Text
              style={[
                type.body,
                {
                  color: colors.ink,
                  fontFamily: fonts.regular,
                  lineHeight: 21,
                },
              ]}
            >
              {section.body}
            </Text>
          </Card>
        </Section>
      ))}

      <Text
        style={[
          type.hint,
          {
            color: colors.muted,
            fontFamily: fonts.regular,
            marginTop: 22,
            lineHeight: 18,
          },
        ]}
      >
        Questions about privacy? Use the support link on the app store listing.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
});
