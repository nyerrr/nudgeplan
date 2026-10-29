import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton, Card, Section } from '../components/ui';
import { useApp } from '../state';
import { fonts, type } from '../theme';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'What stays on your device',
    body: 'Your name, working hours, tasks, focus steps, check-ins, and completion history are stored in this app on this device. You can use NudgePlan without an account. If you sign in, your sign-in session is also stored on this device; your plan is not uploaded to a cloud database yet.',
  },
  {
    title: 'When text leaves the device',
    body: 'If you connect the optional NudgePlan AI service, the text of a check-in is sent to that service to improve task parsing. You can use the entire app without it; the on-device planner runs first and is always available. The service does not store your check-ins.',
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
    body: 'Profile lets you export a copy of your data as JSON, or delete everything. Deleting data removes the local database, cancels scheduled reminders, and returns the app to its first-run state.',
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
