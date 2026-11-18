import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockUpsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom },
}));

import {
  deleteAllUserDataRemote,
  mergeInsights,
  upsertInsightData,
  upsertProfile,
} from './db';
import { initialState } from './engine';

describe('Supabase write errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  it('surfaces profile upsert errors so sync cannot report a false success', async () => {
    const error = new Error('network unavailable');
    mockUpsert.mockResolvedValue({ error });

    await expect(upsertProfile('user-1', initialState())).rejects.toBe(error);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('does not report a full account delete as successful when one table fails', async () => {
    const error = new Error('permission denied');
    mockFrom.mockImplementation((table: string) => ({
      upsert: mockUpsert,
      delete: () => ({
        eq: () => Promise.resolve({ error: table === 'tasks' ? error : null }),
      }),
    }));

    await expect(deleteAllUserDataRemote('user-1')).rejects.toBe(error);
    expect(mockFrom).toHaveBeenCalledWith('tasks');
  });
});

describe('Insight table writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces a failed delete instead of reporting a false sync success', async () => {
    const error = new Error('delete denied');
    mockFrom.mockImplementation((table: string) => ({
      upsert: mockUpsert,
      delete: () => ({
        eq: () => Promise.resolve({ error: table === 'checkins' ? error : null }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }));

    await expect(upsertInsightData('user-1', initialState())).rejects.toBe(error);
    expect(mockFrom).toHaveBeenCalledWith('checkins');
  });

  it('surfaces a failed insert after replacing the rows', async () => {
    const error = new Error('insert denied');
    const inserted: Record<string, unknown>[] = [];
    mockFrom.mockImplementation((table: string) => ({
      upsert: mockUpsert,
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: (rows: Record<string, unknown>[]) => {
        inserted.push(...rows);
        return Promise.resolve({ error: table === 'history' ? error : null });
      },
    }));
    const state = initialState();
    state.history = [{ id: 'local-h', when: 'Mon, Jan 1', text: 'Finished intro' }];

    await expect(upsertInsightData('user-1', state)).rejects.toBe(error);
    expect(inserted).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Finished intro' })]),
    );
  });
});

describe('Insight merge', () => {
  it('combines remote and local data without duplicating shared events', () => {
    const state = initialState();
    state.history = [
      { id: 'local-h', when: 'Mon, Jan 2', text: 'Local only' },
      { id: 'shared', when: 'Mon, Jan 1', text: 'Shared event' },
    ];
    state.daily = [
      { date: '2026-01-01', done: 1, total: 2 },
      { date: '2025-12-31', done: 0, total: 3 },
    ];
    state.checkins = ['2026-01-01'];

    const remote = {
      profile: null,
      tasks: [],
      steps: [],
      history: [
        {
          id: 'uuid-1',
          user_id: 'user-1',
          text: 'Shared event',
          type: 'event',
          when_date: '2026-01-01',
          metadata: { when: 'Mon, Jan 1', localId: 'remote-shared' },
          created_at: null,
        },
        {
          id: 'uuid-2',
          user_id: 'user-1',
          text: 'Remote only',
          type: 'event',
          when_date: '2026-01-02',
          metadata: { when: 'Mon, Jan 2', localId: 'remote-h' },
          created_at: null,
        },
      ],
      daily: [
        {
          id: 'uuid-3',
          user_id: 'user-1',
          date: '2026-01-01',
          done: 2,
          total: 2,
          updated_at: null,
        },
        {
          id: 'uuid-4',
          user_id: 'user-1',
          date: '2026-01-03',
          done: 3,
          total: 4,
          updated_at: null,
        },
      ],
      checkins: [
        {
          id: 'uuid-5',
          user_id: 'user-1',
          raw_text: '2026-01-02',
          parsed_items: null,
          energy: null,
          source: 'app',
          reply: null,
          created_at: null,
        },
        {
          id: 'uuid-6',
          user_id: 'user-1',
          raw_text: 'not-a-date',
          parsed_items: null,
          energy: null,
          source: 'app',
          reply: null,
          created_at: null,
        },
      ],
    } as unknown as Parameters<typeof mergeInsights>[0];

    const merged = mergeInsights(remote, state);

    expect(merged.history.map((entry) => entry.text)).toEqual([
      'Shared event',
      'Remote only',
      'Local only',
    ]);
    expect(merged.history.find((entry) => entry.text === 'Shared event')?.id).toBe(
      'remote-shared',
    );
    expect(merged.daily).toEqual([
      { date: '2026-01-03', done: 3, total: 4 },
      { date: '2026-01-01', done: 2, total: 2 },
      { date: '2025-12-31', done: 0, total: 3 },
    ]);
    expect(merged.checkins).toEqual(['2026-01-02', '2026-01-01']);
  });
});
