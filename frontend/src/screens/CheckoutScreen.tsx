import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { BackButton, Button, Card, Divider, Section } from '../components/ui';
import { setCheckoutPricing } from '../lib/checkout';
import { useApp } from '../state';
import { fonts, radius, type } from '../theme';

const plusBenefits = [
  '100 AI check-ins per month',
  'Full planning help',
  'Early access to new AI features',
  'All core planning and focus tools',
];

const PRICING = {
  regular: { label: 'Regular', price: '₱149 per month', short: '₱149/mo' },
  student: { label: 'Student', price: '₱99 per month', short: '₱99/mo' },
} as const;

type PricingOption = keyof typeof PRICING;

export function CheckoutScreen() {
  const { colors, go } = useApp();
  const insets = useSafeAreaInsets();
  const [pricing, setPricing] = useState<PricingOption>('regular');
  const selected = PRICING[pricing];

  const continueToPayment = () => {
    setCheckoutPricing(pricing);
    go('payment');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
    >
      <BackButton label="Plans" onPress={() => go('subscription')} />
      <Text style={[type.title, { color: colors.ink }]}>Upgrade to Plus</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 6 }]}>
        Choose regular or student pricing, then continue to billing when subscriptions are available.
      </Text>

      <Section label="Choose pricing" style={{ marginTop: 24 }}>
        <View style={styles.optionList}>
          <PricingOptionCard
            title="Regular"
            price="₱149 per month"
            detail="Standard monthly price"
            selected={pricing === 'regular'}
            onPress={() => setPricing('regular')}
          />
          <PricingOptionCard
            title="Student"
            price="₱99 per month"
            detail="Use your student email or provide proof of enrollment"
            selected={pricing === 'student'}
            onPress={() => setPricing('student')}
          />
        </View>
      </Section>

      <Section label="Plan summary">
        <Card style={[styles.planCard, { borderColor: colors.brand, borderWidth: 1.5 }]}>
          <View style={styles.planHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.planName, { color: colors.ink }]}>Plus</Text>
              <Text style={[styles.price, { color: colors.ink }]}>{selected.price}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.brand }]}>
              <Text style={[styles.badgeText, { color: colors.onBrand }]}>SELECTED</Text>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.muted }]}>
            Get AI support every day.
          </Text>
          <Divider style={{ marginTop: 14, marginBottom: 12 }} />
          <View style={styles.metaList}>
            <MetaRow label="Pricing" value={selected.label} />
            <MetaRow label="Price" value={selected.price} />
            <MetaRow label="Billing" value="Monthly (when available)" />
            <MetaRow label="Current plan" value="Basic (Free)" />
          </View>
          <View style={styles.featureList}>
            {plusBenefits.map((benefit) => (
              <Feature key={benefit} text={benefit} />
            ))}
          </View>
        </Card>
      </Section>

      <Section label="Billing prompt">
        <Card style={styles.billingCard}>
          <PromptRow
            icon="person-outline"
            title="Account"
            detail="Subscription will be linked to your signed-in account"
          />
          <Divider />
          <PromptRow
            icon="card-outline"
            title="Payment method"
            detail="Add a card or payment method when checkout is enabled"
          />
          {pricing === 'student' ? (
            <>
              <Divider />
              <PromptRow
                icon="school-outline"
                title="Student verification"
                detail="Provide your student email or upload proof that you are a student when checkout is enabled"
              />
            </>
          ) : null}
          <Divider />
          <PromptRow
            icon="shield-checkmark-outline"
            title="Confirmation"
            detail={`You’ll review the ${selected.label.toLowerCase()} price and terms before any charge`}
          />
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button block label={`Continue to payment (demo) · ${selected.short}`} onPress={continueToPayment} />
        <Button block ghost label="Not now" onPress={() => go('subscription')} style={{ marginTop: 10 }} />
      </View>

      <Card tone="muted" style={styles.noteCard}>
        <Text style={[styles.note, { color: colors.muted }]}>
          This is a demo billing prompt. No payment method is collected, no student verification is processed, and no
          payment is taken.
        </Text>
      </Card>
    </ScrollView>
  );
}

function PricingOptionCard({
  title,
  price,
  detail,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} pricing, ${price}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        {
          borderColor: selected ? colors.brand : colors.line,
          backgroundColor: selected ? colors.surface2 : colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.optionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.optionTitle, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.optionPrice, { color: colors.ink }]}>{price}</Text>
        </View>
        <Icon
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? colors.brand : colors.muted}
        />
      </View>
      <Text style={[styles.optionDetail, { color: colors.muted }]}>{detail}</Text>
    </Pressable>
  );
}

function Feature({ text }: { text: string }) {
  const { colors } = useApp();
  return (
    <View style={styles.feature}>
      <Icon name="checkmark-circle" size={18} color={colors.low} />
      <Text style={[styles.featureText, { color: colors.ink }]}>{text}</Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const { colors } = useApp();
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

function PromptRow({
  icon,
  title,
  detail,
}: {
  icon: 'person-outline' | 'card-outline' | 'shield-checkmark-outline' | 'school-outline';
  title: string;
  detail: string;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.promptRow}>
      <View style={[styles.promptIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={icon} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.promptTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.promptDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingHorizontal: 20 },
  optionList: { gap: 10 },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  optionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  optionPrice: { fontFamily: fonts.bold, fontSize: 17, marginTop: 2 },
  optionDetail: { ...type.hint, marginTop: 6, lineHeight: 18 },
  planCard: { padding: 18 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planName: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  price: { fontFamily: fonts.semibold, fontSize: 16, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  description: { ...type.sub, marginTop: 8 },
  metaList: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metaLabel: { ...type.sub, flexShrink: 0 },
  metaValue: { ...type.sub, fontFamily: fonts.medium, flex: 1, textAlign: 'right' },
  featureList: { gap: 11, marginTop: 17 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  featureText: { ...type.sub, flex: 1 },
  billingCard: { paddingVertical: 4, paddingHorizontal: 0 },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  promptIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  promptDetail: { ...type.hint, marginTop: 2 },
  actions: { marginTop: 22 },
  noteCard: { marginTop: 18, padding: 16 },
  note: { ...type.hint, lineHeight: 18, textAlign: 'center' },
});
