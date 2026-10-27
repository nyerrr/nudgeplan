import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../auth';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { isValidEmail } from '../lib/authIdentity';
import { useApp } from '../state';
import { fonts } from '../theme';

type Step = 'choose' | 'email' | 'sent';
type Working = 'google' | 'email' | 'complete' | 'guest' | null;

export function LoginScreen() {
  const { colors } = useApp();
  const {
    signInWithGoogle,
    sendEmailLink,
    completeEmailSignIn,
    continueAsGuest,
    demoMode,
    authError,
    clearAuthError,
  } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<Working>(null);
  const busy = working !== null;

  const handleGoogle = async () => {
    setError(null);
    clearAuthError();
    setWorking('google');
    try {
      await signInWithGoogle();
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Google sign-in could not start. Please try again.',
      );
      setWorking(null);
    }
  };

  const handleEmail = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setWorking('email');
    try {
      await sendEmailLink(email);
      setStep('sent');
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'The sign-in link could not be sent. Please try again.',
      );
    } finally {
      setWorking(null);
    }
  };

  const handleCompleteEmail = async () => {
    setError(null);
    setWorking('complete');
    try {
      await completeEmailSignIn(email);
    } catch {
      setError('That sign-in link could not be completed. Try again.');
      setWorking(null);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setWorking('guest');
    try {
      await continueAsGuest();
    } catch {
      setError('Guest mode could not start. Please try again.');
      setWorking(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.topBar}>
            {step !== 'choose' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => {
                  setError(null);
                  setStep(step === 'sent' ? 'email' : 'choose');
                }}
                style={({ pressed }) => [
                  styles.topBack,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Icon name="arrow-back" size={17} color={colors.brand} />
                <Text style={[styles.topBackText, { color: colors.brand }]}>
                  Back
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: colors.brand }]}>
              <Icon name="sparkles" size={24} color={colors.onBrand} />
            </View>
            <Text style={[styles.wordmark, { color: colors.ink }]}>
              NudgePlan
            </Text>
          </View>

          <View style={styles.hero}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>
              PLAN A DAY YOU CAN ACTUALLY DO
            </Text>
            <Text style={[styles.headline, { color: colors.ink }]}>
              Brain dump in.{'\n'}A real plan out.
            </Text>
            <Text style={[styles.sub, { color: colors.muted }]}>
              NudgePlan turns a messy check-in into small, scheduled steps that
              fit your energy.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                shadowColor: colors.shadow,
              },
            ]}
          >
            {step === 'choose' ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>
                  Welcome
                </Text>
                <Text style={[styles.cardBody, { color: colors.muted }]}>
                  Sign in to keep your plan with you, or start without an
                  account.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  disabled={busy}
                  onPress={() => void handleGoogle()}
                  style={({ pressed }) => [
                    styles.googleButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.line,
                      opacity: busy ? 0.6 : pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.googleIcon,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    {working === 'google' ? (
                      <ActivityIndicator size="small" color={colors.brand} />
                    ) : (
                      <Icon name="logo-google" size={17} color={colors.brand} />
                    )}
                  </View>
                  <Text style={[styles.googleLabel, { color: colors.ink }]}>
                    {working === 'google'
                      ? 'Connecting...'
                      : 'Continue with Google'}
                  </Text>
                  <Icon name="arrow-forward" size={17} color={colors.muted} />
                </Pressable>

                <View style={styles.dividerRow}>
                  <View
                    style={[styles.divider, { backgroundColor: colors.line }]}
                  />
                  <Text style={[styles.dividerText, { color: colors.muted }]}>
                    or use email
                  </Text>
                  <View
                    style={[styles.divider, { backgroundColor: colors.line }]}
                  />
                </View>

                <Button
                  block
                  icon="mail-outline"
                  label="Continue with email"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setStep('email');
                  }}
                />
              </>
            ) : null}

            {step === 'email' ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>
                  Sign in with email
                </Text>
                <Text style={[styles.cardBody, { color: colors.muted }]}>
                  No password needed. I will send you a one-time sign-in link.
                </Text>

                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.brand}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="go"
                  onSubmitEditing={() => void handleEmail()}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: error ? colors.warn : colors.line,
                      color: colors.ink,
                    },
                  ]}
                />

                {error ? (
                  <Text style={[styles.error, { color: colors.warn }]}>
                    {error}
                  </Text>
                ) : null}

                <Button
                  block
                  label={
                    working === 'email'
                      ? 'Sending link...'
                      : 'Email me a sign-in link'
                  }
                  disabled={busy}
                  onPress={() => void handleEmail()}
                  style={{ marginTop: 16 }}
                />
              </>
            ) : null}

            {step === 'sent' ? (
              <>
                <View
                  style={[styles.sentIcon, { backgroundColor: colors.surface2 }]}
                >
                  <Icon
                    name="mail-open-outline"
                    size={26}
                    color={colors.brand}
                  />
                </View>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>
                  Check your inbox
                </Text>
                <Text style={[styles.cardBody, { color: colors.muted }]}>
                  I sent a sign-in link to{' '}
                  <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>
                    {email.trim()}
                  </Text>
                  .
                </Text>

                {demoMode ? (
                  <Text style={[styles.demoCopy, { color: colors.muted }]}>
                    This preview does not send real email. Open the demo link
                    below to see the signed-in app.
                  </Text>
                ) : (
                  <Text style={[styles.demoCopy, { color: colors.muted }]}>
                    Open the link on this device to finish signing in.
                  </Text>
                )}

                {error ? (
                  <Text style={[styles.error, { color: colors.warn }]}>
                    {error}
                  </Text>
                ) : null}

                {demoMode ? (
                  <Button
                    block
                    label={
                      working === 'complete'
                        ? 'Signing in...'
                        : 'Open demo link'
                    }
                    disabled={busy}
                    onPress={() => void handleCompleteEmail()}
                    style={{ marginTop: 16 }}
                  />
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError(null);
                    setStep('email');
                  }}
                  style={styles.secondaryLink}
                >
                  <Text style={[styles.secondaryText, { color: colors.brand }]}>
                    Use a different email
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === 'choose' ? (
              <>
                {error ?? authError ? (
                  <Text style={[styles.error, { color: colors.warn }]}>
                    {error ?? authError}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue without an account"
                  disabled={busy}
                  onPress={() => void handleGuest()}
                  style={({ pressed }) => [
                    styles.guestButton,
                    { opacity: busy ? 0.6 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.guestText, { color: colors.brand }]}>
                    {working === 'guest'
                      ? 'Setting up...'
                      : 'Continue without an account'}
                  </Text>
                </Pressable>
                <Text style={[styles.guestNote, { color: colors.muted }]}>
                  You can add an account later from Profile.
                </Text>
              </>
            ) : null}
          </View>

          {demoMode ? (
            <View
              style={[styles.demoNote, { backgroundColor: colors.surface2 }]}
            >
              <Icon name="flask-outline" size={15} color={colors.brand} />
              <Text style={[styles.demoNoteText, { color: colors.muted }]}>
                Preview mode: Google and email sign-in are simulated until an
                auth provider is connected.
              </Text>
            </View>
          ) : null}

          <Text style={[styles.foot, { color: colors.muted }]}>
            Your plan stays on this device until you enable cloud sync.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  shell: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  topBar: {
    minHeight: 36,
    justifyContent: 'center',
  },
  topBack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    minHeight: 44,
    paddingRight: 10,
  },
  topBackText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    letterSpacing: -0.4,
  },
  hero: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.3,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 390,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginTop: 26,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  googleButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    marginTop: 20,
  },
  googleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginTop: 16,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 9,
  },
  sentIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  demoCopy: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  secondaryLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  guestButton: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 10,
  },
  guestText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
  },
  guestNote: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 1,
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  demoNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
  },
  foot: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 10,
  },
});
