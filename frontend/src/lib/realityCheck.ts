import { EnergyLevel, Task } from '../theme';
import { formatMinutes } from './time';

/**
 * The Reality Check Engine.
 *
 * This is deliberately arithmetic, not AI. "Can I actually do this today?"
 * is a capacity question, and a rule engine answers it the same way every
 * time. Gemini's job is turning a brain dump into tasks; this decides which
 * of those tasks survive contact with the day.
 */

export type Suggestion = {
  id: string;
  taskId: string;
  title: string;
  /** Minutes this task would free up. */
  minutes: number;
  /** What is wrong with this task today. */
  issue: string;
  /** What to do about it. */
  suggestion: string;
};

/** High-energy days absorb more; low-energy days a lot less. */
export const ENERGY_FACTOR: Record<EnergyLevel, number> = {
  low: 0.7,
  medium: 1,
  high: 1.35,
};

/** Share of capacity that should go to demanding work before it is too much. */
const HIGH_ENERGY_SHARE = 0.6;

/** Never propose more than this many moves; the point is a decision, not a list. */
const MAX_SUGGESTIONS = 4;

export function capacityMinutes(availableMinutes: number, energy: EnergyLevel): number {
  return Math.round(availableMinutes * ENERGY_FACTOR[energy]);
}

function total(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + task.minutes, 0);
}

function isPinned(task: Task): boolean {
  // Something due today and marked high priority is a commitment, not a
  // candidate. If the day still does not fit, the UI says so plainly.
  return task.due === 'today' && task.priority === 'high';
}

type Context = {
  energy: EnergyLevel;
  capacity: number;
  highLoad: number;
  highBudget: number;
};

function score(task: Task, ctx: Context): number {
  // Priority is the strongest signal, because it is the one the user can
  // reason about: "move the lowest-priority task first". Everything else
  // only reorders tasks of comparable importance.
  let value = task.priority === 'low' ? 100 : task.priority === 'medium' ? 45 : 0;

  // Deadlines hold work in place. Something due today should not be the first
  // thing offered up just because it is a few minutes long.
  if (task.due === 'today') value -= 70;
  else if (task.due === 'tomorrow') value -= 25;
  else if (task.due === 'next-week') value += 10;
  else if (task.due) value += 4;
  else value += 12;

  // Energy mismatch: hard work on an empty tank fails.
  if (task.energy === 'high' && ctx.energy === 'low') value += 45;
  if (task.energy === 'high' && ctx.highLoad > ctx.highBudget) value += 25;
  if (task.energy === 'high' && ctx.energy === 'medium') value += 8;

  // Longer tasks free more time, but never enough to jump a priority band.
  value += task.minutes / 5;

  return value;
}

function describeIssue(task: Task, ctx: Context): string {
  if (task.energy === 'high' && ctx.energy === 'low') {
    return `${formatMinutes(task.minutes)} of high-energy work on a low-energy day`;
  }
  if (task.energy === 'high' && ctx.highLoad > ctx.highBudget) {
    return `${formatMinutes(task.minutes)} of your best focus, and you are already over`;
  }
  if (task.minutes > ctx.capacity * 0.4) {
    return `${formatMinutes(task.minutes)} is more than a third of today`;
  }
  if (task.priority === 'low') {
    return 'Low priority, nothing forcing it today';
  }
  return `${formatMinutes(task.minutes)} at ${task.energy} energy`;
}

function describeChange(task: Task, ctx: Context): string {
  if (task.energy === 'high' && ctx.energy === 'low') {
    return 'Move it to tomorrow, when you are sharper. Hard work does not get easier on an empty tank.';
  }
  if (task.minutes > ctx.capacity * 0.4) {
    return 'Move it to tomorrow, or split it so the first piece can still happen today.';
  }
  if (task.priority === 'low') {
    return 'Nothing is due, so this can wait until tomorrow.';
  }
  return `Move it to tomorrow to free ${formatMinutes(task.minutes)}.`;
}

/**
 * Suggest the fewest moves that bring the day back inside capacity.
 * Returns an empty array when the plan already fits.
 */
export function buildSuggestions(
  tasks: Task[],
  availableMinutes: number,
  energy: EnergyLevel
): Suggestion[] {
  const open = tasks.filter((task) => !task.done);
  if (open.length === 0) return [];

  const capacity = capacityMinutes(availableMinutes, energy);
  const highLoad = total(open.filter((task) => task.energy === 'high'));
  const highBudget = Math.round(capacity * HIGH_ENERGY_SHARE);

  const planned = total(open);
  if (planned <= capacity && highLoad <= highBudget) return [];

  const ctx: Context = { energy, capacity, highLoad, highBudget };

  const ranked = open
    .filter((task) => !isPinned(task))
    .map((task) => ({ task, score: score(task, ctx) }))
    .sort((a, b) => b.score - a.score);

  const suggestions: Suggestion[] = [];
  let remaining = planned;
  let remainingHigh = highLoad;

  for (const { task } of ranked) {
    if (remaining <= capacity && remainingHigh <= highBudget) break;
    if (suggestions.length >= MAX_SUGGESTIONS) break;

    suggestions.push({
      id: `rc-${task.id}`,
      taskId: task.id,
      title: task.title,
      minutes: task.minutes,
      issue: describeIssue(task, ctx),
      suggestion: describeChange(task, ctx),
    });

    remaining -= task.minutes;
    if (task.energy === 'high') remainingHigh -= task.minutes;
  }

  return suggestions;
}
