import { supabase } from './supabase';
import type { AppState, DailyStat, HistoryEntry, Task, Step } from '../types';
import { dayLabel, initialState, todayIso } from './engine';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

/** These tables use UUID primary keys; the app's own ids are text, so generate
 *  proper row ids here instead of reusing the local ones. */
function remoteRowId(): string {
  const webCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function fetchRemoteState(userId: string) {
  if (!supabase) return null;

  const [profileRes, tasksRes, stepsRes, historyRes, dailyRes, checkinsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('tasks').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('steps').select('*').eq('user_id', userId).order('position', { ascending: true }),
    supabase.from('history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('daily_stats').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
    supabase.from('checkins').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const results = [profileRes, tasksRes, stepsRes, historyRes, dailyRes, checkinsRes];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    profile: profileRes.data,
    tasks: tasksRes.data ?? [],
    steps: stepsRes.data ?? [],
    history: historyRes.data ?? [],
    daily: dailyRes.data ?? [],
    checkins: checkinsRes.data ?? [],
  };
}

export async function upsertProfile(userId: string, state: AppState) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    name: state.name,
    start_h: state.startH,
    end_h: state.endH,
    energy: state.energy,
    nudges: state.nudges,
    nudge_lead_min: state.nudgeLeadMin,
    theme: state.theme,
    onboarded: state.onboarded,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function upsertTasks(userId: string, tasks: Task[]) {
  if (!supabase) return;
  if (tasks.length === 0) {
    // Don't delete all tasks if array is empty - could be transient state
    // Deletions are handled explicitly via deleteTaskRemote
    return;
  }
  const rows = tasks.map((task, i) => ({
    id: task.id,
    user_id: userId,
    title: task.title,
    dur: task.dur,
    effort: task.effort,
    day: task.day,
    pri: task.pri,
    start: task.start,
    fixed: task.fixed,
    done: task.done,
    due_date: task.dueDate,
    position: i,
    completed_at: task.done ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('tasks').upsert(rows);
  if (error) throw error;
}

export async function syncStepsForTask(userId: string, taskId: string, steps: Step[]) {
  if (!supabase) return;
  // Replace all steps for this task to avoid orphaned/duplicate rows
  const { error: deleteError } = await supabase.from('steps').delete().eq('task_id', taskId).eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (steps.length === 0) return;
  const rows = steps.map((s, i) => ({
    id: s.id,
    task_id: taskId,
    user_id: userId,
    text: s.text,
    min: s.min,
    done: s.done,
    position: i,
    updated_at: new Date().toISOString(),
  }));
  const { error: insertError } = await supabase.from('steps').insert(rows);
  if (insertError) throw insertError;
}

export async function deleteTaskRemote(userId: string, taskId: string) {
  if (!supabase) return;
  // Steps will cascade if ON DELETE CASCADE is set, but be explicit
  const { error: stepsError } = await supabase
    .from('steps')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId);
  if (stepsError) throw stepsError;
  const { error: taskError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);
  if (taskError) throw taskError;
}

export async function deleteAllTasksRemote(userId: string) {
  if (!supabase) return;
  const { error: stepsError } = await supabase
    .from('steps')
    .delete()
    .eq('user_id', userId);
  if (stepsError) throw stepsError;
  const { error: tasksError } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId);
  if (tasksError) throw tasksError;
}

type InsightTable = 'history' | 'daily_stats' | 'checkins';

async function replaceRemoteRows(
  table: InsightTable,
  userId: string,
  rows: Record<string, unknown>[],
) {
  if (!supabase) return;
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

/** Sync the small arrays that drive Insights and the streak. Each table is
 *  replaced as a unit, which avoids needing a unique constraint per date. */
export async function upsertInsightData(userId: string, state: AppState) {
  if (!supabase) return;
  const now = new Date().toISOString();
  await Promise.all([
    replaceRemoteRows(
      'history',
      userId,
      state.history.map((entry) => ({
        id: remoteRowId(),
        user_id: userId,
        text: entry.text.slice(0, 200),
        type: 'event',
        when_date: todayIso(0),
        metadata: { when: entry.when, localId: entry.id },
        created_at: now,
      })),
    ),
    replaceRemoteRows(
      'daily_stats',
      userId,
      state.daily
        .filter((stat) => ISO_DATE.test(stat.date))
        .map((stat) => ({
          id: remoteRowId(),
          user_id: userId,
          date: stat.date,
          done: stat.done,
          total: stat.total,
          updated_at: now,
        })),
    ),
    replaceRemoteRows(
      'checkins',
      userId,
      state.checkins
        .filter((day) => ISO_DATE.test(day))
        .map((day) => ({
          id: remoteRowId(),
          user_id: userId,
          raw_text: day,
          source: 'app',
          created_at: now,
        })),
    ),
  ]);
}

/** Remove every synced row for an account (the auth user itself is kept). */
export async function deleteAllUserDataRemote(userId: string) {
  if (!supabase) return;
  const deletes = [
    supabase.from('steps').delete().eq('user_id', userId),
    supabase.from('tasks').delete().eq('user_id', userId),
    supabase.from('history').delete().eq('user_id', userId),
    supabase.from('daily_stats').delete().eq('user_id', userId),
    supabase.from('checkins').delete().eq('user_id', userId),
    supabase.from('profiles').delete().eq('id', userId),
  ];
  // Fail loudly so the queued reset can retry instead of reporting success.
  for (const result of await Promise.all(deletes)) {
    if (result.error) throw result.error;
  }
}

type RemoteData = Awaited<ReturnType<typeof fetchRemoteState>>;

function asCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function labelForIsoDate(value: unknown): string {
  const iso = typeof value === 'string' ? value : '';
  if (!ISO_DATE.test(iso)) return '';
  const today = Date.parse(`${todayIso(0)}T00:00:00Z`);
  const target = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(today) || !Number.isFinite(target)) return iso;
  return dayLabel(Math.round((target - today) / 86_400_000));
}

/** Combine the synced Insight tables with local data. Remote rows are newest
 *  first, so they lead; local-only entries are appended instead of lost. */
export function mergeInsights(
  remote: RemoteData,
  baseState: AppState,
): Pick<AppState, 'history' | 'daily' | 'checkins'> {
  const history: HistoryEntry[] = [];
  const seenHistory = new Set<string>();

  for (const row of remote?.history ?? []) {
    const data = asRecord(row);
    const metadata = asRecord(data.metadata);
    const text = typeof data.text === 'string' ? data.text : '';
    if (!text) continue;
    const when =
      (typeof metadata.when === 'string' && metadata.when) ||
      labelForIsoDate(data.when_date) ||
      '';
    const id =
      (typeof metadata.localId === 'string' && metadata.localId) ||
      (typeof data.id === 'string' ? data.id : `remote-h-${history.length}`);
    const key = `${when}|${text}`;
    if (seenHistory.has(key)) continue;
    seenHistory.add(key);
    history.push({ id, when, text });
  }

  for (const entry of baseState.history) {
    const key = `${entry.when}|${entry.text}`;
    if (seenHistory.has(key)) continue;
    seenHistory.add(key);
    history.push(entry);
  }

  const dailyByDate = new Map<string, DailyStat>();
  for (const stat of baseState.daily) {
    if (ISO_DATE.test(stat.date)) dailyByDate.set(stat.date, stat);
  }
  for (const row of remote?.daily ?? []) {
    const data = asRecord(row);
    const date = typeof data.date === 'string' ? data.date : '';
    if (!ISO_DATE.test(date)) continue;
    const next: DailyStat = {
      date,
      done: asCount(data.done),
      total: asCount(data.total),
    };
    const current = dailyByDate.get(date);
    if (
      !current ||
      next.total > current.total ||
      (next.total === current.total && next.done > current.done)
    ) {
      dailyByDate.set(date, next);
    }
  }

  const checkins = new Set<string>();
  for (const day of baseState.checkins) {
    if (ISO_DATE.test(day)) checkins.add(day);
  }
  for (const row of remote?.checkins ?? []) {
    const day = asRecord(row).raw_text;
    if (typeof day === 'string' && ISO_DATE.test(day)) checkins.add(day);
  }

  return {
    history: history.slice(0, 20),
    daily: [...dailyByDate.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30),
    checkins: [...checkins].sort((a, b) => b.localeCompare(a)),
  };
}

export function reconstructFromRemote(remote: RemoteData, baseState: AppState): AppState | null {
  if (!remote) return null;

  const { profile, tasks, steps } = remote;
  const insights = mergeInsights(remote, baseState);
  if (!tasks || tasks.length === 0) {
    // If no tasks but we have profile, just apply profile
    if (profile) {
      return {
        ...baseState,
        ...insights,
        name: profile.name || baseState.name,
        startH: profile.start_h ?? baseState.startH,
        endH: profile.end_h ?? baseState.endH,
        energy: (profile.energy as AppState['energy']) || baseState.energy,
        nudges: profile.nudges ?? baseState.nudges,
        nudgeLeadMin: profile.nudge_lead_min ?? baseState.nudgeLeadMin,
        theme: (profile.theme as AppState['theme']) || baseState.theme,
        onboarded: profile.onboarded ?? baseState.onboarded,
      };
    }
    return null;
  }

  // Group steps by task_id
  const stepsByTask = new Map<string, Step[]>();
  for (const step of steps) {
    if (!stepsByTask.has(step.task_id)) {
      stepsByTask.set(step.task_id, []);
    }
    stepsByTask.get(step.task_id)!.push({
      id: step.id,
      text: step.text,
      min: step.min,
      done: step.done,
    });
  }
  // Sort steps by position
  for (const [taskId, taskSteps] of stepsByTask) {
    const sorted = [...taskSteps].sort((a, b) => {
      const aStep = steps.find(s => s.id === a.id);
      const bStep = steps.find(s => s.id === b.id);
      return (aStep?.position ?? 0) - (bStep?.position ?? 0);
    });
    stepsByTask.set(taskId, sorted);
  }

  // Build tasks
  const reconstructedTasks: Task[] = tasks
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((t) => ({
      id: t.id,
      title: t.title,
      dur: t.dur,
      effort: t.effort,
      day: t.day,
      pri: t.pri,
      start: t.start,
      fixed: t.fixed,
      done: t.done,
      dueDate: t.due_date ?? null,
      steps: stepsByTask.get(t.id) || [],
    }));

  return {
    ...baseState,
    v: 2,
    name: profile?.name || baseState.name,
    startH: profile?.start_h ?? baseState.startH,
    endH: profile?.end_h ?? baseState.endH,
    energy: (profile?.energy as AppState['energy']) || baseState.energy,
    nudges: profile?.nudges ?? baseState.nudges,
    nudgeLeadMin: profile?.nudge_lead_min ?? baseState.nudgeLeadMin,
    theme: (profile?.theme as AppState['theme']) || baseState.theme,
    onboarded: profile?.onboarded ?? baseState.onboarded,
    tasks: reconstructedTasks,
    chat: baseState.chat,
    ...insights,
    lastActiveDate: todayIso(0),
  };
}
