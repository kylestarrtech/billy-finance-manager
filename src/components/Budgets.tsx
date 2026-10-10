import { StyleSheet, View } from 'react-native';
import { useFinance, type Budget, type SpendingEntry } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getBudgetStatus } from '../utils/budgets';
import { getPayPeriod } from '../utils/payPeriod';
import { formatISODate, formatMoney, formatShortDate, parseISODate, startOfToday } from '../utils/dates';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors } from '../theme';
import AppText from './ui/AppText';
import Button, { ScalePressable } from './ui/Button';
import Card from './ui/Card';
import ProgressBar from './ui/ProgressBar';

const VISIBLE_ENTRIES = 5;

export default function Budgets() {
    const { data, budgets, spending, cards, deleteBudget, deleteSpending } = useFinance();
    const { openBudgetEditor, openSpendingEditor } = useEditor();
    const today = startOfToday();
    const payPeriod = getPayPeriod(data.incomes, data.settings.payPeriodIncomeId, today);
    const payWindow = payPeriod ? { start: payPeriod.start, end: payPeriod.end } : null;
    const cardName = (id: string | undefined) => cards.find(c => c.id === id)?.name;

    const handleDeleteBudget = async (budget: Budget) => {
        haptics.warning();
        const onCards = spending.some(e => e.budgetId === budget.id && cardName(e.cardId));
        const message = `Delete "${budget.name}" and everything logged against it?${onCards ? ' Spending put on a card stays on the card as a charge.' : ''} This cannot be undone.`;
        if (await confirmAsync('Delete Budget', message, { confirmText: 'Delete', destructive: true })) {
            deleteBudget(budget.id);
        }
    };

    const handleDeleteEntry = async (entry: SpendingEntry) => {
        const card = cardName(entry.cardId);
        const message = `Delete ${formatMoney(entry.amount)}${entry.note ? ` (${entry.note})` : ''} from ${formatISODate(entry.date)}?${card ? ` It also comes off ${card}'s balance.` : ''}`;
        if (await confirmAsync('Delete Entry', message, { confirmText: 'Delete', destructive: true })) {
            deleteSpending(entry.id);
        }
    };

    return (
        <View style={styles.list}>
            <View style={styles.header}>
                <AppText variant="h2">Budgets ({budgets.length})</AppText>
                <Button title="+ Add" small onPress={() => openBudgetEditor()} />
            </View>

            {budgets.length === 0 && (
                <Card>
                    <AppText bold>No budgets yet</AppText>
                    <AppText muted style={styles.emptyText}>
                        Budgets are for costs that vary, like groceries, gas or eating out. Set an amount per week, month or pay period, log what you spend, and Billy shows what’s left. For example: Groceries, $500 a month.
                    </AppText>
                </Card>
            )}

            {budgets.map(budget => {
                const status = getBudgetStatus(budget, spending, today, payWindow);
                const over = status.remaining < 0;
                const hidden = status.entries.length - VISIBLE_ENTRIES;
                return (
                    <Card key={budget.id} style={styles.card}>
                        <View style={styles.titleRow}>
                            <AppText variant="h3" style={styles.flex}>{budget.name}</AppText>
                            {budget.isEssential && <AppText variant="caption" muted>ESSENTIAL</AppText>}
                        </View>

                        <View style={styles.amountRow}>
                            <AppText>
                                <AppText bold>{formatMoney(status.spent)}</AppText>
                                <AppText muted>{` of ${formatMoney(budget.amount)}`}</AppText>
                            </AppText>
                            <AppText bold color={over ? colors.loss : colors.gain}>
                                {over ? `${formatMoney(-status.remaining)} over` : `${formatMoney(status.remaining)} left`}
                            </AppText>
                        </View>
                        <ProgressBar ratio={status.ratio} />
                        <AppText variant="small" muted>
                            {`${status.window.label} · ${formatShortDate(status.window.start)}–${formatShortDate(status.window.end)} · ${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'} left`}
                        </AppText>

                        {status.entries.length > 0 && (
                            <View style={styles.entries}>
                                {status.entries.slice(0, VISIBLE_ENTRIES).map(entry => (
                                    <ScalePressable key={entry.id} pressedScale={0.98} onPress={() => handleDeleteEntry(entry)} accessibilityLabel={`Delete ${entry.note ?? 'entry'}`}>
                                        <View style={styles.entry}>
                                            <AppText variant="small" muted style={styles.entryDate}>{formatShortDate(parseISODate(entry.date))}</AppText>
                                            <AppText variant="small" style={styles.flex} numberOfLines={1}>
                                                {entry.note || 'Spending'}
                                                {!!cardName(entry.cardId) && <AppText variant="small" muted>{` · ${cardName(entry.cardId)}`}</AppText>}
                                            </AppText>
                                            <AppText variant="small">{formatMoney(entry.amount)}</AppText>
                                        </View>
                                    </ScalePressable>
                                ))}
                                {hidden > 0 && <AppText variant="caption" muted>{`+ ${hidden} more this period`}</AppText>}
                                <AppText variant="caption" muted>Tap an entry to delete it.</AppText>
                            </View>
                        )}

                        <View style={styles.actions}>
                            <Button title="+ Spending" variant="primary" small onPress={() => openSpendingEditor(budget.id)} />
                            <Button title="Edit" variant="secondary" small onPress={() => openBudgetEditor(budget)} />
                            <Button title="Delete" variant="danger" small onPress={() => handleDeleteBudget(budget)} />
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
        gap: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    flex: {
        flex: 1,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 8,
    },
    entries: {
        gap: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: colors.tableBorder,
    },
    entry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
    },
    entryDate: {
        width: 52,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
});
