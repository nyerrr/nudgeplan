import React, { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { TaskReview } from '../components/TaskReview';
import { Button } from '../components/ui';
import { useVoiceInput } from '../lib/useVoiceInput';
import { useApp } from '../state';
import { elevationStyle, fonts, type } from '../theme';
import type { ChatCta, ChatMessage } from '../types';

export function CheckInScreen() {
  const {
    state,
    colors,
    typing,
    pendingReview,
    sendCheckIn,
    go,
    moveN,
    lastCheckInSource,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const hasConversation = state.chat.length > 0;

  useEffect(() => {
    if (!typing) {
      setThinkingSeconds(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setThinkingSeconds(Math.round(((Date.now() - start) / 1000) * 10) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [typing]);

  const examples = [
    {
      title: 'Plan my workday',
      prompt: 'Finish the quarterly report 2h, call the dentist, reply to Sam\'s email, gym at 6pm',
    },
    {
      title: 'I have an exam Friday',
      prompt: 'I have an organic chemistry exam on Friday and need to prepare',
    },
    {
      title: 'Plan my morning',
      prompt: 'Plan my morning: draft the intro 45m, team standup at 10am, reply to emails',
    },
    {
      title: 'I’m overwhelmed',
      prompt: 'I’m overwhelmed with too much to do today, help me pick the top 3',
    },
    {
      title: 'I’m tired today',
      prompt: "I'm tired today. Study for the chem exam 90m, laundry",
    },
    {
      title: 'I’m feeling stuck',
      prompt: "I'm stuck on the budget spreadsheet",
    },
  ];

  const quickActions = [
    { label: 'Lighter', prompt: 'Make my plan lighter for today' },
    { label: 'Fewer tasks', prompt: 'Keep only top 2 most important tasks' },
    { label: 'Move to tomorrow', prompt: 'Move remaining tasks to tomorrow' },
    { label: 'Ask me one question', prompt: 'Ask me one question to help prioritize' },
  ];
  const { listening, start, supported } = useVoiceInput({
    onTranscript: (value) => {
      setText((current) => (current.trim() ? `${current} ${value}` : value));
    },
  });
  const chatRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      chatRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(id);
  }, [state.chat.length, typing, pendingReview]);

  const submit = () => {
    if (typing || !text.trim()) return;
    const value = text;
    void sendCheckIn(value).then((accepted) => {
      if (accepted) setText((current) => (current === value ? '' : current));
    });
  };

  const listen = () => {
    if (!supported) return;
    void start();
  };

  const onCta = (cta: ChatCta) => {
    if (cta.act === 'focus') go('focus');
    else if (cta.act === 'plan') go('plan');
    else if (cta.act === 'checkin') go('checkin');
    else if (cta.act === 'moveN') moveN(Number(cta.arg) || 1);
    else if (cta.act === 'prompt') {
      const value = cta.arg || cta.label;
      void sendCheckIn(value);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const mine = message.from === 'me';
    const scheduledTasks =
      message.tasks?.filter((task) => task.when !== 'Needs room').length ?? 0;
    const unscheduledTasks = (message.tasks?.length ?? 0) - scheduledTasks;
    return (
      <View
        key={message.id}
        style={[
          styles.message,
          mine
            ? {
                alignSelf: 'flex-end',
                backgroundColor: colors.accent,
                borderBottomRightRadius: 6,
              }
            : {
                alignSelf: 'flex-start',
                backgroundColor: colors.surface,
                borderColor: colors.line,
                borderWidth: 1,
                borderBottomLeftRadius: 6,
              },
        ]}
      >
        {!mine && message.source ? (
          <View style={[styles.sourceBadge, { backgroundColor: colors.surface2 }]}>
            <Icon
              name={message.source === 'gemini' ? 'sparkles' : 'flash-outline'}
              size={11}
              color={colors.brand}
            />
            <Text style={[styles.sourceBadgeText, { color: colors.muted }]}>
              {message.source === 'gemini' ? 'Gemini' : 'Offline'}
            </Text>
          </View>
        ) : null}

        <Text
          style={[
            type.body,
            {
              color: mine ? colors.onAccent : colors.ink,
              fontFamily: fonts.regular,
            },
          ]}
        >
          {message.text}
        </Text>

        {message.capacityWarning ? (
          <View
            style={[
              styles.capacityWarningCard,
              { backgroundColor: colors.surface2, borderColor: colors.warn },
            ]}
          >
            <Icon name="alert-circle-outline" size={14} color={colors.warn} />
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.medium,
                fontSize: 12,
                flex: 1,
              }}
            >
              {message.capacityWarning}
            </Text>
          </View>
        ) : null}

        {message.actions?.length ? (
          <View style={styles.actionsList}>
            {message.actions.map((act, idx) => (
              <View
                key={`act-${idx}`}
                style={[
                  styles.actionCard,
                  { backgroundColor: colors.surface2, borderColor: colors.line },
                ]}
              >
                <Icon name="checkmark-circle" size={14} color={colors.low} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontFamily: fonts.medium,
                      fontSize: 12.5,
                    }}
                  >
                    {act.type.toUpperCase()}: {act.title || act.taskId}
                  </Text>
                  {act.rationale ? (
                    <Text
                      style={{
                        color: colors.muted,
                        fontFamily: fonts.regular,
                        fontSize: 11.5,
                        marginTop: 1,
                      }}
                    >
                      {act.rationale}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {message.proposedTasks?.length ? (
          <View style={styles.proposedCardsList}>
            <Text
              style={{
                color: colors.muted,
                fontFamily: fonts.semibold,
                fontSize: 11.5,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginTop: 2,
              }}
            >
              Proposed Tasks ({message.proposedTasks.length})
            </Text>
            {message.proposedTasks.map((t, idx) => (
              <View
                key={`prop-${idx}`}
                style={[
                  styles.inlineTaskCard,
                  { backgroundColor: colors.surface2, borderColor: colors.line },
                ]}
              >
                <View style={styles.inlineTaskHeader}>
                  <View style={styles.inlineTaskKindRow}>
                    <View
                      style={[
                        styles.kindBadge,
                        {
                          backgroundColor:
                            t.kind === 'event'
                              ? colors.warn
                              : t.kind === 'reminder'
                                ? colors.surface
                                : colors.brand,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.bg,
                          fontFamily: fonts.semibold,
                          fontSize: 10,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.kind ?? 'task'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.ink,
                        fontFamily: fonts.semibold,
                        fontSize: 13,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.brand,
                      fontFamily: fonts.semibold,
                      fontSize: 12,
                    }}
                  >
                    {t.dur}m
                  </Text>
                </View>
                <View style={styles.inlineTaskMeta}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontFamily: fonts.regular,
                      fontSize: 11.5,
                    }}
                  >
                    {t.day === 'tomorrow' ? 'Tomorrow' : 'Today'}
                    {t.start != null
                      ? ` at ${Math.floor(t.start / 60)}:${String(t.start % 60).padStart(2, '0')}`
                      : ''}
                    {t.dueDate ? ` · Due ${t.dueDate}` : ''}
                    {` · ${t.effort} effort`}
                  </Text>
                  {t.steps?.length ? (
                    <Text
                      style={{
                        color: colors.muted,
                        fontFamily: fonts.medium,
                        fontSize: 11,
                      }}
                    >
                      {t.steps.length} steps
                    </Text>
                  ) : null}
                </View>
                {t.rationale ? (
                  <Text
                    style={{
                      color: colors.muted,
                      fontFamily: fonts.regular,
                      fontStyle: 'italic',
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {t.rationale}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : message.tasks?.length ? (
          <View style={styles.added}>
            <View style={styles.addedSummary}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  flex: 1,
                }}
              >
                {message.tasks.length} {message.tasks.length === 1 ? 'task' : 'tasks'} found
              </Text>
              {unscheduledTasks ? (
                <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12 }}>
                  {unscheduledTasks} need a time
                </Text>
              ) : null}
            </View>
            {message.tasks.map((task, index) => (
              <View
                key={`${task.title}-${index}`}
                style={[
                  styles.addedRow,
                  { backgroundColor: colors.surface2 },
                ]}
              >
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.regular,
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {task.title}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: fonts.semibold,
                    fontSize: 12.5,
                  }}
                >
                  {task.when === 'Needs room' ? 'Not scheduled' : task.when}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {message.cta?.length ? (
          <View style={styles.cta}>
            {message.cta.map((cta) => (
              <Button
                key={`${cta.act}-${cta.label}`}
                small
                label={cta.label}
                ghost={cta.ghost}
                onPress={() => onCta(cta)}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 20}
    >
      <View style={styles.header}>
        <Text style={[type.title, { color: colors.ink }]}>
          {hasConversation ? 'Check-in' : 'What’s on your mind?'}
        </Text>
        <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
          {hasConversation
            ? 'Add anything new and I’ll help shape it into your day.'
            : 'Brain dump anything. I’ll help make it manageable.'}
        </Text>
      </View>

      <ScrollView
        ref={chatRef}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[styles.chat, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        accessibilityLiveRegion="polite"
        showsVerticalScrollIndicator={false}
      >
        {!hasConversation ? (
          <View style={styles.emptyIntro}>
            <Text style={[styles.emptyIntroTitle, { color: colors.ink }]}>
              Tell me what you need to do, how you feel, or what feels difficult.
            </Text>
            <Text style={[styles.emptyIntroBody, { color: colors.muted }]}>
              I’ll sort it into a realistic plan without asking you to organize it first.
            </Text>
            <View style={styles.quickExamples}>
              {examples.map((example) => (
                <Pressable
                  key={example.title}
                  accessibilityRole="button"
                  accessibilityLabel={example.title}
                  disabled={typing || !!pendingReview}
                  onPress={() => void sendCheckIn(example.prompt)}
                  style={[styles.quickExample, { backgroundColor: colors.surface, borderColor: colors.line }]}
                >
                  <Text style={{ color: colors.ink, fontFamily: fonts.medium, fontSize: 12.5 }}>
                    {example.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {state.chat.map(renderMessage)}
        <TaskReview />
        {typing ? (
          <View
            style={[
              styles.typing,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
            accessibilityLabel="Typing"
          >
            <View style={[styles.dot, { backgroundColor: colors.low }]} />
            <View
              style={[
                styles.dot,
                { backgroundColor: colors.low, opacity: 0.65 },
              ]}
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: colors.low, opacity: 0.4 },
              ]}
            />
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.medium,
                color: colors.muted,
                marginLeft: 6,
              }}
            >
              Thinking... ({thinkingSeconds.toFixed(1)}s)
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {lastCheckInSource === 'offline' && !typing ? (
        <View style={{ alignItems: 'flex-start', marginHorizontal: 18, marginTop: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again with Gemini"
            onPress={() => {
              const lastUser = [...state.chat].reverse().find((m) => m.from === 'me');
              if (lastUser) void sendCheckIn(lastUser.text);
            }}
            style={[
              styles.retryBtn,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <Icon name="refresh-outline" size={13} color={colors.brand} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.medium,
                color: colors.brand,
              }}
            >
              Try again with Gemini
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsContainer}
      >
        {quickActions.map((qa) => (
          <Pressable
            key={qa.label}
            accessibilityRole="button"
            accessibilityLabel={qa.label}
            disabled={typing}
            onPress={() => void sendCheckIn(qa.prompt)}
            style={[
              styles.quickActionChip,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: fonts.medium,
                fontSize: 12,
              }}
            >
              {qa.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.chatbar, { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showExamples }}
          accessibilityLabel={showExamples ? 'Hide examples' : 'Show examples'}
          onPress={() => setShowExamples((value) => !value)}
          style={styles.examplesToggle}
        >
          <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12 }}>
            Need inspiration?
          </Text>
          <View style={styles.examplesToggleAction}>
            <Text style={{ color: colors.brand, fontFamily: fonts.semibold, fontSize: 12 }}>
              {showExamples ? 'Hide examples' : 'Show examples'}
            </Text>
            <Icon name={showExamples ? 'chevron-up' : 'chevron-down'} size={14} color={colors.brand} />
          </View>
        </Pressable>
        {showExamples ? (
          <View style={styles.compactExamples}>
            {examples.map((example) => (
              <Pressable
                key={example.title}
                accessibilityRole="button"
                accessibilityLabel={example.title}
                disabled={typing}
                onPress={() => void sendCheckIn(example.prompt)}
                style={[styles.compactExample, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <Text style={{ color: colors.ink, fontFamily: fonts.medium, fontSize: 12 }}>
                  {example.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View
          style={[
            styles.askbar,
            elevationStyle(colors),
            { backgroundColor: colors.surface, borderColor: colors.accent },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            editable={!typing}
            placeholder={listening ? 'Listening...' : 'Tell me about your day...'}
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            style={[styles.askInput, { color: colors.ink }]}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voice input"
            disabled={!supported || typing}
            onPress={listen}
            style={[
              styles.round,
              {
                backgroundColor: listening
                  ? colors.warn
                  : supported
                    ? colors.surface2
                    : colors.line,
                opacity: supported ? 1 : 0.5,
              },
            ]}
          >
            <Icon
              name="mic-outline"
              size={18}
              color={listening ? colors.onWarn : colors.brand}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: typing }}
            disabled={typing}
            onPress={submit}
            style={[
              styles.round,
              { backgroundColor: colors.brand, opacity: typing ? 0.5 : 1 },
            ]}
          >
            <Icon name="send" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  examplesToggle: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  examplesToggleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyIntro: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 28,
  },
  emptyIntroTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 310,
  },
  emptyIntroBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 8,
  },
  quickExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
  },
  quickExample: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  compactExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  compactExample: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chat: {
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
  },
  message: {
    maxWidth: '88%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 8,
  },
  added: {
    gap: 4,
  },
  addedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 3,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typing: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chatbar: {
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  askbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
  },
  askInput: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  sourceBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
  },
  capacityWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  actionsList: {
    gap: 6,
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  proposedCardsList: {
    gap: 6,
    marginTop: 6,
  },
  inlineTaskCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  inlineTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  inlineTaskKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  kindBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inlineTaskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  quickActionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    minHeight: 32,
    justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
});
