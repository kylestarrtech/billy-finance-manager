/**
 * Makes "today" `isoDate` (at noon) for code that reads the clock. Only Date is faked: timers stay real,
 * since key derivation, animations and user events rely on them. Undo with jest.useRealTimers().
 */
export function pinToday(isoDate: string) {
    const [year, month, day] = isoDate.split('-').map(Number);
    jest.useFakeTimers({
        now: new Date(year, month - 1, day, 12),
        doNotFake: [
            'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
            'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
            'clearInterval', 'setTimeout', 'clearTimeout',
        ],
    });
}
