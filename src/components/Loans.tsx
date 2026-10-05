import { StyleSheet, View } from 'react-native';
import { isLoan, useFinance, type CreditCard } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { checkPromo, getCardsSummary, projectPayoff } from '../utils/cards';
import { addDays, formatDate, formatMoney, formatMonthYear, ordinal, startOfToday } from '../utils/dates';
import { getDueItems, OVERDUE_WINDOW_DAYS } from '../utils/schedule';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import ProgressBar from './ui/ProgressBar';

// Loans and financed purchases: installment debt paid down monthly. Unlike credit cards they don't count
// toward credit utilization, and they can carry a promotional (deferred-interest) end date.
export default function Loans() {
    const { cards: debts, payments, deleteCard } = useFinance();
    const { openCardEditor, openPaymentSheet } = useEditor();
    const today = startOfToday();
    const loans = debts.filter(isLoan);
    const summary = getCardsSummary(loans, today);
    const active = loans.filter(l => l.balance > 0);

    const handleDelete = async (loan: CreditCard) => {
        haptics.warning();
        if (await confirmAsync('Delete Loan', `Delete "${loan.name}" and its payment history? This cannot be undone.`, { confirmText: 'Delete', destructive: true })) {
            deleteCard(loan.id);
        }
    };

    return (
        <View style={styles.list}>
            <View style={styles.header}>
                <AppText variant="h2">Loans ({loans.length})</AppText>
                <Button title="+ Add" small onPress={() => openCardEditor(undefined, 'loan')} />
            </View>

            {loans.length === 0 && (
                <Card>
                    <AppText bold>No loans or financing yet</AppText>
                    <AppText muted style={styles.emptyText}>
                        {'Add car loans, phone or furniture financing and other installment plans. Billy tracks what\'s left as you mark payments paid, works out the payoff date and interest, and warns you if a 0% promo won\'t be cleared before it ends.'}
                    </AppText>
                </Card>
            )}

            {active.length > 0 && (
                <Card tone={summary.neverPaidOff.length > 0 ? 'loss' : undefined} style={styles.card}>
                    <AppText variant="h3">Payoff Plan</AppText>
                    <AppText style={styles.bigNumber} color={colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                        {formatMoney(summary.totalBalance)}
                    </AppText>
                    <AppText muted>{`Paying ${formatMoney(summary.totalPlanned)} a month across ${active.length} ${active.length === 1 ? 'loan' : 'loans'}.`}</AppText>
                    {summary.debtFreeDate ? (
                        <AppText>
                            <AppText bold color={colors.gain}>{`All paid off by ${formatMonthYear(summary.debtFreeDate)}`}</AppText>
                            <AppText muted>{` · ~${formatMoney(summary.totalInterest)} interest to go`}</AppText>
                        </AppText>
                    ) : (
                        <AppText bold color={colors.loss}>
                            {`${summary.neverPaidOff.map(c => c.name).join(', ')} won't be paid off at the current payment. Raise it above the monthly interest.`}
                        </AppText>
                    )}
                </Card>
            )}

            {loans.map(loan => {
                const projection = projectPayoff(loan, loan.plannedPayment, today);
                const promo = checkPromo(loan, today);
                const paidRatio = loan.originalAmount && loan.originalAmount > 0
                    ? Math.max(0, Math.min(1, 1 - loan.balance / loan.originalAmount))
                    : null;
                const nextDue = getDueItems({ bills: [], cards: [loan], payments }, addDays(today, -OVERDUE_WINDOW_DAYS), addDays(today, 62), today)
                    .find(item => !item.payment);
                const lastPayment = payments
                    .filter(p => p.kind === 'card' && p.itemId === loan.id)
                    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

                return (
                    <Card key={loan.id} style={styles.card}>
                        <View style={styles.titleRow}>
                            <AppText variant="h3" style={styles.flex}>{loan.name}</AppText>
                            <AppText variant="small" muted>{loan.apr > 0 ? `${loan.apr}% APR` : '0% APR'}</AppText>
                        </View>
                        <AppText style={styles.balance} color={loan.balance > 0 ? colors.loss : colors.gain}>
                            {loan.balance > 0 ? `${formatMoney(loan.balance)} left` : 'Paid off'}
                        </AppText>

                        {paidRatio !== null && (
                            <View style={styles.progress}>
                                <ProgressBar ratio={paidRatio} warnAt={2} />
                                <AppText variant="small" muted>
                                    {`${formatMoney(loan.originalAmount! - loan.balance)} of ${formatMoney(loan.originalAmount!)} paid (${Math.round(paidRatio * 100)}%)`}
                                </AppText>
                            </View>
                        )}

                        {loan.balance > 0 && (
                            <>
                                <AppText muted>{`Paying ${formatMoney(loan.plannedPayment)} a month, due on the ${ordinal(loan.dueDay)}.`}</AppText>
                                {projection.months === null ? (
                                    <AppText bold color={colors.loss}>
                                        {`${formatMoney(loan.plannedPayment)} doesn't cover the ~${formatMoney(projection.monthlyInterest)} of monthly interest, so this will never be paid off.`}
                                    </AppText>
                                ) : (
                                    <AppText>
                                        <AppText bold>{`Paid off ${formatMonthYear(projection.payoffDate!)}`}</AppText>
                                        <AppText muted>{` · ${projection.months} ${projection.months === 1 ? 'payment' : 'payments'} left · ~${formatMoney(projection.totalInterest)} interest`}</AppText>
                                    </AppText>
                                )}
                            </>
                        )}

                        {promo && (
                            promo.expired ? (
                                <AppText bold color={colors.loss}>
                                    {`The promo rate ended ${formatDate(promo.promoEnd)} with a balance left. Check whether deferred interest was charged.`}
                                </AppText>
                            ) : promo.clearsInTime ? (
                                <AppText color={colors.gain}>
                                    {`✓ On track to clear it before the promo ends ${formatDate(promo.promoEnd)}.`}
                                </AppText>
                            ) : (
                                <AppText bold color={colors.loss}>
                                    {`Won't be cleared before the promo ends ${formatDate(promo.promoEnd)}. Pay ${formatMoney(promo.neededPayment)} a month (${promo.paymentsLeft} ${promo.paymentsLeft === 1 ? 'payment' : 'payments'}) to avoid deferred interest.`}
                                </AppText>
                            )
                        )}

                        {nextDue && (
                            <AppText variant="small" color={nextDue.date < today ? colors.loss : colors.textMuted}>
                                {`${nextDue.date < today ? 'Overdue' : 'Next payment'}: ${formatMoney(nextDue.amount)} on ${formatDate(nextDue.date)}`}
                            </AppText>
                        )}
                        {lastPayment && (
                            <AppText variant="small" color={colors.gain}>{`✓ Last paid: ${formatMoney(lastPayment.amount)}`}</AppText>
                        )}

                        <View style={styles.actions}>
                            {nextDue && <Button title="Mark Paid" variant="primary" small onPress={() => openPaymentSheet(nextDue)} />}
                            <Button title="Edit" variant="secondary" small onPress={() => openCardEditor(loan)} />
                            <Button title="Delete" variant="danger" small onPress={() => handleDelete(loan)} />
                        </View>
                    </Card>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 6,
    },
    card: {
        gap: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    flex: {
        flex: 1,
    },
    bigNumber: {
        fontSize: 32,
        lineHeight: 42,
        fontFamily: fonts.bold,
    },
    balance: {
        fontSize: 24,
        lineHeight: 32,
        fontFamily: fonts.bold,
    },
    progress: {
        gap: 4,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
});
