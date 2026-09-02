import { AccountAgeDetails } from '../types/index.js';

/**
 * Calculates calendar-aware account age between creation date and a reference date (defaults to now).
 * Example output: "5 years, 11 months, 14 days" or "0 days" or "1 day".
 */
export function calculateAccountAge(
  creationDateInput: Date | string | number,
  referenceDateInput: Date | string | number = new Date(),
): AccountAgeDetails {
  const start = new Date(creationDateInput);
  const end = new Date(referenceDateInput);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      years: 0,
      months: 0,
      days: 0,
      formatted: 'Unknown age',
    };
  }

  if (start > end) {
    return {
      years: 0,
      months: 0,
      days: 0,
      formatted: '0 days',
    };
  }

  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Calculate days in the previous month relative to end date
    const previousMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    days += previousMonth.getUTCDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  return {
    years,
    months,
    days,
    formatted: parts.join(', '),
  };
}
