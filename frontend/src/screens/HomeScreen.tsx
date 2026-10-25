import React, { useState } from 'react';
import {
  Modal,
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
} from '../components/ui';
import {
  fmtDuration,
  fmtTime,
  greeting,
  realityCheck,
  sortedTasks,
} from '../lib/engine';
import { useVoiceInput } from '../lib/useVoiceInput';
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
    snoozeNudge,
    openTaskSheet,
  } = useApp();
  const [text, setText] = useState('');
  const [showEnergy, setShowEnergy] = useState(false);
  const energyColor = (energy: Energy) =>
    energy === 'low' ? colors.low : energy === 'high' ? colors.high : colors.accent;
  const { listening, start, supported } = useVoiceInput({
    onTranscript: (value) => {
      setText((current) => (current.trim() ? `${current} ${value}` : value));
    },
  });

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
    if (!supported) return;
    void start();
  };

  const moveCount = reality.over ? reality.moves : 1;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={[type.title, styles.greeting, { color: colors.ink }]}>
            {greeting()}
          </Text>
          <Text style={[type.title, styles.greetingName, { color: colors.ink }]}>
            {state.name}
          </Text>
          <Text style={[type.sub, { color: colors.muted, marginTop: 2 }]}>
            Let&apos;s shape your day.
          </Text>
        </View>
        <View style={styles.headActions}>
          <View style={styles.headControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showEnergy }}
              accessibilityLabel={`Energy is ${state.energy}. Adjust energy`}
              onPress={() => setShowEnergy((value) => !value)}
              style={[
                styles.energyBadge,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <View
                style={[
                  styles.energyDot,
                  { backgroundColor: energyColor(state.energy) },
                ]}
              />
              <Text style={[styles.energyBadgeText, { color: colors.ink }]}>
                {state.energy === 'low'
                  ? 'Low energy'
                  : state.energy === 'high'
                    ? 'High energy'
                    : 'Steady'}
              </Text>
              <Icon
                name={showEnergy ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.brand}
              />
            </Pressable>
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
        </View>
      </View>

      <Modal
        visible={showEnergy}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEnergy(false)}
      >
        <View style={styles.energyOverlay}>
          <Pressable
            accessibilityLabel="Close energy menu"
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEnergy(false)}
          />
          <View
            style={[
              styles.energyMenu,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            {(['low', 'medium', 'high'] as Energy[]).map((energy) => {
              const active = state.energy === energy;
              const label =
                energy === 'low' ? 'Low' : energy === 'high' ? 'High' : 'Medium';
              return (
                <Pressable
                  key={energy}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setEnergy(energy);
                    setShowEnergy(false);
                  }}
                  style={[
                    styles.energyOption,
                    active ? { backgroundColor: colors.surface2 } : null,
                  ]}
                >
                  <View
                    style={[
                      styles.energyOptionDot,
                      { backgroundColor: energyColor(energy) },
                    ]}
                  />
                  <Text
                    style={{
                      color: colors.ink,
                      fontFamily: active ? fonts.bold : fonts.medium,
                      fontSize: 13,
                      flex: 1,
                    }}
                  >
                    {label}
                  </Text>
                  {active ? <Icon name="checkmark" size={16} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

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
          placeholder={listening ? 'Listening...' : 'What’s on your mind?'}
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

      <View
        style={[
          styles.reality,
          {
            backgroundColor: reality.over ? '#FEE2E2' : colors.surface2,
            borderLeftColor: reality.over ? colors.warn : colors.brand,
          },
        ]}
      >
        <Text
          style={[
            styles.realityK,
            { color: reality.over ? '#7F1D1D' : colors.ink },
          ]}
        >
          REALITY CHECK
        </Text>
        <Text
          style={[
            styles.realityT,
            { color: reality.over ? '#7F1D1D' : colors.ink },
          ]}
        >
          {reality.over
            ? reality.message
            : `You have ${fmtDuration(reality.planned)} planned and ${fmtDuration(
                reality.available,
              )} of open time.`}
        </Text>
        <Meter
          percent={reality.percent}
          color={reality.over ? colors.warn : colors.accent}
          track={colors.line}
        />
        <Text
          style={[
            type.hint,
            {
              color: reality.over ? '#7F1D1D' : colors.muted,
              marginTop: 6,
              fontFamily: fonts.regular,
            },
          ]}
        >
          {reality.over
            ? `${fmtDuration(reality.planned)} planned of ${fmtDuration(reality.available)} open`
            : 'Your day has room. Start with one task.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjust hours and energy"
          onPress={() => go('profile')}
          style={({ pressed }) => [
            styles.adjustPlan,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text
            style={{
              color: reality.over ? '#7F1D1D' : colors.brand,
              fontFamily: fonts.semibold,
              fontSize: 12.5,
            }}
          >
            Adjust hours and energy
          </Text>
          <Icon
            name="chevron-forward"
            size={14}
            color={reality.over ? '#7F1D1D' : colors.brand}
          />
        </Pressable>
        {reality.tight ? (
          <View style={styles.realityActions}>
            <Button
              small
              label={`Move ${moveCount} to tomorrow`}
              background={reality.over ? colors.warn : colors.brand}
              foreground="#FFFFFF"
              onPress={() => moveN(moveCount)}
            />
            <Button
              small
              ghost
              label="Keep it"
              foreground={reality.over ? '#7F1D1D' : colors.brand}
              outline={reality.over ? colors.warn : colors.brand}
              onPress={() => notify('Okay. I will check your load again at midday.')}
            />
          </View>
        ) : null}
      </View>

      <Text
        style={[
          type.hint,
          {
            color: colors.muted,
            marginTop: 12,
            fontFamily: fonts.regular,
          },
        ]}
      >
        Planning around {fmtDuration(reality.available)} of open time today.
      </Text>

      {next ? (
        <Card style={styles.recommended}>
          <View style={styles.recommendedHeader}>
            <View style={[styles.recommendedIcon, { backgroundColor: colors.accent }]}>
              <Icon name="play" size={16} color={colors.onAccent} />
            </View>
            <Text style={[styles.recommendedK, { color: colors.brand }]}>
              SUGGESTED NEXT STEP
            </Text>
          </View>
          <Text style={[styles.recommendedTitle, { color: colors.ink }]}>
            {next.title}
          </Text>
          <Text style={[styles.recommendedBody, { color: colors.muted }]}>
            Start with one focused step instead of planning the whole task.
          </Text>
          <Button
            small
            label="Start focus"
            onPress={() => {
              setFocus(next.id);
              go('focus');
            }}
            style={{ alignSelf: 'flex-start', marginTop: 12 }}
          />
        </Card>
      ) : null}

      <Label>Up next</Label>
      {upNext.length ? (
        <View style={styles.list}>
          {upNext.map((task) => (
            <TaskRow key={task.id} task={task} withTime />
          ))}
        </View>
      ) : (
        <Card style={styles.emptyState}>
          <Icon name="sparkles-outline" size={30} color={colors.brand} />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>
            Nothing on the plan yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Brain dump what&apos;s on your mind and I&apos;ll shape it into a realistic next step.
          </Text>
          <Button
            block
            label="Brain dump"
            onPress={() => go('checkin')}
            style={{ marginTop: 12 }}
          />
          <Button
            block
            small
            ghost
            label="Add a specific task"
            onPress={() => openTaskSheet(null)}
            style={{ marginTop: 6 }}
          />
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
    gap: 8,
    marginBottom: 16,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  greetingName: {
    lineHeight: 25,
  },
  headActions: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  headControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  energyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  energyBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  reality: {
    borderRadius: 18,
    borderLeftWidth: 4,
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
  adjustPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 2,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 10,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 300,
  },
  rowflex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  energyOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingRight: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  energyMenu: {
    width: 150,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  energyOption: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  energyOptionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recommended: {
    marginTop: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#3F8EFC',
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedK: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  recommendedTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 10,
  },
  recommendedBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
