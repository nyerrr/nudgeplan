import type {
  AppState,
  ParsedCheckIn,
  ParsedStep,
  ParsedTask,
  PendingCheckInReview,
  ProposalStep,
  Task,
  TaskProposal,
} from '../types';
import { clockFromMinutes, newId, parseClock, validIsoDate } from './engine';

const EXPLICIT_DURATION = /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/i;

const STOP_WORDS = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'and', 'in', 'on', 'at']);

function cleanTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function fuzzyMatch(a: string, b: string): boolean {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;
  const tokensA = cleanTokens(normA);
  const tokensB = cleanTokens(normB);
  if (!tokensA.size || !tokensB.size) return false;
  let common = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) common++;
  }
  const minSize = Math.min(tokensA.size, tokensB.size);
  const maxSize = Math.max(tokensA.size, tokensB.size);
  return common / maxSize >= 0.5 || (common === minSize && minSize >= 1);
}

function warningsFor(
  item: ParsedTask,
  rawText: string,
  existingTasks: Task[],
  earlierItems: ParsedTask[],
): string[] {
  const warnings: string[] = [];
  if (item.title.trim().length < 4) warnings.push('Check this task name.');
  if (item.dur === 45 && !EXPLICIT_DURATION.test(rawText)) {
    warnings.push('No duration was stated; check this estimate.');
  }

  const existingMatch = existingTasks.find((task) => fuzzyMatch(task.title, item.title));
  const earlierMatch = earlierItems.find((earlier) => fuzzyMatch(earlier.title, item.title));
  if (existingMatch) {
    warnings.push(`Similar to "${existingMatch.title}" in your plan. Merge or keep both?`);
  } else if (earlierMatch) {
    warnings.push('A similar task is in this same check-in.');
  }
  return warnings;
}

function toProposalSteps(steps: ParsedStep[] | undefined): ProposalStep[] {
  return (steps ?? []).map((step) => ({
    key: newId('rs'),
    text: step.text ?? '',
    minutesText: String(Math.max(1, Math.round(step.min ?? 5))),
  }));
}

export function createTaskReview(
  parsed: ParsedCheckIn,
  rawText: string,
  existingTasks: Task[],
): PendingCheckInReview {
  return {
    parsed,
    proposals: parsed.items.map((item, index) => ({
      key: newId('r'),
      title: item.title,
      durationText: String(item.dur),
      effort: item.effort,
      day: item.day,
      priority: item.pri === 1 || item.pri === 3 ? item.pri : 2,
      startText: item.start == null ? '' : clockFromMinutes(item.start),
      dueText: item.dueDate ?? '',
      warnings: warningsFor(item, rawText, existingTasks, parsed.items.slice(0, index)),
      source: item,
      kind: item.kind ?? 'task',
      rationale: item.rationale ?? null,
      steps: toProposalSteps(item.steps),
    })),
  };
}

export function validateTaskProposal(proposal: TaskProposal): string | null {
  if (!proposal.title.trim()) return 'Give each task a name before adding it.';
  if (proposal.title.trim().length > 80) return 'Task names must be 80 characters or fewer.';

  const duration = Number(proposal.durationText);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    return 'Use a whole-number duration from 5 to 480 minutes.';
  }
  if (proposal.startText.trim() && parseClock(proposal.startText) == null) {
    return 'Use a start time like 14:30 or 6pm.';
  }
  if (proposal.dueText.trim() && validIsoDate(proposal.dueText) == null) {
    return 'Use a deadline like 2026-11-05.';
  }
  for (const step of proposal.steps ?? []) {
    const text = step.text.trim();
    const min = Number(step.minutesText);
    if (!text && !step.minutesText.trim()) continue;
    if (!text) return 'Give each micro-step a name or remove it.';
    if (text.length > 120) return 'Micro-step names must be 120 characters or fewer.';
    if (!Number.isInteger(min) || min < 1 || min > 120) {
      return 'Use a whole-number step duration from 1 to 120 minutes.';
    }
  }
  return null;
}

export function approvedCheckIn(
  review: PendingCheckInReview,
): ParsedCheckIn {
  return {
    ...review.parsed,
    items: review.proposals.map((proposal) => {
      const start = proposal.startText.trim()
        ? parseClock(proposal.startText)
        : null;
      const dueDate = proposal.dueText.trim()
        ? validIsoDate(proposal.dueText)
        : null;
      const steps: ParsedStep[] = (proposal.steps ?? [])
        .filter((step) => step.text.trim())
        .map((step) => ({
          text: step.text.trim(),
          min: Math.max(1, Math.min(120, Math.round(Number(step.minutesText) || 5))),
          done: false,
        }));
      return {
        ...(proposal.source ?? {}),
        title: proposal.title.trim(),
        dur: Number(proposal.durationText),
        effort: proposal.effort,
        day: proposal.day,
        pri: proposal.priority,
        start,
        fixed: start != null,
        dueDate,
        kind: proposal.kind ?? 'task',
        rationale: proposal.rationale ?? null,
        steps,
      };
    }),
  };
}

export function cancelTaskReview(state: AppState): AppState {
  return {
    ...state,
    chat: [
      ...state.chat,
      {
        id: newId('m'),
        from: 'bot',
        text: 'No tasks were added. Your plan is unchanged.',
      },
    ],
  };
}
