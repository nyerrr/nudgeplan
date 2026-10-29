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
} from './storage';

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
