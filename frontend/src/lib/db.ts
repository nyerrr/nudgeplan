import { supabase } from './supabase';
import type { AppState, Task, Step } from '../types';
import { initialState, todayIso } from './engine';

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
  await supabase.from('profiles').upsert({
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
  await supabase.from('steps').delete().eq('task_id', taskId).eq('user_id', userId);
  await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
}

export async function deleteAllTasksRemote(userId: string) {
  if (!supabase) return;
  await supabase.from('steps').delete().eq('user_id', userId);
  await supabase.from('tasks').delete().eq('user_id', userId);
}

type RemoteData = Awaited<ReturnType<typeof fetchRemoteState>>;

export function reconstructFromRemote(remote: RemoteData, baseState: AppState): AppState | null {
  if (!remote) return null;
  
  const { profile, tasks, steps } = remote;
  if (!tasks || tasks.length === 0) {
    // If no tasks but we have profile, just apply profile
    if (profile) {
      return {
        ...baseState,
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
    // Keep local history/chat/daily for now, or we could sync them later
    chat: baseState.chat,
    history: baseState.history,
    daily: baseState.daily,
    checkins: baseState.checkins,
    lastActiveDate: todayIso(0),
  };
}
