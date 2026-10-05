import type { ReminderSettings, VaultData } from '../types';
import { addDays, formatMoney } from './dates';
import { getDueItems, type DueItem } from './schedule';

/** Reminders are scheduled this far ahead each time the app is unlocked. */
export const REMINDER_HORIZON_DAYS = 45;
/** iOS keeps at most 64 pending local notifications per app. */
const MAX_SCHEDULED = 60;

export interface PlannedReminder {
    date: Date;
    title: string;
    body: string;
}

const whenLabel = (daysBefore: number) =>
    daysBefore === 0 ? 'today' : daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;

/**
 * One notification per due date with unpaid bills/card payments. Text stays generic unless the user
 * opts into details, since notifications show on the lock screen.
 */
export function buildReminderPlan(data: Pick<VaultData, 'bills' | 'cards' | 'payments'>, settings: ReminderSettings, now: Date): PlannedReminder[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = getDueItems(data, today, addDays(today, REMINDER_HORIZON_DAYS + settings.daysBefore), today).filter(d => !d.payment);

    const byDueDate = new Map<string, DueItem[]>();
    for (const item of due) {
        byDueDate.set(item.dueDate, [...(byDueDate.get(item.dueDate) ?? []), item]);
    }

    const when = whenLabel(settings.daysBefore);
    const plan: PlannedReminder[] = [];
    for (const items of byDueDate.values()) {
        const notifyDay = addDays(items[0].date, -settings.daysBefore);
        const date = new Date(notifyDay.getFullYear(), notifyDay.getMonth(), notifyDay.getDate(), settings.hour, settings.minute);
        if (date <= now) continue;

        const count = items.length;
        if (settings.showDetails) {
            const total = items.reduce((sum, i) => sum + i.amount, 0);
            const list = items.map(i => `${i.name} (${formatMoney(i.amount)})`).join(', ');
            plan.push({
                date,
                title: count === 1 ? `${items[0].name} is due ${when}` : `${count} bills are due ${when}`,
                body: count === 1 ? `${formatMoney(items[0].amount)}` : `${list}: ${formatMoney(total)} total`,
            });
        } else {
            plan.push({
                date,
                title: 'Bill reminder',
                body: count === 1 ? `A bill is due ${when}. Open Billy for details.` : `${count} bills are due ${when}. Open Billy for details.`,
            });
        }
    }

    return plan.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}
