import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockUpsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom },
}));

import { deleteAllUserDataRemote, upsertProfile } from './db';
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
