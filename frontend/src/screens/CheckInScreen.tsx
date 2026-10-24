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

import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { useVoiceInput } from '../lib/useVoiceInput';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { ChatCta, ChatMessage } from '../types';

export function CheckInScreen() {
  const {
    state,
    colors,
    typing,
    sendCheckIn,
    go,
    moveN,
  } = useApp();
  const [text, setText] = useState('');
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
  }, [state.chat.length, typing]);

  const submit = () => {
    if (!text.trim()) return;
    const value = text;
    setText('');
    void sendCheckIn(value);
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
  };

  const renderMessage = (message: ChatMessage) => {
    const mine = message.from === 'me';
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

        {message.tasks?.length ? (
          <View style={styles.added}>
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
                  {task.when}
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={styles.header}>
        <Text style={[type.title, { color: colors.ink }]}>Check-in</Text>
        <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
          Type or speak. I will sort it into your day.
        </Text>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {[
            'Finish the quarterly report 2h, call the dentist, reply to Sam\'s email, gym at 6pm',
            "I'm tired today. Study for the chem exam 90m, laundry",
            'Tomorrow: write the essay intro, buy groceries',
            "I'm stuck on the budget spreadsheet",
          ].map((chip) => (
            <Pressable
              key={chip}
              accessibilityRole="button"
              onPress={() => void sendCheckIn(chip)}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: fonts.regular,
                  fontSize: 12.5,
                }}
              >
                {chip.length > 34 ? `${chip.slice(0, 32)}...` : chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={chatRef}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        accessibilityLiveRegion="polite"
        showsVerticalScrollIndicator={false}
      >
        {state.chat.map(renderMessage)}
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
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.chatbar, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.askbar,
            { backgroundColor: colors.surface, borderColor: colors.accent },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder={listening ? 'Listening...' : 'Tell me about your day...'}
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            style={[styles.askInput, { color: colors.ink }]}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voice input"
            disabled={!supported}
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
            onPress={submit}
            style={[styles.round, { backgroundColor: colors.brand }]}
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
  chips: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 13,
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
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
