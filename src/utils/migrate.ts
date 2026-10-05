import { PaymentFrequency, normalizeVaultData, type Bill, type CreditCard, type LegacyFinancedBill, type VaultData } from '../types';
import { addDays, parseISODate, startOfToday } from './dates';
import { occurrencesInRange } from './schedule';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Bills used to have an "Is Financed" option; financing now lives in Loans. Monthly financed bills become
 * loans (keeping their id and payment history), with the balance estimated the way the old option did:
 * the total minus one payment per due date that has passed. Their interest rate is unknown, so it starts
 * at 0% for the user to fill in. Other financed bills just lose the financing fields.
 */
function migrateFinancedBills(data: VaultData, today: Date): VaultData {
    const legacy = data.bills as LegacyFinancedBill[];
    if (!legacy.some(b => 'isFinanced' in b || 'totalLoanAmount' in b || 'loanTermMonths' in b)) return data;

    const bills: Bill[] = [];
    const loans: CreditCard[] = [];
    for (const { isFinanced, totalLoanAmount, loanTermMonths: _term, ...bill } of legacy) {
        if (isFinanced && totalLoanAmount && totalLoanAmount > 0 && bill.frequency === PaymentFrequency.Monthly) {
            const first = parseISODate(bill.firstPaymentDate);
            const paymentsMade = occurrencesInRange(first, bill.frequency, first, addDays(today, -1)).length;
            loans.push({
                id: bill.id,
                kind: 'loan',
                name: bill.name,
                balance: round2(Math.max(0, totalLoanAmount - bill.cost * paymentsMade)),
                apr: 0,
                plannedPayment: bill.cost,
                dueDay: first.getDate(),
                originalAmount: totalLoanAmount,
            });
        } else {
            bills.push(bill);
        }
    }

    const movedIds = new Set(loans.map(l => l.id));
    return {
        ...data,
        bills,
        cards: [...data.cards, ...loans],
        payments: data.payments.map(p => (p.kind === 'bill' && movedIds.has(p.itemId) ? { ...p, kind: 'card' } : p)),
    };
}

/** Normalizes raw vault/export JSON into the current shape, applying any data migrations. */
export function loadVaultData(raw: unknown, today: Date = startOfToday()): VaultData {
    return migrateFinancedBills(normalizeVaultData(raw as Partial<VaultData>), today);
}
