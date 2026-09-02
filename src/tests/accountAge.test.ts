import { describe, it, expect } from 'vitest';
import { calculateAccountAge } from '../utils/accountAge.js';
import { formatExactUtc } from '../utils/date.js';

describe('Account Age & Date Formatting Utilities', () => {
  it('1. Account creation timestamp parsing and exact UTC timestamp formatting', () => {
    const timestamp = '2020-05-15T14:30:45.000Z';
    const formattedUtc = formatExactUtc(timestamp);
    expect(formattedUtc).toBe('2020-05-15 14:30:45 UTC');
  });

  it('2. Calendar-aware account age formatting', () => {
    const created = new Date('2020-01-15T00:00:00Z');
    const joined = new Date('2025-12-29T00:00:00Z');

    const age = calculateAccountAge(created, joined);
    expect(age.years).toBe(5);
    expect(age.months).toBe(11);
    expect(age.days).toBe(14);
    expect(age.formatted).toBe('5 years, 11 months, 14 days');
  });

  it('handles edge case account ages gracefully', () => {
    const created = new Date('2025-01-01T00:00:00Z');
    const same = new Date('2025-01-01T00:00:00Z');
    expect(calculateAccountAge(created, same).formatted).toBe('0 days');

    const nextDay = new Date('2025-01-02T00:00:00Z');
    expect(calculateAccountAge(created, nextDay).formatted).toBe('1 day');
  });
});
