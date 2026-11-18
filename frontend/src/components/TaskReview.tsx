import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Segmented } from './ui';
import { useApp } from '../state';
import { fonts } from '../theme';
import type { Day, Effort, TaskProposal } from '../types';

function ProposalCard({ proposal }: { proposal: TaskProposal }) {
  const { colors, updateReviewProposal, removeReviewProposal } = useApp();
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      color: colors.ink,
    },
  ];
  const labelStyle = [styles.label, { color: colors.muted }];

  return (
    <Card style={styles.proposal}>
      <View style={styles.proposalHead}>
        <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14, flex: 1 }}>
          Proposed task
        </Text>
        <Button
          small
          ghost
          danger
          label="Remove task"
          onPress={() => removeReviewProposal(proposal.key)}
        />
      </View>

      {proposal.warnings.map((warning) => (
        <Text key={warning} style={{ color: colors.warn, fontFamily: fonts.medium, fontSize: 12 }}>
          {warning}
        </Text>
      ))}

      <Text style={labelStyle}>Task name</Text>
      <TextInput
        value={proposal.title}
        onChangeText={(title) => updateReviewProposal(proposal.key, { title })}
        maxLength={80}
        accessibilityLabel="Task name"
        placeholder="What needs doing?"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Text style={labelStyle}>Duration (minutes)</Text>
          <TextInput
            value={proposal.durationText}
            onChangeText={(durationText) => updateReviewProposal(proposal.key, { durationText })}
            accessibilityLabel="Estimated duration in minutes"
            keyboardType="number-pad"
            placeholder="45"
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />
        </View>
        <View style={styles.column}>
          <Text style={labelStyle}>Start time (optional)</Text>
          <TextInput
            value={proposal.startText}
            onChangeText={(startText) => updateReviewProposal(proposal.key, { startText })}
            accessibilityLabel="Scheduled start time"
            autoCapitalize="none"
            placeholder="14:30 or 6pm"
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />
        </View>
      </View>

      <Text style={labelStyle}>Deadline (optional)</Text>
      <TextInput
        value={proposal.dueText}
        onChangeText={(dueText) => updateReviewProposal(proposal.key, { dueText })}
        accessibilityLabel="Deadline date"
        autoCapitalize="none"
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <Text style={labelStyle}>Day</Text>
      <Segmented<Day>
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
        ]}
        value={proposal.day}
        onChange={(day) => updateReviewProposal(proposal.key, { day })}
      />

      <Text style={labelStyle}>Effort</Text>
      <Segmented<Effort>
        options={[
          { value: 'low', label: 'Low' },
          { value: 'med', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
        value={proposal.effort}
        onChange={(effort) => updateReviewProposal(proposal.key, { effort })}
      />

      <Text style={labelStyle}>Priority</Text>
      <Segmented<1 | 2 | 3>
        options={[
          { value: 1, label: 'Low' },
          { value: 2, label: 'Normal' },
          { value: 3, label: 'High' },
        ]}
        value={proposal.priority}
        onChange={(priority) => updateReviewProposal(proposal.key, { priority })}
      />
    </Card>
  );
}

export function TaskReview() {
  const {
    pendingReview,
    reviewError,
    colors,
    addReviewProposal,
    cancelTaskReview,
    confirmTaskReview,
  } = useApp();
  if (!pendingReview) return null;

  const count = pendingReview.proposals.length;
  const confirmLabel = count
    ? `Add ${count} task${count === 1 ? '' : 's'} to plan`
    : pendingReview.parsed.energy
      ? 'Apply energy update'
      : 'Finish review';

  return (
    <View style={styles.panel}>
      <Card tone="accent" style={styles.intro}>
        <Text style={{ color: colors.onAccent, fontFamily: fonts.bold, fontSize: 16 }}>
          Review before adding
        </Text>
        <Text style={{ color: colors.onAccent, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 }}>
          {count
            ? `${count} proposed task${count === 1 ? '' : 's'}. Nothing has been added to your plan yet.`
            : 'No tasks selected. Your existing plan will stay unchanged.'}
        </Text>
      </Card>

      {pendingReview.proposals.map((proposal) => (
        <ProposalCard key={proposal.key} proposal={proposal} />
      ))}

      <Button
        small
        ghost
        icon="add"
        label="Add a missing task"
        onPress={addReviewProposal}
        style={{ alignSelf: 'flex-start' }}
      />

      {reviewError ? (
        <Text accessibilityLiveRegion="assertive" style={{ color: colors.warn, fontFamily: fonts.medium, fontSize: 13 }}>
          {reviewError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button small ghost label="Cancel" onPress={cancelTaskReview} />
        <Button small label={confirmLabel} onPress={confirmTaskReview} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    paddingBottom: 6,
  },
  intro: {
    gap: 5,
  },
  proposal: {
    gap: 2,
  },
  proposalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
