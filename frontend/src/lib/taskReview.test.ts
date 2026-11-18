import { describe, expect, it } from 'vitest';

import { initialState } from './engine';
import {
  approvedCheckIn,
  cancelTaskReview,
  createTaskReview,
  validateTaskProposal,
} from './taskReview';
import type { ParsedCheckIn } from '../types';

const parsed: ParsedCheckIn = {
  items: [
    {
      title: 'Write report',
      dur: 45,
      effort: 'high',
      day: 'today',
      pri: 2,
      start: null,
      fixed: false,
      dueDate: null,
    },
  ],
  energy: null,
  reply: 'I found one task.',
  source: 'offline',
};

describe('task review', () => {
  it('keeps parsed items as proposals and flags an unstated duration', () => {
    const review = createTaskReview(parsed, 'Write report', []);

    expect(review.proposals).toHaveLength(1);
    expect(review.proposals[0].warnings).toContain(
      "No duration was stated; check this estimate.",
    );
    expect(initialState().tasks).toHaveLength(0);
  });

  it('does not approve invalid task fields', () => {
    const review = createTaskReview(parsed, 'Write report', []);
    const proposal = review.proposals[0];
    expect(proposal).toBeDefined();
    if (!proposal) return;

    expect(validateTaskProposal({ ...proposal, title: '   ' })).toMatch(/name/i);
    expect(validateTaskProposal({ ...proposal, durationText: '999' })).toMatch(/duration/i);
    expect(validateTaskProposal({ ...proposal, startText: '25:70' })).toMatch(/start time/i);
    expect(validateTaskProposal({ ...proposal, dueText: '2026-02-30' })).toMatch(/deadline/i);
  });

  it('applies edited values only to the approved check-in payload', () => {
    const review = createTaskReview(parsed, 'Write report', []);
    const proposal = review.proposals[0];
    expect(proposal).toBeDefined();
    if (!proposal) return;

    const approved = approvedCheckIn({
      ...review,
      proposals: [
        {
          ...proposal,
          title: 'Draft report',
          durationText: '60',
          priority: 3,
          startText: '2pm',
          dueText: '2026-11-05',
        },
      ],
    });

    expect(approved.items[0]).toMatchObject({
      title: 'Draft report',
      dur: 60,
      pri: 3,
      start: 14 * 60,
      fixed: true,
      dueDate: '2026-11-05',
    });
  });

  it('cancels without changing the task plan', () => {
    const state = initialState();
    const cancelled = cancelTaskReview(state);

    expect(cancelled.tasks).toBe(state.tasks);
    expect(cancelled.chat.at(-1)?.text).toBe(
      'No tasks were added. Your plan is unchanged.',
    );
  });
});
