import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { BackButton, Button, Card, Divider, Section } from '../components/ui';
import { useApp } from '../state';
import { fonts, radius, type } from '../theme';

const plusBenefits = [
  '100 AI check-ins per month',
  'Full planning help',
  'Early access to new AI features',
  'All core planning and focus tools',
];

export function SubscriptionScreen() {
  const { colors, go } = useApp();
  const insets = useSafeAreaInsets();

  const showUnavailable = (title = 'Subscriptions are coming soon') =>
    Alert.alert(
      title,
      'Plan selection, payments, and billing management are not available in this demo yet. Your current access will not change.',
    );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
    >
      <BackButton label="Settings" onPress={() => go('profile')} />
      <Text style={[type.title, { color: colors.ink }]}>Subscription & billing</Text>
      <Text style={[type.sub, { color: colors.muted, marginTop: 6 }]}>
        View your plan, compare upgrades, and see how billing will work for AI access.
      </Text>

      <Section label="Current plan" style={{ marginTop: 24 }}>
        <Card style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.planName, { color: colors.ink }]}>Basic</Text>
              <Text style={[styles.price, { color: colors.ink }]}>Free</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.badgeText, { color: colors.brand }]}>ACTIVE</Text>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.muted }]}>
            Start with the essentials. Includes 10 AI check-ins per month.
          </Text>
          <Divider style={{ marginTop: 14, marginBottom: 12 }} />
          <View style={styles.metaList}>
            <MetaRow label="Status" value="Active (demo)" />
            <MetaRow label="Billing cycle" value="Not applicable" />
            <MetaRow label="Next charge" value="None" />
            <MetaRow label="AI allowance" value="10 AI check-ins per month" />
          </View>
        </Card>
      </Section>

      <Section label="Plans">
        <View style={styles.stack}>
          <Card style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.planName, { color: colors.ink }]}>Basic</Text>
                <Text style={[styles.price, { color: colors.ink }]}>Free</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.badgeText, { color: colors.brand }]}>CURRENT</Text>
              </View>
            </View>
            <Text style={[styles.description, { color: colors.muted }]}>
              Start with the essentials.
            </Text>
            <View style={styles.featureList}>
              <Feature text="10 AI check-ins per month" />
              <Feature text="Daily planning, focus, and insights" />
              <Feature text="Tasks saved to your account or device" />
            </View>
          </Card>

          <Card style={[styles.planCard, styles.plusCard, { borderColor: colors.brand }]}>
            <View style={styles.planHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.planName, { color: colors.ink }]}>Plus</Text>
                <Text style={[styles.price, { color: colors.ink }]}>₱149 per month</Text>
                <Text style={[styles.studentPrice, { color: colors.brand }]}>₱99 per month for students</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                <Text style={[styles.badgeText, { color: colors.onBrand }]}>BEST VALUE</Text>
              </View>
            </View>
            <Text style={[styles.description, { color: colors.muted }]}>
              Get AI support every day.
            </Text>
            <Text style={[styles.studentNote, { color: colors.muted }]}>
              Student pricing requires a student email or proof of enrollment.
            </Text>
            <View style={styles.featureList}>
              {plusBenefits.map((benefit) => (
                <Feature key={benefit} text={benefit} />
              ))}
            </View>
            <Button block label="Choose Plus" onPress={() => go('checkout')} style={{ marginTop: 18 }} />
          </Card>
        </View>
      </Section>

      <Section label="Billing & payment">
        <Card style={styles.billingCard}>
          <BillingRow
            icon="card-outline"
            title="Payment method"
            detail="No payment method on file (demo)"
            onPress={() => showUnavailable('Payment method unavailable')}
          />
          <Divider />
          <BillingRow
            icon="receipt-outline"
            title="Billing history"
            detail="Invoices and receipts will appear here"
            onPress={() => showUnavailable('Billing history unavailable')}
          />
          <Divider />
          <BillingRow
            icon="refresh-outline"
            title="Restore purchases"
            detail="Restore a previous subscription on this account"
            onPress={() => showUnavailable('Restore unavailable')}
          />
          <Divider />
          <BillingRow
            icon="close-circle-outline"
            title="Manage or cancel plan"
            detail="Change, pause, or cancel when billing is enabled"
            onPress={() => showUnavailable('Manage plan unavailable')}
          />
        </Card>
      </Section>

      <Card tone="muted" style={styles.noteCard}>
        <Text style={[styles.noteTitle, { color: colors.ink }]}>Demo billing preview</Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          Prices, checkout, payment methods, invoices, and cancellation will be connected when subscriptions are
          set up. No payment is taken from this screen.
        </Text>
      </Card>
    </ScrollView>
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

function BillingRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: 'card-outline' | 'receipt-outline' | 'refresh-outline' | 'close-circle-outline';
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.billingRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.billingIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={icon} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.billingTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.billingDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingHorizontal: 20 },
  stack: { gap: 14 },
  planCard: { padding: 18 },
  plusCard: { borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planName: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  price: { fontFamily: fonts.semibold, fontSize: 16, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  description: { ...type.sub, marginTop: 8 },
  studentPrice: { ...type.sub, fontFamily: fonts.semibold, marginTop: 2 },
  studentNote: { ...type.hint, marginTop: 4, lineHeight: 18 },
  featureList: { gap: 11, marginTop: 17 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  featureText: { ...type.sub, flex: 1 },
  metaList: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metaLabel: { ...type.sub, flexShrink: 0 },
  metaValue: { ...type.sub, fontFamily: fonts.medium, flex: 1, textAlign: 'right' },
  billingCard: { paddingVertical: 4, paddingHorizontal: 0 },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  billingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  billingDetail: { ...type.hint, marginTop: 2 },
  noteCard: { marginTop: 18, padding: 16 },
  noteTitle: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 4 },
  note: { ...type.hint, lineHeight: 18 },
});
