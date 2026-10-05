// Dates are stored as local 'YYYY-MM-DD' strings (same format the web <input type="date"> produced).
// `new Date('YYYY-MM-DD')` parses as UTC midnight, which lands on the previous day in negative-offset
// timezones, so always go through these helpers instead.

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseISODate = (value: string): Date => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) {
        const fallback = new Date(value);
        fallback.setHours(0, 0, 0, 0);
        return fallback;
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const startOfToday = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

export const addDays = (date: Date, days: number): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Whole calendar days between two local dates, immune to DST shifts.
export const daysBetween = (from: Date, to: Date): number =>
    Math.round(
        (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
            Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000
    );

export const lastDayOfMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

// Adds months while clamping to the end of shorter months, so a bill due on the 31st stays
// "end of month" instead of drifting (Jan 31 -> Feb 28 -> Mar 31, not Jan 31 -> Mar 3 -> Apr 3).
export const addMonthsClamped = (date: Date, months: number): Date => {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    target.setDate(Math.min(date.getDate(), lastDayOfMonth(target.getFullYear(), target.getMonth())));
    return target;
};

export const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const endOfMonth = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), lastDayOfMonth(date.getFullYear(), date.getMonth()));

/** Monday of the week containing `date`. */
export const startOfWeek = (date: Date): Date => addDays(date, -((date.getDay() + 6) % 7));

export const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const formatDate = (date: Date): string => date.toLocaleDateString();

export const formatISODate = (value: string): string => formatDate(parseISODate(value));

/** "Oct 3" */
export const formatShortDate = (date: Date): string =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** "October 2026" */
export const formatMonthYear = (date: Date): string =>
    date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** "Thursday, October 15" */
export const formatLongDate = (date: Date): string =>
    date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** "9:00 AM" */
export const formatTime = (hour: number, minute: number): string =>
    new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "$1,450.50" (and "-$12.00" for negatives). */
export const formatMoney = (amount: number): string => {
    const abs = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${amount < 0 ? '-' : ''}$${abs}`;
};

/** "1st", "2nd", "15th"... */
export const ordinal = (n: number): string => {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};
