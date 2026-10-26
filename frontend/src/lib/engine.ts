import type {
  AppState,
  ChatCta,
  ChatMessage,
  DailyStat,
  Day,
  Effort,
  Energy,
  OnboardingProfile,
  ParsedCheckIn,
  ParsedTask,
  Step,
  Task,
  TimerState,
} from '../types';

// ---------------------------------------------------------------------------
// Constants (mirrored in backend/engine.py)
// ---------------------------------------------------------------------------

const ENERGY_FACTOR: Record<Energy, number> = {
  low: 0.7,
  medium: 0.9,
  high: 1,
};

const EFFORT_FACTOR: Record<Energy, number> = {
  low: 0.72,
  medium: 1,
  high: 1.08,
};

const ENERGY_BY_HOUR: Record<number, number> = {
  5: 35,
  6: 40,
  7: 50,
  8: 58,
  9: 78,
  10: 94,
  11: 90,
  12: 68,
  13: 46,
  14: 42,
  15: 56,
  16: 70,
  17: 58,
  18: 48,
  19: 40,
  20: 35,
  21: 30,
  22: 28,
};

const EFFORT_RANK: Record<Effort, number> = { high: 3, med: 2, low: 1 };

const LEAD =
  /^\s*(?:(?:and|also|so|ok|okay|um|plus)\s+)?(?:i\s+(?:also\s+)?(?:need|have|got|want|must|should|gotta)\s+to\s+|i'?ve\s+got\s+to\s+|(?:need|have|got|want)\s+to\s+|gotta\s+|must\s+|should\s+|remember\s+to\s+|don'?t\s+forget\s+to\s+|i'?ll\s+|i\s+will\s+)/i;

const HIGH_EFFORT =
  /\b(write|draft|study|research|report|proposal|essay|thesis|code|design|plan|exam|present|presentation|analy\w*|prepare|prep|build|model|outline|revise|learn|project|budget|spreadsheet)\b/i;

const LOW_EFFORT =
  /\b(email|emails|reply|call|laundry|groc\w*|book|pay|clean|buy|text|order|dishes|gym|walk|chores|message|errand\w*|dentist)\b/i;

const STUCK =
  /stuck|avoid|putting off|procrastinat|dread|can'?t (?:get )?start/i;

const LOW_ENERGY =
  /\b(tired|exhausted|burnt out|burned out|drained|sleepy|low energy|wiped)\b/i;

const HIGH_ENERGY =
  /\b(energi[sz]ed|well rested|rested|fresh|high energy|pumped)\b/i;

const TIME = /(?:\bat|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const DURATION =
  /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;
const URGENT = /urgent|asap|due|deadline|important/i;
const OPTIONAL = /maybe|if time|optional|someday|eventually/i;
const STUCK_PHRASES =
  /\b(?:i'?m|i am|i keep|keep|i have been|i've been)?\s*(?:stuck on|stuck with|stuck|avoiding|putting off|procrastinating on|dreading|can'?t start|can'?t get started on)\b/gi;
const TRAILING_PREP = /\b(for|at|by|on|due|in|about)\s*$/i;
const EDGE_PUNCT = /^[\s,.:;-]+|[\s,.:;-]+$/g;

const STEP_SETS: Array<{ re: RegExp; steps: Array<[string, number]> }> = [
  {
    re: /budget|spreadsheet|invoice|tax|expense|bill|pay\b|finance/i,
    steps: [
      ['Gather the files or numbers in one place', 5],
      ['Set up the headers or form fields', 5],
      ['Enter the first 5 items', 10],
      ['Check the totals once', 5],
      ['Save it and note what is left', 2],
    ],
  },
  {
    re: /write|draft|essay|report|proposal|post|thesis|outline|document|slides|present|intro|article/i,
    steps: [
      ['Open a blank page and name it', 2],
      ['List the 3 points you must cover', 5],
      ['Write a rough first paragraph, no editing', 10],
      ['Fill in one point at a time', 10],
      ['Read it once and fix the gaps', 8],
    ],
  },
  {
    re: /study|exam|read|learn|revise|chem|math|class|lecture|notes/i,
    steps: [
      ['Clear your desk and open the material', 3],
      ['Skim the headings for 5 minutes', 5],
      ['Write 3 questions you cannot answer yet', 5],
      ['Answer one question from memory', 10],
      ['Quiz yourself on what you wrote', 10],
    ],
  },
  {
    re: /email|reply|inbox|message|text|call|book|order/i,
    steps: [
      ['Open the inbox or contact list', 1],
      ['Handle the 2 quickest ones first', 5],
      ['Flag anything that needs more than 5 minutes', 3],
      ['Handle the most urgent one', 10],
      ['Close it and note follow-ups', 2],
    ],
  },
  {
    re: /code|bug|fix|pull request|deploy|test|build|review|research/i,
    steps: [
      ['Open the repo, file or source you need', 2],
      ['Write the next single step as one sentence', 3],
      ['Make the smallest possible change', 10],
      ['Run it or check it', 5],
      ['Note what is left for next time', 2],
    ],
  },
];

const GENERIC_STEPS: Array<[string, number]> = [
  ['Write what done looks like in one line', 2],
  ['Gather what you need in one place', 5],
  ['Work for 10 minutes only', 10],
  ['Take a 2 minute break', 2],
  ['Do one more 10 minute round', 10],
];

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

// ---------------------------------------------------------------------------
// IDs, dates, labels
// ---------------------------------------------------------------------------

let sequence = 0;

export function newId(prefix = 't'): string {
  sequence += 1;
  return `${prefix}${Date.now().toString(36)}${sequence}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

export function todayIso(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayLabel(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function weekdayLabel(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12
    ? 'Good morning'
    : hour < 18
      ? 'Good afternoon'
      : 'Good evening';
}

export function fmtTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hour % 24 >= 12 ? 'PM' : 'AM';
  return `${((hour + 11) % 12) + 1}:${String(mins).padStart(2, '0')} ${suffix}`;
}

export function fmtHour(hour: number): string {
  return `${((hour + 11) % 12) + 1} ${hour % 24 >= 12 ? 'PM' : 'AM'}`;
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest ? ` ${rest}m` : ''}`;
}

export function fmtTimer(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`;
}

export function parseClock(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (minute > 59 || hour > 23) return null;
  const meridiem = (match[3] ?? '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  else if (meridiem === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function clockFromMinutes(minutes: number | null): string {
  if (minutes == null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60,
  ).padStart(2, '0')}`;
}

export function streakFromDays(days: string[]): number {
  const unique = Array.from(new Set(days.filter(Boolean))).sort().reverse();
  if (!unique.length) return 0;

  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const first = parse(unique[0]);
  const diffFirst = Math.round(
    (today.getTime() - first.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffFirst !== 0 && diffFirst !== 1) return 0;

  let streak = 1;
  let cursor = first;
  unique.slice(1).forEach((value) => {
    const date = parse(value);
    const diff = Math.round(
      (cursor.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diff === 1) {
      streak += 1;
      cursor = date;
    }
  });
  return streak;
}

// ---------------------------------------------------------------------------
// Tasks and seed
// ---------------------------------------------------------------------------

export function createTask(
  title: string,
  dur: number,
  effort: Effort,
  day: Day,
  pri: 2 | 3 | 1 = 2,
  start: number | null = null,
  fixed = false,
  steps: Step[] = [],
  done = false,
): Task {
  return {
    id: newId(),
    title,
    dur,
    effort,
    day,
    pri,
    start,
    fixed,
    done,
    steps,
  };
}

export function seedState(): AppState {
  return initialState();
}

/**
 * A brand-new install. No sample tasks, messages, or history: everything the
 * user sees from here is theirs.
 */
export function initialState(): AppState {
  return {
    v: 2,
    onboarded: false,
    name: '',
    startH: 9,
    endH: 18,
    energy: 'medium',
    nudges: true,
    nudgeLeadMin: 15,
    theme: 'light',
    themeScheme: 'clean-mist',
    view: 'today',
    focusId: null,
    chat: [],
    checkins: [],
    history: [],
    daily: [],
    lastActiveDate: todayIso(0),
    tasks: [],
  };
}

export function welcomeMessage(name: string): ChatMessage {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  return {
    id: newId('m'),
    from: 'bot',
    text: `Hi ${firstName}. Tell me what is on your plate today. I will sort it into a realistic plan and keep the heavy work in your peak hours.`,
  };
}

export function applyOnboarding(
  state: AppState,
  profile: OnboardingProfile,
): AppState {
  const name = profile.name.trim().slice(0, 24);
  return {
    ...state,
    onboarded: true,
    name,
    startH: profile.startH,
    endH: profile.endH,
    energy: profile.energy,
    nudges: profile.nudges,
    chat: [welcomeMessage(name)],
    lastActiveDate: todayIso(0),
    tasks: planTasks(
      state.tasks,
      profile.startH,
      profile.endH,
      profile.energy,
    ),
  };
}

function labelForDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Move the plan into a new day the first time the app opens after midnight.
 * Finished work is archived into the daily log; unfinished work carries over,
 * and stale clock times are cleared so appointments do not reappear.
 */
export function rollover(state: AppState): { state: AppState; rolled: boolean } {
  const today = todayIso(0);
  if (state.lastActiveDate === today) return { state, rolled: false };

  const yesterday = state.tasks.filter((task) => task.day === 'today');
  const done = yesterday.filter((task) => task.done).length;
  const total = yesterday.length;
  const stat: DailyStat = { date: state.lastActiveDate, done, total };
  const daily = [...state.daily.filter((entry) => entry.date !== stat.date), stat]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);

  const kept: Task[] = [];
  state.tasks.forEach((task) => {
    if (task.day === 'tomorrow') {
      kept.push({ ...task, day: 'today' });
    } else if (!task.done) {
      kept.push({ ...task, day: 'today', start: null, fixed: false });
    }
  });

  const history =
    total > 0
      ? [
          {
            id: newId('h'),
            when: labelForDate(state.lastActiveDate),
            text: `${done} of ${total} finished. ${total - done} carried over.`,
          },
          ...state.history,
        ].slice(0, 20)
      : state.history;

  return {
    state: {
      ...state,
      tasks: planTasks(kept, state.startH, state.endH, state.energy),
      daily,
      lastActiveDate: today,
      history,
    },
    rolled: true,
  };
}

/** Keep today's real completion numbers in the daily log. */
export function syncDaily(state: AppState): AppState {
  const today = todayIso(0);
  const tasks = state.tasks.filter((task) => task.day === 'today');
  const stat: DailyStat = {
    date: today,
    done: tasks.filter((task) => task.done).length,
    total: tasks.length,
  };
  const daily = [...state.daily.filter((entry) => entry.date !== today), stat]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
  return { ...state, daily };
}

/** Oldest first, including zero days, so Insights never shows invented data. */
export function dailySeries(state: AppState, count = 7): DailyStat[] {
  const byDate = new Map(state.daily.map((entry) => [entry.date, entry]));
  return Array.from({ length: count }, (_, index) => {
    const date = todayIso(index - (count - 1));
    return byDate.get(date) ?? { date, done: 0, total: 0 };
  });
}

export function completionRate(stat: DailyStat): number {
  if (!stat.total) return 0;
  return Math.round((stat.done / stat.total) * 100);
}

export function remainingSeconds(timer: TimerState, now = Date.now()): number {
  if (timer.running && timer.endsAt != null) {
    return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  }
  return timer.secs;
}

// ---------------------------------------------------------------------------
// Capacity and energy
// ---------------------------------------------------------------------------

export function availableMinutes(
  startH: number,
  endH: number,
  energy: Energy,
): number {
  return Math.max(60, Math.round((endH - startH) * 60 * ENERGY_FACTOR[energy]));
}

export function energyAt(hour: number, energy: Energy): number {
  return Math.min(
    100,
    Math.round((ENERGY_BY_HOUR[hour] ?? 40) * EFFORT_FACTOR[energy]),
  );
}

export function hoursRange(startH: number, endH: number): number[] {
  const out: number[] = [];
  for (let hour = startH; hour < endH; hour += 1) out.push(hour);
  return out;
}

export function peakHours(
  startH: number,
  endH: number,
  energy: Energy,
): number[] {
  const hours = hoursRange(startH, endH);
  if (!hours.length) return [];
  const max = Math.max(...hours.map((hour) => energyAt(hour, energy)));
  return hours.filter((hour) => energyAt(hour, energy) >= 0.82 * max);
}

export function plannedMinutes(tasks: Task[], day: Day): number {
  return tasks
    .filter((task) => task.day === day)
    .reduce((total, task) => total + task.dur, 0);
}

export function capacityPercent(state: AppState, day: Day): number {
  return Math.round(
    (plannedMinutes(state.tasks, day) /
      availableMinutes(state.startH, state.endH, state.energy)) *
      100,
  );
}

export function isPeak(minutes: number, state: AppState): boolean {
  return peakHours(state.startH, state.endH, state.energy).includes(
    Math.floor(minutes / 60),
  );
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

function findSlot(
  task: Task,
  busy: Array<[number, number]>,
  startH: number,
  endH: number,
  energy: Energy,
): number | null {
  const from = startH * 60;
  const to = endH * 60;
  const tries: number[] = [];

  for (let minute = from; minute + task.dur <= to; minute += 15) {
    const free = busy.every(
      ([busyStart, busyEnd]) =>
        minute + task.dur <= busyStart || minute >= busyEnd,
    );
    if (free) tries.push(minute);
  }
  if (!tries.length) return null;

  const peaks = peakHours(startH, endH, energy);
  if (task.effort === 'high') {
    const peakSlot = tries.find((minute) =>
      peaks.includes(Math.floor(minute / 60)),
    );
    if (peakSlot != null) return peakSlot;
  }
  if (task.effort === 'low') {
    const offPeak = tries.find(
      (minute) => !peaks.includes(Math.floor(minute / 60)),
    );
    if (offPeak != null) return offPeak;
  }
  return tries[0];
}

export function planTasks(
  tasks: Task[],
  startH: number,
  endH: number,
  energy: Energy,
): Task[] {
  const next = tasks.map((task) => ({ ...task }));
  (['today', 'tomorrow'] as Day[]).forEach((day) => {
    const dayTasks = next.filter((task) => task.day === day);
    const busy: Array<[number, number]> = dayTasks
      .filter((task) => task.fixed && task.start != null)
      .map((task) => [task.start as number, (task.start as number) + task.dur]);

    const auto = dayTasks
      .filter((task) => !task.fixed)
      .sort(
        (a, b) =>
          EFFORT_RANK[b.effort] - EFFORT_RANK[a.effort] || b.pri - a.pri,
      );

    auto.forEach((task) => {
      task.start = null;
    });
    auto.forEach((task) => {
      const slot = findSlot(task, busy, startH, endH, energy);
      if (slot != null) {
        task.start = slot;
        busy.push([slot, slot + task.dur]);
      }
    });
  });
  return next;
}

export function sortedTasks(tasks: Task[], day: Day): Task[] {
  return tasks
    .filter((task) => task.day === day)
    .sort(
      (a, b) =>
        (a.start == null ? 9999 : a.start) -
        (b.start == null ? 9999 : b.start),
    );
}

// ---------------------------------------------------------------------------
// Micro-Step Guard
// ---------------------------------------------------------------------------

export function generateSteps(title: string): Step[] {
  const chosen =
    STEP_SETS.find((set) => set.re.test(title))?.steps ?? GENERIC_STEPS;
  return chosen.map(([text, min]) => ({
    id: newId('s'),
    text,
    min,
    done: false,
  }));
}

// ---------------------------------------------------------------------------
// Brain-dump parsing
// ---------------------------------------------------------------------------

export function parseBrainDump(text: string): {
  items: Task[];
  energy: Energy | null;
} {
  const items: Task[] = [];
  let detectedEnergy: Energy | null = null;
  let carry: Day = 'today';

  const segments = text.split(
    /\n+|;|\.(?:\s+|$)|\s*,\s*|\s+(?:and then|then|also)\s+/i,
  );

  segments.forEach((raw) => {
    let seg = (raw ?? '').trim();
    if (!seg) return;

    const prefix = seg.match(/^(tomorrow|today)\s*:\s*/i);
    if (prefix) {
      carry = prefix[1].toLowerCase() as Day;
      seg = seg.slice(prefix[0].length);
    }
    if (!seg) return;

    const words = seg.split(/\s+/).length;
    if (words <= 7 && LOW_ENERGY.test(seg)) {
      detectedEnergy = 'low';
      return;
    }
    if (words <= 7 && HIGH_ENERGY.test(seg)) {
      detectedEnergy = 'high';
      return;
    }

    let day: Day = /\btomorrow\b/i.test(seg) ? 'tomorrow' : carry;
    const stuck = STUCK.test(seg);

    let start: number | null = null;
    let rest = seg;
    const timeMatch = rest.match(TIME);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2] ?? 0);
      const meridiem = (timeMatch[3] ?? '').toLowerCase();
      if (hour <= 23 && minute < 60) {
        if (meridiem === 'pm' && hour < 12) hour += 12;
        else if (meridiem === 'am' && hour === 12) hour = 0;
        else if (!meridiem && hour <= 6) hour += 12;
        start = hour * 60 + minute;
      }
      rest = rest.replace(timeMatch[0], ' ');
    }

    let duration: number | null = null;
    const durationMatch = rest.match(DURATION);
    if (durationMatch) {
      const value = Number(durationMatch[1]);
      duration = /^h/i.test(durationMatch[2]) ? value * 60 : value;
      rest = rest.replace(durationMatch[0], ' ');
    }

    let title = rest
      .replace(/\b(tomorrow|today)\b/gi, ' ')
      .replace(STUCK_PHRASES, ' ');
    for (let pass = 0; pass < 3; pass += 1) {
      title = title.replace(LEAD, '');
    }
    title = title
      .replace(/\s+/g, ' ')
      .replace(/^(?:and|also|plus)(?:\s+|$)/i, '')
      .replace(TRAILING_PREP, '')
      .replace(EDGE_PUNCT, '')
      .trim();
    if (title.length < 2) return;
    title = (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 70);

    const effort: Effort = HIGH_EFFORT.test(title)
      ? 'high'
      : LOW_EFFORT.test(title)
        ? 'low'
        : 'med';
    if (duration == null) {
      duration = effort === 'high' ? 90 : effort === 'low' ? 20 : 45;
    }
    duration = Math.max(10, Math.min(240, Math.round(duration / 5) * 5));

    const pri: 1 | 2 | 3 = URGENT.test(seg)
      ? 3
      : OPTIONAL.test(seg)
        ? 1
        : 2;

    const steps = stuck ? generateSteps(title) : [];
    items.push(
      createTask(
        title,
        duration,
        effort,
        day,
        pri,
        start,
        start != null,
        steps,
      ),
    );
  });

  return { items, energy: detectedEnergy };
}

// ---------------------------------------------------------------------------
// Reality Check Engine
// ---------------------------------------------------------------------------

export function moveCandidates(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.day === 'today' && !task.done)
    .sort((a, b) => a.pri - b.pri || b.dur - a.dur);
}

export function movesNeeded(state: AppState): number {
  let planned = plannedMinutes(state.tasks, 'today');
  const available = availableMinutes(state.startH, state.endH, state.energy);
  const candidates = moveCandidates(state.tasks);
  let count = 0;
  while (planned > available && count < candidates.length) {
    planned -= candidates[count].dur;
    count += 1;
  }
  return Math.max(1, count);
}

export interface Reality {
  planned: number;
  available: number;
  percent: number;
  over: boolean;
  tight: boolean;
  moves: number;
  message: string;
}

export function realityCheck(state: AppState): Reality {
  const planned = plannedMinutes(state.tasks, 'today');
  const available = availableMinutes(state.startH, state.endH, state.energy);
  const percent = Math.round((planned / available) * 100);
  const over = percent > 100;
  const tight = percent >= 85;
  const moves = movesNeeded(state);

  let message: string;
  if (over) {
    message = `Your day is at ${percent}% capacity. Move ${moves} task${
      moves > 1 ? 's' : ''
    }?`;
  } else if (tight) {
    message = `Your day is at ${percent}% capacity. Move 1 task?`;
  } else if (percent >= 60) {
    message =
      'Your day is at ' +
      `${percent}% capacity. You have room for one small task.`;
  } else {
    message = `Your day is at ${percent}% capacity. You have open hours.`;
  }

  return { planned, available, percent, over, tight, moves, message };
}

export function moveTasks(state: AppState, count: number): {
  tasks: Task[];
  moved: Task[];
} {
  const candidates = moveCandidates(state.tasks).slice(0, count);
  const ids = new Set(candidates.map((task) => task.id));
  const tasks = state.tasks.map((task) =>
    ids.has(task.id)
      ? { ...task, day: 'tomorrow' as Day, fixed: false, start: null }
      : task,
  );
  return {
    tasks: planTasks(tasks, state.startH, state.endH, state.energy),
    moved: candidates,
  };
}

// ---------------------------------------------------------------------------
// Applying a check-in
// ---------------------------------------------------------------------------

function toTask(item: ParsedTask): Task {
  return {
    id: item.id ?? newId(),
    title: item.title,
    dur: item.dur,
    effort: item.effort,
    day: item.day,
    pri: (item.pri === 1 || item.pri === 3 ? item.pri : 2) as 1 | 2 | 3,
    start: item.start,
    fixed: item.fixed,
    done: item.done ?? false,
    steps: (item.steps ?? []).map((step) => ({
      id: step.id ?? newId('s'),
      text: step.text,
      min: step.min,
      done: step.done ?? false,
    })),
  };
}

export interface CheckInResult {
  state: AppState;
  message: ChatMessage;
}

export function applyCheckIn(
  state: AppState,
  parsed: ParsedCheckIn,
): CheckInResult {
  const added = parsed.items.map(toTask);
  const hasChange = added.length > 0 || parsed.energy != null;

  if (!hasChange) {
    const message: ChatMessage = {
      id: newId('m'),
      from: 'bot',
      text:
        parsed.reply ||
        'I did not find a task in that. Try: Write report 2h, call Sam at 4pm, gym tomorrow.',
      cta: [
        { label: 'Check in again', act: 'checkin', ghost: true },
        { label: 'View plan', act: 'plan', ghost: true },
      ],
    };
    return {
      state: { ...state, chat: [...state.chat, message] },
      message,
    };
  }

  const energy = parsed.energy ?? state.energy;
  const tasks = planTasks(
    [...state.tasks, ...added],
    state.startH,
    state.endH,
    energy,
  );
  const pct = Math.round(
    (plannedMinutes(tasks, 'today') /
      availableMinutes(state.startH, state.endH, energy)) *
      100,
  );

  const lines = (parsed.reply || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    if (energy === 'low') lines.push('Low energy noted. I will protect your open hours.');
    if (energy === 'high') lines.push('Good energy noted. I will use your peak hours well.');
    if (added.length) {
      lines.push(
        `Added ${added.length} task${added.length > 1 ? 's' : ''}. Heavy work goes in your peak hours when there is room.`,
      );
    }
  }

  const stuck = added.find((task) => task.steps.length);
  if (stuck) {
    lines.push(`I split "${stuck.title}" into ${stuck.steps.length} small steps.`);
  }

  const cta: ChatCta[] = [];
  if (stuck) cta.push({ label: 'Open focus', act: 'focus' });
  if (added.some((task) => task.day === 'today') || parsed.energy) {
    if (pct > 100) {
      const moves = movesNeeded({ ...state, tasks, energy });
      lines.push(
        `Your day is at ${pct}% capacity. That is more than fits.`,
      );
      cta.push({
        label: `Move ${moves} to tomorrow`,
        act: 'moveN',
        arg: String(moves),
      });
    } else if (pct >= 85) {
      lines.push(`Your day is at ${pct}% capacity. Tight, but doable.`);
    } else {
      lines.push(`Your day is at ${pct}% capacity.`);
    }
  }
  cta.push({ label: 'View plan', act: 'plan', ghost: true });

  const chatDays = state.checkins.includes(todayIso())
    ? state.checkins
    : [...state.checkins, todayIso()];

  const message: ChatMessage = {
    id: newId('m'),
    from: 'bot',
    text: lines.join('\n'),
    tasks: added.map((task) => ({
      title: task.title,
      when:
        task.day === 'tomorrow'
          ? `Tomorrow${task.start != null ? ` ${fmtTime(task.start)}` : ''}`
          : task.start == null
            ? 'Needs room'
            : fmtTime(task.start),
    })),
    cta,
  };

  const nextState: AppState = {
    ...state,
    tasks,
    energy,
    focusId: stuck?.id ?? state.focusId,
    chat: [...state.chat, message],
    checkins: chatDays,
  };

  return { state: nextState, message };
}
