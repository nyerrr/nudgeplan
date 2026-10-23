import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '../components/Icon';
import { TaskRow } from '../components/TaskRow';
import {
  Button,
  Card,
  Empty,
  Label,
  Meter,
  Segmented,
} from '../components/ui';
import {
  fmtDuration,
  fmtTime,
  greeting,
  realityCheck,
  sortedTasks,
} from '../lib/engine';
import { useApp } from '../state';
import { fonts, type } from '../theme';
import type { Energy } from '../types';

export function HomeScreen() {
  const {
    state,
    colors,
    sendCheckIn,
    setEnergy,
    go,
    notify,
    setFocus,
    moveN,
    voiceSample,
  } = useApp();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const micTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (micTimer.current) clearTimeout(micTimer.current);
    },
    [],
  );

  const reality = realityCheck(state);
  const upNext = sortedTasks(state.tasks, 'today')
    .filter((task) => !task.done)
    .slice(0, 3);
  const next = upNext[0];

  const submit = () => {
    if (!text.trim()) return;
    const value = text;
    setText('');
    void sendCheckIn(value);
  };

  const listen = () => {
    if (listening) return;
    setListening(true);
    micTimer.current = setTimeout(() => {
      setText(voiceSample());
      setListening(false);
    }, 1600);
  };

  const moveCount = reality.over ? reality.moves : 1;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.ink }]}>
            {greeting()}, {state.name}
          </Text>
          <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
            Let&apos;s shape your day.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          onPress={() => go('profile')}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: colors.brand, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text
            style={{
              color: colors.onBrand,
              fontFamily: fonts.bold,
              fontSize: 16,
            }}
          >
            {state.name.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

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
          onPress={listen}
          style={[
            styles.round,
            {
              backgroundColor: listening ? colors.warn : colors.surface2,
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

      <View
        style={[
          styles.reality,
          { backgroundColor: reality.over ? colors.warn : colors.accent },
        ]}
      >
        <Text
          style={[
            styles.realityK,
            { color: reality.over ? colors.onWarn : colors.onAccent },
          ]}
        >
          REALITY CHECK
        </Text>
        <Text
          style={[
            styles.realityT,
            { color: reality.over ? colors.onWarn : colors.onAccent },
          ]}
        >
          {reality.message}
        </Text>
        <Meter
          percent={reality.percent}
          color={reality.over ? colors.onWarn : colors.onAccent}
          track="rgba(0,0,0,.16)"
        />
        <Text
          style={[
            type.hint,
            {
              color: reality.over ? colors.onWarn : colors.onAccent,
              opacity: 0.85,
              marginTop: 6,
              fontFamily: fonts.regular,
            },
          ]}
        >
          {fmtDuration(reality.planned)} planned of {fmtDuration(reality.available)}{' '}
          open
        </Text>
        {reality.tight ? (
          <View style={styles.realityActions}>
            <Button
              small
              label={`Move ${moveCount} to tomorrow`}
              background={reality.over ? colors.onWarn : colors.onAccent}
              foreground={reality.over ? colors.warn : colors.accent}
              onPress={() => moveN(moveCount)}
            />
            <Button
              small
              ghost
              label="Keep it"
              foreground={reality.over ? colors.onWarn : colors.onAccent}
              outline={reality.over ? colors.onWarn : colors.onAccent}
              onPress={() => notify('Okay. I will check your load again at midday.')}
            />
          </View>
        ) : null}
      </View>

      <Label>Energy right now</Label>
      <Segmented<Energy>
        options={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
        value={state.energy}
        onChange={setEnergy}
      />
      <Text
        style={[
          type.hint,
          {
            color: colors.muted,
            marginTop: 8,
            fontFamily: fonts.regular,
          },
        ]}
      >
        Planning around {fmtDuration(reality.available)} of open time today.
      </Text>

      <Label>Up next</Label>
      {upNext.length ? (
        <View style={styles.list}>
          {upNext.map((task) => (
            <TaskRow key={task.id} task={task} withTime />
          ))}
        </View>
      ) : (
        <Card>
          <Empty style={{ paddingVertical: 18 }}>
            Nothing planned. Tap the plus to check in.
          </Empty>
        </Card>
      )}

      {state.nudges ? (
        <>
          <Label>Nudge</Label>
          <Card>
            {next ? (
              <>
                <Text style={[type.body, { color: colors.ink }]}>
                  <Text style={{ fontFamily: fonts.bold }}>{next.title}</Text> is
                  next{next.start != null ? ` at ${fmtTime(next.start)}` : ''}.
                  Ready for a 10 minute start?
                </Text>
                <View style={[styles.rowflex, { marginTop: 10 }]}>
                  <Button
                    small
                    label="Start now"
                    onPress={() => {
                      setFocus(next.id);
                      go('focus');
                    }}
                  />
                  <Button
                    small
                    ghost
                    label="Later"
                    onPress={() =>
                      notify('Okay. I will nudge you again in 15 minutes.')
                    }
                  />
                </View>
              </>
            ) : (
              <Text style={[type.body, { color: colors.ink }]}>
                All clear. Nothing left on today&apos;s plan.
              </Text>
            )}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
  reality: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  realityK: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.26,
  },
  realityT: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 10,
  },
  realityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  list: {
    gap: 8,
  },
  rowflex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
});
