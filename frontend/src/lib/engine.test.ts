import { describe, expect, it, vi } from 'vitest';

import {
  applyCheckIn,
  createTask,
  dueDateLabel,
  fmtTimer,
  generateSteps,
  initialState,
  parseBrainDump,
  parseClock,
  planTasks,
  slotWindow,
  todayIso,
  upcomingTasks,
  validIsoDate,
} from './engine.js';

describe('engine helpers', () => {
  it('parses valid clock values and rejects invalid values', () => {
    expect(parseClock('9:30 am')).toBe(570);
    expect(parseClock('12:00 pm')).toBe(720);
    expect(parseClock('12:00 am')).toBe(0);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('9:60')).toBeNull();
  });

  it('formats timers with zero-padded minutes and seconds', () => {
    expect(fmtTimer(0)).toBe('00:00');
    expect(fmtTimer(65)).toBe('01:05');
    expect(fmtTimer(600)).toBe('10:00');
  });

  it('parses task timing, priority, energy, and day from a brain dump', () => {
    const result = parseBrainDump(
      'I need to write the report for 2 hours tomorrow at 9 am, and then call the dentist',
    );

    expect(result.energy).toBeNull();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: 'Write the report',
      dur: 120,
      effort: 'high',
      day: 'tomorrow',
      start: 540,
      fixed: true,
    });
    expect(result.items[1]).toMatchObject({
      title: 'Call the dentist',
      dur: 20,
      effort: 'low',
      day: 'today',
    });
  });

  it('treats a greeting as chat, not a task', () => {
    expect(parseBrainDump('hello').items).toHaveLength(0);
    const mixed = parseBrainDump('hello, I need to call the dentist');
    expect(mixed.items).toHaveLength(1);
    expect(mixed.items[0].title).toBe('Call the dentist');
  });

  it('adds micro-steps for tasks the user says they are stuck on', () => {
    const result = parseBrainDump("I'm stuck on the budget");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].steps.length).toBeGreaterThan(0);
    expect(result.items[0].steps[0].text).toBe(
      'Gather the files or numbers in one place',
    );
  });

  it('creates five actionable steps for a recognized task type', () => {
    const steps = generateSteps('Draft the project proposal');

    expect(steps).toHaveLength(5);
    expect(steps.every((step) => step.done === false)).toBe(true);
    expect(steps.every((step) => step.min > 0)).toBe(true);
  });

  it('keeps step timers inside the task budget', () => {
    const steps = generateSteps('Draft the project proposal', 15);

    expect(steps).toHaveLength(5);
    expect(steps[0].min).toBeLessThanOrEqual(5);
    expect(steps.every((step) => step.min >= 1)).toBe(true);
    expect(steps.reduce((sum, step) => sum + step.min, 0)).toBeLessThanOrEqual(
      15,
    );
  });

  it('keeps an explicit deadline out of the task title', () => {
    const result = parseBrainDump(
      'I have a chemistry exam on November 5 and need to review chapter 4',
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].dueDate).toMatch(/-11-05$/);
    expect(result.items[0].title.toLowerCase()).not.toContain('november');
  });

  it('validates dates and surfaces only real future deadlines', () => {
    expect(validIsoDate('2026-02-29')).toBeNull();
    expect(validIsoDate('2026-12-15')).toBe('2026-12-15');
    expect(dueDateLabel(todayIso(0))).toBe('Today');

    const exam = createTask(
      'Review chemistry notes',
      30,
      'high',
      'today',
      3,
      null,
      false,
      [],
      false,
      todayIso(9),
    );
    const done = createTask(
      'Finished prep',
      20,
      'med',
      'today',
      2,
      null,
      false,
      [],
      true,
      todayIso(3),
    );
    const noDate = createTask('Loose task', 20, 'med', 'today');

    expect(upcomingTasks([done, noDate, exam])).toEqual([exam]);
  });
});

describe('scheduling from the current time', () => {
  const at = (hour: number, minute = 0) => new Date(2026, 0, 5, hour, minute);

  it('never places today tasks before the current clock time', () => {
    const tasks = [
      createTask('Write report', 60, 'high', 'today'),
      createTask('Email Sam', 30, 'low', 'today'),
    ];

    const planned = planTasks(tasks, 9, 18, 'medium', at(15, 3));
    const report = planned.find((task) => task.title === 'Write report');
    const email = planned.find((task) => task.title === 'Email Sam');

    expect(report?.start).toBe(16 * 60);
    expect(email?.start).toBe(15 * 60 + 15);
  });

  it('leaves a task unscheduled when it no longer fits before day end', () => {
    const tasks = [createTask('Write report', 60, 'high', 'today')];

    const planned = planTasks(tasks, 9, 18, 'medium', at(17, 30));

    expect(planned[0].start).toBeNull();
  });

  it('keeps finished work at the time it was done', () => {
    const tasks = [
      { ...createTask('Standup', 30, 'low', 'today', 2, 9 * 60, true), done: true },
      createTask('Write report', 60, 'high', 'today'),
    ];

    const planned = planTasks(tasks, 9, 18, 'medium', at(15));

    expect(planned.find((task) => task.title === 'Standup')?.start).toBe(9 * 60);
    expect(planned.find((task) => task.title === 'Write report')?.start).toBe(
      16 * 60,
    );
  });

  it('still uses the full configured window for tomorrow', () => {
    const tasks = [createTask('Write report', 60, 'high', 'tomorrow')];

    const planned = planTasks(tasks, 9, 18, 'medium', at(15));

    // High-effort work is placed in the highest-energy slot within the full window.
    expect(planned[0].start).toBe(10 * 60);
  });

  it('keeps an evening runway once the saved day end has passed', () => {
    const window = slotWindow('today', 9, 18, at(20));

    expect(window.from).toBe(20 * 60);
    expect(window.to).toBe(22 * 60);
  });

  it('schedules a 2:30pm brain dump from 2:30pm, not 9am', () => {
    const state = { ...initialState(), onboarded: true, name: 'Sam' };
    const parsed = parseBrainDump(
      'Write the report for 2 hours, and then reply to emails for 30 minutes',
    );
    const now = at(14, 30);
    const tasks = planTasks(
      [...state.tasks, ...parsed.items],
      state.startH,
      state.endH,
      state.energy,
      now,
    );

    const starts = tasks
      .filter((task) => task.day === 'today')
      .map((task) => task.start)
      .sort((a, b) => (a ?? 9999) - (b ?? 9999));

    expect(starts).toHaveLength(2);
    expect(starts[0]).toBe(14 * 60 + 30);
    starts.forEach((start) => expect(start).toBeGreaterThanOrEqual(14 * 60 + 30));
  });

  it('applies a brain dump using the real clock, never the saved start hour', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(at(14, 30));
      const state = { ...initialState(), onboarded: true, name: 'Sam' };
      const parsed = parseBrainDump('Write the report for 2 hours');
      const result = applyCheckIn(state, {
        ...parsed,
        reply: '',
        source: 'offline',
      });
      const task = result.state.tasks.find(
        (item) => item.title === 'Write the report',
      );

      // High-effort work still prefers peak hours, but never lands before the
      // current clock time (2:30pm) or at the saved 9am start.
      expect(task?.start).toBeGreaterThanOrEqual(14 * 60 + 30);
      expect(task?.start).not.toBe(9 * 60);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies actions (move, complete, delete, resize, merge) in check-in', () => {
    const base = {
      ...initialState(),
      tasks: [
        {
          id: 't_dentist',
          title: 'Dentist appointment',
          dur: 30,
          effort: 'low' as const,
          day: 'today' as const,
          pri: 2 as const,
          start: null,
          fixed: false,
          done: false,
          steps: [],
          dueDate: null,
        },
        {
          id: 't_report',
          title: 'Quarterly report',
          dur: 60,
          effort: 'high' as const,
          day: 'today' as const,
          pri: 3 as const,
          start: null,
          fixed: false,
          done: false,
          steps: [],
          dueDate: null,
        },
      ],
    };

    // Test Move & Complete
    const resMove = applyCheckIn(base, {
      items: [],
      energy: null,
      reply: 'Moved dentist to tomorrow',
      intent: 'act',
      actions: [
        { type: 'move', taskId: 't_dentist', day: 'tomorrow' },
        { type: 'complete', taskId: 't_report' },
      ],
    });

    const dentist = resMove.state.tasks.find((t) => t.id === 't_dentist');
    const report = resMove.state.tasks.find((t) => t.id === 't_report');
    expect(dentist?.day).toBe('tomorrow');
    expect(report?.done).toBe(true);
    expect(resMove.message.actions).toHaveLength(2);

    // Test Resize & Delete
    const resResizeDelete = applyCheckIn(base, {
      items: [],
      energy: null,
      reply: 'Resized report, deleted dentist',
      intent: 'act',
      actions: [
        { type: 'resize', taskId: 't_report', dur: 45 },
        { type: 'delete', taskId: 't_dentist' },
      ],
    });

    expect(resResizeDelete.state.tasks.find((t) => t.id === 't_dentist')).toBeUndefined();
    expect(resResizeDelete.state.tasks.find((t) => t.id === 't_report')?.dur).toBe(45);

    // Test Merge
    const resMerge = applyCheckIn(base, {
      items: [],
      energy: null,
      reply: 'Merged tasks',
      intent: 'act',
      actions: [
        { type: 'merge', taskId: 't_report', targetTaskId: 't_dentist', title: 'Report & Dentist' },
      ],
    });

    expect(resMerge.state.tasks).toHaveLength(1);
    expect(resMerge.state.tasks[0].title).toBe('Report & Dentist');
    expect(resMerge.state.tasks[0].dur).toBe(90);
  });

  it('attaches capacity_warning and task kinds to message and tasks', () => {
    const base = initialState();
    const res = applyCheckIn(base, {
      items: [
        {
          title: 'Review flight info',
          dur: 20,
          effort: 'low',
          day: 'today',
          pri: 2,
          start: null,
          fixed: false,
          kind: 'event',
          rationale: 'Scheduled as fixed calendar block',
        },
      ],
      energy: null,
      reply: 'Found flight info',
      intent: 'plan',
      capacity_warning: '5h planned vs 4h free',
    });

    expect(res.state.tasks[0].kind).toBe('event');
    expect(res.state.tasks[0].rationale).toBe('Scheduled as fixed calendar block');
    expect(res.message.capacityWarning).toBe('5h planned vs 4h free');
    expect(res.message.text).toContain('5h planned vs 4h free');
  });
});
