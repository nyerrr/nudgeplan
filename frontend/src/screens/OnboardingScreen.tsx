import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon, type IoniconName } from '../components/Icon';
import { Button, Segmented, Toggle } from '../components/ui';
import { fmtHour } from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { Energy } from '../types';

const START_HOURS = [5, 6, 7, 8, 9, 10, 11, 12];
const END_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const POINTS: Array<{ icon: IoniconName; title: string; body: string }> = [
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Brain dump in plain words',
    body: 'Type or say what is on your plate. It becomes tasks with realistic times.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'A plan that fits your day',
    body: 'Heavy work lands in your peak hours. Overload gets caught before it burns you out.',
  },
  {
    icon: 'footsteps-outline',
    title: 'Start when it feels too big',
    body: 'One tap turns a stuck task into small, timed steps you can actually begin.',
  },
];

export function OnboardingScreen() {
  const { colors, completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [startH, setStartH] = useState(9);
  const [endH, setEndH] = useState(18);
  const [energy, setEnergy] = useState<Energy>('medium');
  const [nudges, setNudges] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const next = () => {
    setError(null);
    if (step === 1 && !name.trim()) {
      setError('Add a name so greetings feel like yours.');
      return;
    }
    setStep((current) => Math.min(2, current + 1));
  };

  const back = () => {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const finish = async () => {
    if (!name.trim()) {
      setStep(1);
      setError('Add a name so greetings feel like yours.');
      return;
    }
    if (endH <= startH) {
      setError('Your day needs to end after it starts.');
      return;
    }
    setWorking(true);
    await completeOnboarding({ name, startH, endH, energy, nudges });
    setWorking(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          {step > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={back}
              style={styles.back}
            >
              <Icon name="chevron-back" size={18} color={colors.brand} />
              <Text
                style={{
                  color: colors.brand,
                  fontFamily: fonts.semibold,
                  fontSize: 14,
                }}
              >
                Back
              </Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === step ? colors.brand : colors.line,
                    width: index === step ? 22 : 7,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {step === 0 ? (
          <>
            <View
              style={[
                styles.mark,
                { backgroundColor: colors.brand, shadowColor: colors.shadow },
              ]}
            >
              <Icon name="sparkles" size={30} color={colors.onBrand} />
            </View>
            <Text style={[type.title, { color: colors.ink, marginTop: 22 }]}>
              A plan you can{'\n'}actually do.
            </Text>
            <Text
              style={[
                type.body,
                { color: colors.muted, marginTop: 10, fontFamily: fonts.regular },
              ]}
            >
              NudgePlan is built for real days: low energy, full calendars, and
              tasks that feel too big to start.
            </Text>

            <View style={styles.points}>
              {POINTS.map((point) => (
                <View
                  key={point.title}
                  style={[
                    styles.point,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.pointIcon,
                      { backgroundColor: colors.surface2 },
                    ]}
                  >
                    <Icon name={point.icon} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.ink,
                        fontFamily: fonts.semibold,
                        fontSize: 14,
                      }}
                    >
                      {point.title}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontFamily: fonts.regular,
                        fontSize: 12.5,
                        lineHeight: 18,
                        marginTop: 2,
                      }}
                    >
                      {point.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Button
              block
              label="Get started"
              onPress={next}
              style={{ marginTop: 22 }}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={[type.title, { color: colors.ink }]}>
              What should I call you?
            </Text>
            <Text
              style={[
                type.body,
                { color: colors.muted, marginTop: 8, fontFamily: fonts.regular },
              ]}
            >
              This stays on your device. No account, no sign-up.
            </Text>

            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError(null);
              }}
              placeholder="Your first name"
              placeholderTextColor={colors.muted}
              selectionColor={colors.brand}
              autoFocus
              maxLength={24}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={next}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.warn : colors.line,
                  color: colors.ink,
                },
              ]}
            />
            {error ? (
              <Text
                style={{
                  color: colors.warn,
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Button
              block
              label="Continue"
              onPress={next}
              style={{ marginTop: 22 }}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[type.title, { color: colors.ink }]}>
              Shape your day
            </Text>
            <Text
              style={[
                type.body,
                { color: colors.muted, marginTop: 8, fontFamily: fonts.regular },
              ]}
            >
              I will fit tasks around these hours and your energy. You can change
              this any time in Profile.
            </Text>

            <Text style={[styles.label, { color: colors.muted }]}>
              Day starts
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {START_HOURS.map((hour) => {
                const active = startH === hour;
                return (
                  <Pressable
                    key={hour}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setStartH(hour);
                      if (endH <= hour) setEndH(Math.min(23, hour + 8));
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.brand
                          : colors.surface,
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

            <Text style={[styles.label, { color: colors.muted }]}>Day ends</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {END_HOURS.map((hour) => {
                const active = endH === hour;
                return (
                  <Pressable
                    key={hour}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setEndH(hour)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? colors.brand
                          : colors.surface,
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

            <Text style={[styles.label, { color: colors.muted }]}>
              Energy today
            </Text>
            <Segmented<Energy>
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Steady' },
                { value: 'high', label: 'High' },
              ]}
              value={energy}
              onChange={setEnergy}
            />

            <View
              style={[
                styles.setrow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                  }}
                >
                  Gentle nudges
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontFamily: fonts.regular,
                    fontSize: 12.5,
                    lineHeight: 18,
                    marginTop: 2,
                  }}
                >
                  One reminder before a planned task. No streaks, no guilt.
                </Text>
              </View>
              <Toggle
                checked={nudges}
                onChange={() => setNudges((value) => !value)}
                label="Gentle nudges"
              />
            </View>

            {error ? (
              <Text
                style={{
                  color: colors.warn,
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  marginTop: 10,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Button
              block
              label={working ? 'Building your plan...' : 'Start planning'}
              onPress={() => void finish()}
              disabled={working}
              style={{ marginTop: 22 }}
            />
            <Text
              style={[
                type.hint,
                {
                  color: colors.muted,
                  fontFamily: fonts.regular,
                  textAlign: 'center',
                  marginTop: 12,
                },
              ]}
            >
              You can turn notifications off at any time.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 7,
    borderRadius: 99,
  },
  mark: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 34,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  points: {
    gap: 10,
    marginTop: 26,
  },
  point: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
  },
  pointIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 18,
    marginTop: 26,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  chips: {
    gap: 8,
    paddingRight: 18,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  setrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
  },
});
