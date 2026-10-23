import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Task } from '../types';

const NUDGE_CHANNEL = 'nudges';
const TIMER_CHANNEL = 'timer';

let handlerReady = false;

function configureHandler() {
  if (handlerReady || Platform.OS === 'web') return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

configureHandler();

export function notificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

async function ensureChannels() {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL, {
      name: 'Task nudges',
      description: 'A gentle heads-up before a planned task starts.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: '#2433B8',
    });
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
      name: 'Focus timer',
      description: 'Tells you when a focus step is finished.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#00BF9A',
      sound: 'default',
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    configureHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      await ensureChannels();
      return true;
    }
    if (current.canAskAgain === false) return false;
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.granted) await ensureChannels();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function notificationPermissionGranted(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch {
    return false;
  }
}

async function cancelKind(kind: string) {
  if (!notificationsSupported()) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.content.data?.kind === kind)
        .map((item) =>
          Notifications.cancelScheduledNotificationAsync(item.identifier),
        ),
    );
  } catch {
    // Cancelling is best effort.
  }
}

function startOfToday(): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

export interface ScheduledNudge {
  id: string;
  at: Date;
  title: string;
}

/**
 * Replace the pending task nudge with the next task that has a clock time.
 * Returns the scheduled item so Settings/Home can show the real next nudge.
 */
export async function scheduleNextTaskNudge(
  tasks: Task[],
  leadMin: number,
): Promise<ScheduledNudge | null> {
  if (!notificationsSupported()) return null;
  await cancelKind('nudge');
  if (!(await notificationPermissionGranted())) return null;

  try {
    await ensureChannels();
    const now = Date.now();
    const midnight = startOfToday();
    const next = tasks
      .filter((task) => task.day === 'today' && !task.done && task.start != null)
      .map((task) => ({
        task,
        at: midnight + (task.start as number) * 60_000 - leadMin * 60_000,
      }))
      .filter((item) => item.at > now + 5_000)
      .sort((a, b) => a.at - b.at)[0];

    if (!next) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Coming up: ${next.task.title}`,
        body:
          leadMin > 0
            ? `Starts in ${leadMin} minutes. One small step is enough.`
            : 'Starting now. Open Focus and take the first step.',
        data: { kind: 'nudge', taskId: next.task.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(next.at),
        channelId: NUDGE_CHANNEL,
      },
    });

    return { id, at: new Date(next.at), title: next.task.title };
  } catch {
    return null;
  }
}

export async function snoozeTaskNudge(
  task: Task,
  minutes: number,
): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (!(await notificationPermissionGranted())) return false;
  try {
    await ensureChannels();
    const at = new Date(Date.now() + Math.max(1, minutes) * 60_000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Still want to start: ${task.title}?`,
        body: 'A ten minute start is enough to break the friction.',
        data: { kind: 'nudge', taskId: task.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: NUDGE_CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleTimerNotification(
  seconds: number,
  taskTitle: string,
): Promise<boolean> {
  if (!notificationsSupported() || seconds <= 0) return false;
  if (!(await notificationPermissionGranted())) return false;
  await cancelKind('timer');
  try {
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Focus step finished',
        body: `Time is up for "${taskTitle}". Mark it done or take a short break.`,
        data: { kind: 'timer' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: TIMER_CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelTimerNotification(): Promise<void> {
  await cancelKind('timer');
}

export async function sendTestNotification(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (!(await ensureNotificationPermission())) return false;
  try {
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'NudgePlan notifications are working',
        body: 'You will get one gentle heads-up before a planned task starts.',
        data: { kind: 'test' },
        sound: 'default',
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
