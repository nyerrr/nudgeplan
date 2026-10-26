import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IoniconName } from '../components/Icon';
import { BackButton, Card, Label } from '../components/ui';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { Screen } from '../types';

const PROBLEMS = [
  [
    'Lack of awareness of human capacity',
    'Many apps fit a dense schedule into one day. The day feels heavy, and you feel guilty when you miss tasks.',
  ],
  [
    'No self-sustaining organization',
    'Users report spending more time "gardening" their databases (fixing filters, updating tags, tweaking layouts) than doing actual work.',
  ],
  [
    'No energy matching',
    'Traditional calendars treat 9:00 AM on a Monday the same as 4:00 PM on a Friday. They assume steady cognitive energy and lock you into rigid time blocks, even when you are burnt out or creatively drained.',
  ],
];

const FEATURES: Array<{
  screen: Screen;
  icon: IoniconName;
  title: string;
  description: string;
}> = [
  {
    screen: 'checkin',
    icon: 'chatbubble-ellipses-outline',
    title: 'Conversational Brain Dump',
    description:
      'Type or speak naturally and AI helps you structure daily plans.',
  },
  {
    screen: 'home',
    icon: 'shield-checkmark-outline',
    title: 'Reality Check Engine',
    description: 'Protects you by balancing tasks and workload with open hours.',
  },
  {
    screen: 'focus',
    icon: 'footsteps-outline',
    title: 'Micro-Step Guard',
    description:
      'Automatically breaks down stuck tasks to lessen procrastination.',
  },
];

const PHASES = [
  [
    'Build and validate',
    'Develop the core planner, focus tools, and local-first data model.',
  ],
  [
    'Polish and test',
    'Harden reliability, accessibility, and run automated checks.',
  ],
  [
    'Ship',
    'Prepare for release with clear docs and stable behavior.',
  ],
];

const TEAM = [
  ['RB', 'Ranier J. Burlasa', 'Back-end developer'],
  ['LR', 'Laurien Aemanuel Reyes', 'Front-end developer'],
  ['DNO', 'Dave Nathaniel Olazo', 'Front-end developer, QA'],
];

export function AboutScreen() {
  const { colors, go } = useApp();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <BackButton label="Profile" onPress={() => go('profile')} />
      <Text style={[type.title, { color: colors.ink }]}>About NudgePlan</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 6 }]}>
        NudgePlan replaces manual to-do sorting with a short conversational
        check-in, built for people juggling multiple tasks, goals and projects.
      </Text>

      <Label>Problems in most apps</Label>
      <View style={styles.stack}>
        {PROBLEMS.map(([title, body], index) => (
          <Card key={title} style={styles.problem}>
            <View style={[styles.num, { backgroundColor: colors.brand }]}>
              <Text
                style={{
                  color: colors.onBrand,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {body}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Label>Proposed solution</Label>
      <View style={styles.stack}>
        {FEATURES.map((feature) => (
          <Card key={feature.title} style={{ paddingVertical: 12 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => go(feature.screen)}
              style={styles.feature}
            >
              <Icon name={feature.icon} size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                  }}
                >
                  {feature.title}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontFamily: fonts.regular,
                    fontSize: 13,
                  }}
                >
                  {feature.description}
                </Text>
              </View>
            </Pressable>
          </Card>
        ))}
      </View>

      <Label>Who it is for</Label>
      <View style={styles.chipLine}>
        {['Professionals', 'Students', 'Remote workers', 'Project planners'].map(
          (item) => (
            <View
              key={item}
              style={[
                styles.personChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.medium,
                  fontSize: 13,
                }}
              >
                {item}
              </Text>
            </View>
          ),
        )}
      </View>

      <Label>Growth plan</Label>
      <View style={styles.stack}>
        {PHASES.map(([title, body], index) => (
          <Card key={title} style={styles.problem}>
            <View style={[styles.num, { backgroundColor: colors.brand }]}>
              <Text
                style={{
                  color: colors.onBrand,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {body}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Label>Team</Label>
      <View style={styles.stack}>
        {TEAM.map(([initials, name, role]) => (
          <Card key={name} style={styles.person}>
            <View
              style={[styles.avatar, { backgroundColor: colors.brand }]}
            >
              <Text
                style={{
                  color: colors.onBrand,
                  fontFamily: fonts.bold,
                  fontSize: 13,
                }}
              >
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                  flexShrink: 1,
                }}
              >
                {name}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  marginTop: 2,
                  flexShrink: 1,
                }}
              >
                {role}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Label>Closing statement</Label>
      <Card>
        <Text
          style={{
            color: colors.ink,
            fontFamily: fonts.bold,
            fontSize: 14,
          }}
        >
          NudgePlan does not give people another list to manage.
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontFamily: fonts.regular,
            fontSize: 13,
            marginTop: 6,
          }}
        >
          It replaces the mental overhead of planning with a two-minute
          conversation, so professionals, students and remote workers spend
          their time doing the work, not organizing it.
        </Text>
      </Card>

      <Text
        style={{
          color: colors.muted,
          fontFamily: fonts.regular,
          fontSize: 12.5,
          textAlign: 'center',
          marginTop: 20,
        }}
      >
        Thynk Unlimited
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  stack: {
    gap: 10,
  },
  problem: {
    flexDirection: 'row',
    gap: 12,
  },
  num: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  chipLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personChip: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
