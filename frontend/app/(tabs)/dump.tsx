import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchPlan } from '../../src/api/plan';
import { Button } from '../../src/components/ui';
import { dumpPrompts } from '../../src/data/dumpPrompts';
import { usePlan } from '../../src/store/PlanContext';
import { colors, radius, spacing, type } from '../../src/theme';

type Phase = 'idle' | 'thinking';

export default function DumpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { setPending } = usePlan();

  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    if (!text.trim() || phase === 'thinking') return;
    setPhase('thinking');
    setError(null);

    try {
      const plan = await fetchPlan(text.trim());

      if (plan.tasks.length === 0) {
        setError(
          "I couldn't pull any tasks out of that. Try naming the things you actually need to do."
        );
        setPhase('idle');
        return;
      }

      setPending(plan.tasks, { model: plan.model, breakdown: plan.breakdown });
      setText('');
      setPhase('idle');
      router.push('/confirm');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPhase('idle');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>What's on your mind?</Text>
        <Text style={styles.subtitle}>
          Say it however it comes out. Messy is fine.
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="I need to finish my paper, do laundry, call my mom, and the gym before the deadline..."
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.counter}>{text.length}/2000</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.examplesLabel}>TRY ONE</Text>
        <View style={styles.examples}>
          {dumpPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => setText(prompt)}
              style={({ pressed }) => [styles.exampleChip, pressed && styles.examplePressed]}
            >
              <Text style={styles.exampleText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Pull it apart"
          size="lg"
          fullWidth
          loading={phase === 'thinking'}
          disabled={!text.trim()}
          onPress={submit}
        />
        {phase === 'thinking' ? (
          <Text style={styles.thinkingText}>Gemini is reading your dump...</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title: { ...type.title, color: colors.text, marginTop: spacing.sm },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4, lineHeight: 19 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  inputWrap: {
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  input: {
    ...type.body,
    color: colors.text,
    minHeight: 140,
    lineHeight: 22,
  },
  counter: {
    ...type.micro,
    color: colors.textFaint,
    textAlign: 'right',
    marginTop: spacing.sm,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.28)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorIcon: { color: colors.danger },
  errorText: { ...type.caption, color: colors.danger, flex: 1 },

  examplesLabel: {
    ...type.micro,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  examples: { gap: spacing.sm },
  exampleChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  examplePressed: { opacity: 0.6 },
  exampleText: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  thinkingText: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
