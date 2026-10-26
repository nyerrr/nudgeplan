import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { useApp } from '../state';
import { fonts, type } from '../theme';

export function LogoutScreen({ onSignBackIn }: { onSignBackIn: () => void }) {
  const { colors } = useApp();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View
        pointerEvents="none"
        style={[styles.glow, styles.glowOne, { backgroundColor: colors.glow }]}
      />
      <View
        pointerEvents="none"
        style={[styles.glow, styles.glowTwo, { backgroundColor: colors.glow }]}
      />

      <View style={styles.shell}>
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: colors.brand }]}>
            <Icon name="sparkles" size={22} color={colors.onBrand} />
          </View>
          <Text style={[styles.wordmark, { color: colors.ink }]}>NudgePlan</Text>
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
          <View style={[styles.symbol, { backgroundColor: colors.accent }]}>
            <Icon name="checkmark" size={30} color={colors.ink} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            SIGNED OUT
          </Text>
          <Text style={[type.title, styles.title, { color: colors.ink }]}>
            Your plan is safe.
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You&apos;re all signed out. Come back when you&apos;re ready to
            shape another doable day.
          </Text>
          <Button
            block
            label="Sign back in"
            onPress={onSignBackIn}
            style={{ marginTop: 22 }}
          />
          <Text style={[styles.note, { color: colors.muted }]}>
            Take a breath. You did enough for now.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.45,
  },
  glowOne: {
    width: 230,
    height: 230,
    top: -90,
    right: -110,
  },
  glowTwo: {
    width: 170,
    height: 170,
    bottom: 50,
    left: -100,
  },
  shell: {
    width: '100%',
    maxWidth: 410,
    alignSelf: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 25,
    paddingVertical: 32,
    alignItems: 'center',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  symbol: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
});
