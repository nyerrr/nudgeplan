import { describe, expect, it } from 'vitest';

import {
  fmtTimer,
  generateSteps,
  parseBrainDump,
  parseClock,
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
});
