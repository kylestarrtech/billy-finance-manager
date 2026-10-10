import { StyleSheet, View } from 'react-native';
import { isLoan, useFinance, type CreditCard } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getCardsSummary, projectPayoff, utilization } from '../utils/cards';
import { addDays, formatDate, formatMoney, formatMonthYear, ordinal, startOfToday } from '../utils/dates';
import { getDueItems, OVERDUE_WINDOW_DAYS } from '../utils/schedule';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import ProgressBar from './ui/ProgressBar';
import CardActivityList from './CardActivityList';

export default function Cards() {
    const { cards: debts, payments, deleteCard } = useFinance();
    // Loans / financing share the same records but live in their own section.
    const cards = debts.filter(c => !isLoan(c));
    const { openCardEditor, openPaymentSheet, openCardTransactionEditor } = useEditor();
    const today = startOfToday();
    const summary = getCardsSummary(cards, today);
    const cardsWithBalance = cards.filter(c => c.balance > 0);

    const handleDelete = async (card: CreditCard) => {
        haptics.warning();
        if (await confirmAsync('Delete Card', `Delete "${card.name}" and its payment history? This cannot be undone.`, { confirmText: 'Delete', destructive: true })) {
            deleteCard(card.id);
        }
    };

    return (
        <View style={styles.list}>
            <View style={styles.header}>
                <AppText variant="h2">Credit Cards ({cards.length})</AppText>
                <Button title="+ Add" small onPress={() => openCardEditor()} />
            </View>

            {cards.length === 0 && (
                <Card>
                    <AppText bold>No credit cards yet</AppText>
                    <AppText muted style={styles.emptyText}>
                        Add each card’s balance, interest rate and what you plan to pay each month. Billy works out when each card will be paid off and how much interest that costs. Card payments show up in your calendar, reminders and pay-period budget.
                    </AppText>
                </Card>
            )}

            {cardsWithBalance.length > 0 && (
                <Card tone={summary.neverPaidOff.length > 0 ? 'loss' : undefined} style={styles.card}>
                    <AppText variant="h3">Payoff Plan</AppText>
                    <AppText style={styles.bigNumber} color={colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                        {formatMoney(summary.totalBalance)}
                    </AppText>
                    <AppText muted>{`Paying ${formatMoney(summary.totalPlanned)} a month across ${cardsWithBalance.length} ${cardsWithBalance.length === 1 ? 'card' : 'cards'}.`}</AppText>
                    {summary.debtFreeDate ? (
                        <AppText>
                            <AppText bold color={colors.gain}>{`Debt-free by ${formatMonthYear(summary.debtFreeDate)}`}</AppText>
                            <AppText muted>{` · ~${formatMoney(summary.totalInterest)} interest to go`}</AppText>
                        </AppText>
                    ) : (
                        <AppText bold color={colors.loss}>
                            {`${summary.neverPaidOff.map(c => c.name).join(', ')} won't be paid off at the planned payment. Raise it above the monthly interest.`}
                        </AppText>
                    )}
                    {cardsWithBalance.length > 1 && summary.focusCard && (
                        <AppText variant="small" muted>
                            {`Got extra? Put it toward ${summary.focusCard.name} first: at ${summary.focusCard.apr}% APR it costs you the most interest.`}
                        </AppText>
                    )}
                </Card>
            )}

            {cards.map(card => {
                const projection = projectPayoff(card, card.plannedPayment, today);
                const used = utilization(card);
                const belowMinimum = !!card.minimumPayment && card.plannedPayment < card.minimumPayment && card.balance > 0;
                const nextDue = getDueItems({ bills: [], cards: [card], payments }, addDays(today, -OVERDUE_WINDOW_DAYS), addDays(today, 62), today)
                    .find(item => !item.payment);
                const lastPayment = payments
                    .filter(p => p.kind === 'card' && p.itemId === card.id)
                    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

                return (
                    <Card key={card.id} style={styles.card}>
                        <View style={styles.titleRow}>
                            <AppText variant="h3" style={styles.flex}>{card.name}</AppText>
                            <AppText variant="small" muted>{`${card.apr}% APR`}</AppText>
                        </View>
                        <View style={styles.balanceRow}>
                            <AppText style={[styles.balance, styles.flex]} color={card.balance > 0 ? colors.loss : colors.gain} adjustsFontSizeToFit numberOfLines={1}>
                                {card.balance > 0 ? formatMoney(card.balance) : 'Paid off'}
                            </AppText>
                            <Button title="Pay / Charge" small onPress={() => openCardTransactionEditor(card.id)} />
                        </View>

                        {used !== null && (
                            <View style={styles.utilization}>
                                <ProgressBar ratio={used} warnAt={0.3} />
                                <AppText variant="small" muted>{`${Math.round(used * 100)}% of ${formatMoney(card.creditLimit!)} limit used`}</AppText>
                            </View>
                        )}

                        {card.balance > 0 && (
                            <>
                                <AppText muted>{`Paying ${formatMoney(card.plannedPayment)} a month, due on the ${ordinal(card.dueDay)}.`}</AppText>
                                {belowMinimum && (
                                    <AppText bold color={colors.loss}>{`That's below the ${formatMoney(card.minimumPayment!)} minimum payment.`}</AppText>
                                )}
                                {projection.months === null ? (
                                    <AppText bold color={colors.loss}>
                                        {`${formatMoney(card.plannedPayment)} doesn't cover the ~${formatMoney(projection.monthlyInterest)} of monthly interest, so this balance will never be paid off.`}
                                    </AppText>
                                ) : (
                                    <AppText>
                                        <AppText bold>{`Paid off ${formatMonthYear(projection.payoffDate!)}`}</AppText>
                                        <AppText muted>{` · ${projection.months} ${projection.months === 1 ? 'payment' : 'payments'} · ~${formatMoney(projection.totalInterest)} interest`}</AppText>
                                    </AppText>
                                )}
                            </>
                        )}

                        {nextDue && (
                            <AppText variant="small" color={nextDue.date < today ? colors.loss : colors.textMuted}>
                                {`${nextDue.date < today ? 'Overdue' : 'Next payment'}: ${formatMoney(nextDue.amount)} on ${formatDate(nextDue.date)}`}
                            </AppText>
                        )}
                        {lastPayment && (
                            <AppText variant="small" color={colors.gain}>{`✓ Last paid: ${formatMoney(lastPayment.amount)}`}</AppText>
                        )}

                        <CardActivityList card={card} />

                        <View style={styles.actions}>
                            {nextDue && <Button title="Mark Paid" variant="primary" small onPress={() => openPaymentSheet(nextDue)} />}
                            <Button title="Edit" variant="secondary" small onPress={() => openCardEditor(card)} />
                            <Button title="Delete" variant="danger" small onPress={() => handleDelete(card)} />
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
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balance: {
        fontSize: 24,
        lineHeight: 32,
        fontFamily: fonts.bold,
    },
    utilization: {
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
