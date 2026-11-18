import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { values, mockGetItem, mockSetItem, mockRemoveItem } = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    mockGetItem: vi.fn(async (key: string) => values.get(key) ?? null),
    mockSetItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    mockRemoveItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

import {
  addPendingDelete,
  clearPendingDelete,
  loadPendingDeletes,
  loadPendingReview,
  savePendingReview,
} from './storage';
import type { PendingCheckInReview } from '../types';

describe('pending cloud deletions', () => {
  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
  });

  it('keeps deletion queues separate by account and removes completed items', async () => {
    await Promise.all([
      addPendingDelete('user-1', 'task-a'),
      addPendingDelete('user-1', 'task-b'),
      addPendingDelete('user-2', 'task-c'),
    ]);

    expect(await loadPendingDeletes('user-1')).toEqual(['task-a', 'task-b']);
    expect(await loadPendingDeletes('user-2')).toEqual(['task-c']);

    await clearPendingDelete('user-1', 'task-a');
    expect(await loadPendingDeletes('user-1')).toEqual(['task-b']);
  });
});

describe('pending check-in reviews', () => {
  const review: PendingCheckInReview = {
    parsed: { items: [], energy: null, reply: '', source: 'offline' },
    proposals: [
      {
        key: 'r1',
        title: 'Draft the intro',
        durationText: '20',
        effort: 'med',
        day: 'today',
        priority: 2,
        startText: '',
        dueText: '',
        warnings: [],
        source: null,
        steps: [],
      },
    ],
  };

  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
  });

  it('restores an unconfirmed review for the right account', async () => {
    await savePendingReview('user-1', review);

    expect(await loadPendingReview('user-1')).toEqual(review);
    expect(await loadPendingReview('user-2')).toBeNull();
  });

  it('clears the stored review once it is approved or cancelled', async () => {
    await savePendingReview('user-1', review);
    await savePendingReview('user-1', null);

    expect(await loadPendingReview('user-1')).toBeNull();
  });

  it('ignores corrupt or unrelated stored data', async () => {
    await AsyncStorage.setItem('nudgeplan-pending-review-2-user-1', '{bad json');

    expect(await loadPendingReview('user-1')).toBeNull();
  });

  it('ignores a stored review with missing proposal fields', async () => {
    await AsyncStorage.setItem(
      'nudgeplan-pending-review-2-user-1',
      JSON.stringify({
        parsed: { items: [], energy: null, reply: '', source: 'offline' },
        proposals: [{ key: 'r1', title: 'Only a title' }],
      }),
    );

    expect(await loadPendingReview('user-1')).toBeNull();
  });
});
