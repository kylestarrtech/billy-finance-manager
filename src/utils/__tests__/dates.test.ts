import {
    addDays,
    addMonthsClamped,
    daysBetween,
    endOfMonth,
    formatMoney,
    isSameDay,
    lastDayOfMonth,
    ordinal,
    parseISODate,
    startOfMonth,
    startOfWeek,
    toISODate,
} from '../dates';

// Tests run in America/Toronto (see jest.global-setup.js): DST starts 2026-03-08 and ends 2026-11-01.
it('runs in a timezone with daylight saving, so the DST cases below mean something', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240);
});

describe('parseISODate / toISODate', () => {
    it('parses YYYY-MM-DD as local midnight, not UTC (which lands on the previous day west of UTC)', () => {
        const date = parseISODate('2026-10-10');
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 10, 0]);
    });

    it('ignores anything after the date', () => {
        expect(toISODate(parseISODate('2026-03-08T23:30:00Z'))).toBe('2026-03-08');
    });

    it('round-trips', () => {
        for (const iso of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
            expect(toISODate(parseISODate(iso))).toBe(iso);
        }
    });

    it('zero-pads months and days', () => {
        expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

describe('addDays', () => {
    it('crosses month and year ends', () => {
        expect(toISODate(addDays(parseISODate('2026-12-30'), 3))).toBe('2027-01-02');
        expect(toISODate(addDays(parseISODate('2026-03-01'), -1))).toBe('2026-02-28');
    });

    it('stays at midnight across a DST change', () => {
        const next = addDays(parseISODate('2026-03-07'), 1);
        expect(toISODate(next)).toBe('2026-03-08');
        expect(next.getHours()).toBe(0);
    });
});

describe('daysBetween', () => {
    it('counts whole calendar days across both DST changes', () => {
        expect(daysBetween(parseISODate('2026-03-07'), parseISODate('2026-03-09'))).toBe(2);
        expect(daysBetween(parseISODate('2026-10-31'), parseISODate('2026-11-02'))).toBe(2);
    });

    it('is negative when going backwards and zero for the same day', () => {
        expect(daysBetween(parseISODate('2026-10-10'), parseISODate('2026-10-01'))).toBe(-9);
        expect(daysBetween(parseISODate('2026-10-10'), parseISODate('2026-10-10'))).toBe(0);
    });
});

describe('addMonthsClamped', () => {
    const from = (iso: string, months: number) => toISODate(addMonthsClamped(parseISODate(iso), months));

    it('clamps to the end of shorter months without drifting', () => {
        expect(from('2026-01-31', 1)).toBe('2026-02-28');
        expect(from('2026-01-31', 2)).toBe('2026-03-31');
        expect(from('2026-01-31', 3)).toBe('2026-04-30');
    });

    it('handles leap years', () => {
        expect(from('2028-01-31', 1)).toBe('2028-02-29');
        expect(from('2028-02-29', 12)).toBe('2029-02-28');
    });

    it('goes backwards and across years', () => {
        expect(from('2026-03-31', -1)).toBe('2026-02-28');
        expect(from('2026-11-15', 3)).toBe('2027-02-15');
    });
});

describe('month and week helpers', () => {
    it('finds the last day of a month', () => {
        expect(lastDayOfMonth(2026, 1)).toBe(28);
        expect(lastDayOfMonth(2028, 1)).toBe(29);
        expect(lastDayOfMonth(2026, 3)).toBe(30);
        expect(toISODate(endOfMonth(parseISODate('2026-02-10')))).toBe('2026-02-28');
        expect(toISODate(startOfMonth(parseISODate('2026-02-10')))).toBe('2026-02-01');
    });

    it('starts weeks on Monday', () => {
        expect(toISODate(startOfWeek(parseISODate('2026-10-11')))).toBe('2026-10-05'); // Sunday
        expect(toISODate(startOfWeek(parseISODate('2026-10-05')))).toBe('2026-10-05'); // Monday
        expect(toISODate(startOfWeek(parseISODate('2026-10-10')))).toBe('2026-10-05'); // Saturday
    });

    it('compares days ignoring the time', () => {
        expect(isSameDay(new Date(2026, 9, 10, 1), new Date(2026, 9, 10, 23))).toBe(true);
        expect(isSameDay(new Date(2026, 9, 10), new Date(2026, 9, 11))).toBe(false);
    });
});

describe('formatMoney', () => {
    it('always shows two decimals and puts the sign before the dollar sign', () => {
        expect(formatMoney(0.5)).toBe('$0.50');
        expect(formatMoney(12)).toBe('$12.00');
        expect(formatMoney(-12)).toBe('-$12.00');
        expect(formatMoney(3.456)).toBe('$3.46');
    });
});

describe('ordinal', () => {
    it.each([
        [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
        [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st'], [101, '101st'], [111, '111th'],
    ])('%i -> %s', (n, expected) => {
        expect(ordinal(n)).toBe(expected);
    });
});
