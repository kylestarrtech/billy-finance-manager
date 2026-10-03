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

export const formatDate = (date: Date): string => date.toLocaleDateString();

export const formatISODate = (value: string): string => formatDate(parseISODate(value));
