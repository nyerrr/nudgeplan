import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { BackButton, Button, Card, Divider, Section } from '../components/ui';
import { getCheckoutPriceLabel, getCheckoutPricing, getCheckoutPricingLabel } from '../lib/checkout';
import { useApp } from '../state';
import { fonts, radius, type } from '../theme';

export function PaymentScreen() {
  const { colors, go } = useApp();
  const insets = useSafeAreaInsets();
  const pricing = getCheckoutPricing();
  const isStudent = pricing === 'student';
  const price = getCheckoutPriceLabel(pricing);
  const pricingLabel = getCheckoutPricingLabel(pricing);

  const [studentEmail, setStudentEmail] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const confirmDemo = () => {
    if (isStudent && !studentEmail.trim()) {
      Alert.alert(
        'Student verification needed',
        'Enter your student email or use the proof option so we can confirm your student pricing in this demo flow.',
      );
      return;
    }
    Alert.alert(
      'Demo payment complete',
      `Plus (${pricingLabel}, ${price}) was not charged. Payments and ${isStudent ? 'student verification' : 'billing'} are not set up yet, so no subscription was created.`,
      [{ text: 'OK', onPress: () => go('subscription') }],
    );
  };

  const proofDemo = () =>
    Alert.alert(
      'Upload proof (demo)',
      'Document upload is not available in this demo. When billing is enabled, you can provide proof of enrollment here.',
    );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton label="Checkout" onPress={() => go('checkout')} />
        <Text style={[type.title, { color: colors.ink }]}>Payment details</Text>
        <Text style={[type.sub, { color: colors.muted, marginTop: 6 }]}>
          {isStudent
            ? 'Confirm student pricing and enter your payment details to continue.'
            : 'Enter your payment details to continue with regular pricing.'}
        </Text>

        <Section label="Order summary" style={{ marginTop: 24 }}>
          <Card style={styles.card}>
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.planName, { color: colors.ink }]}>Plus plan</Text>
                <Text style={[styles.summaryMeta, { color: colors.muted }]}>
                  {pricingLabel} pricing · {isStudent ? 'Student verification required' : 'No verification required'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                <Text style={[styles.badgeText, { color: colors.onBrand }]}>{isStudent ? '₱99/MO' : '₱149/MO'}</Text>
              </View>
            </View>
            <Divider style={{ marginVertical: 12 }} />
            <MetaRow label="Plan" value="Plus" />
            <View style={{ height: 8 }} />
            <MetaRow label="Price" value={price} />
            <View style={{ height: 8 }} />
            <MetaRow label="Billing" value="Monthly (when available)" />
          </Card>
        </Section>

        {isStudent ? (
          <Section label="Student verification">
            <Card style={styles.card}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>Student email</Text>
              <TextInput
                value={studentEmail}
                onChangeText={setStudentEmail}
                placeholder="name@school.edu"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[
                  styles.input,
                  { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface2 },
                ]}
              />
              <Text style={[styles.help, { color: colors.muted }]}>
                Use your student email, or provide proof of enrollment below.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={proofDemo}
                style={({ pressed }) => [
                  styles.proofRow,
                  { borderColor: colors.line, backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Icon name="document-attach-outline" size={18} color={colors.brand} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.proofTitle, { color: colors.ink }]}>Upload proof of enrollment</Text>
                  <Text style={[styles.help, { color: colors.muted, marginTop: 2 }]}>Student ID or enrollment document (demo)</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </Card>
          </Section>
        ) : null}

        <Section label="Payment method">
          <Card style={styles.card}>
            <Field
              label="Cardholder name"
              value={cardName}
              onChangeText={setCardName}
              placeholder="Name on card"
            />
            <Field
              label="Card number"
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="1234 5678 9012 3456"
              keyboardType="number-pad"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Expiry"
                  value={expiry}
                  onChangeText={setExpiry}
                  placeholder="MM/YY"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="CVC" value={cvc} onChangeText={setCvc} placeholder="123" keyboardType="number-pad" />
              </View>
            </View>
            <Text style={[styles.help, { color: colors.muted, marginTop: 4 }]}>
              Demo only: payment details are not saved or charged.
            </Text>
          </Card>
        </Section>

        <View style={styles.actions}>
          <Button block label={`Confirm and pay (demo) · ${isStudent ? '₱99/mo' : '₱149/mo'}`} onPress={confirmDemo} />
          <Button block ghost label="Back to pricing options" onPress={() => go('checkout')} style={{ marginTop: 10 }} />
        </View>

        <Card tone="muted" style={styles.noteCard}>
          <Text style={[styles.note, { color: colors.muted }]}>
            This is a demo payment screen. No payment is processed, no card is charged
            {isStudent ? ', and no student verification is completed' : ''}.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
}) {
  const { colors } = useApp();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.ink }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType ?? 'default'}
        style={[
          styles.input,
          { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface2 },
        ]}
      />
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

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingHorizontal: 20 },
  card: { padding: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planName: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  summaryMeta: { ...type.hint, marginTop: 3 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  help: { ...type.hint, lineHeight: 18 },
  proofRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  proofTitle: { fontFamily: fonts.medium, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metaLabel: { ...type.sub, flexShrink: 0 },
  metaValue: { ...type.sub, fontFamily: fonts.medium, flex: 1, textAlign: 'right' },
  actions: { marginTop: 22 },
  noteCard: { marginTop: 18, padding: 16 },
  note: { ...type.hint, lineHeight: 18, textAlign: 'center' },
});
