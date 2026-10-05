import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, type Bill } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getFrequencyBreakdown, normalizeToMonthly, getNextPaymentDetails } from '../utils/financeHelpers';
import { addDays, formatDate, formatISODate, formatMoney, startOfToday } from '../utils/dates';
import { getDueItems, OVERDUE_WINDOW_DAYS } from '../utils/schedule';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import BreakdownGrid from './ui/BreakdownGrid';
import ListToolbar from './ui/ListToolbar';

export default function Bills() {
    const { bills, payments, deleteBill } = useFinance();
    const { openBillEditor, openPaymentSheet } = useEditor();
    const today = startOfToday();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCondensed, setIsCondensed] = useState(false);

    const filteredBills = bills.filter(bill =>
        bill.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedBills = [...filteredBills].sort((a, b) =>
        normalizeToMonthly(b.cost, b.frequency) - normalizeToMonthly(a.cost, a.frequency)
    );

    // Deletes are one tap away on a touchscreen, so ask first.
    const handleDelete = async (bill: Bill) => {
        haptics.warning();
        if (await confirmAsync('Delete Bill', `Delete "${bill.name}"? This cannot be undone.`, { confirmText: 'Delete', destructive: true })) {
            deleteBill(bill.id);
        }
    };

    return (
        <View style={styles.list}>
            <ListToolbar
                title={`Bills (${bills.length})`}
                searchPlaceholder="Search bills..."
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isCondensed={isCondensed}
                onCondensedChange={setIsCondensed}
            />

            {sortedBills.length === 0 ? (
                <AppText color="#aaaaaa">No bills found.</AppText>
            ) : (
                sortedBills.map(bill => {
                    const breakdown = getFrequencyBreakdown(bill.cost, bill.frequency);
                    const details = getNextPaymentDetails(bill);
                    // The next occurrence still waiting to be paid (recently missed ones count as overdue).
                    const nextUnpaid = getDueItems({ bills: [bill], cards: [], payments }, addDays(today, -OVERDUE_WINDOW_DAYS), addDays(today, 400), today)
                        .find(item => !item.payment);
                    const lastPayment = payments
                        .filter(p => p.kind === 'bill' && p.itemId === bill.id)
                        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
                    const isOverdue = !!nextUnpaid && nextUnpaid.date < today;
                    return (
                        <Card key={bill.id} style={styles.card}>
                            <View>
                                <AppText variant="h3" style={styles.name}>{bill.name}</AppText>
                                <AppText muted>
                                    {formatMoney(bill.cost)} / {bill.frequency}
                                    <AppText variant="small" muted>{`   (~${formatMoney(breakdown.monthly)}/mo)`}</AppText>
                                </AppText>
                                <AppText style={styles.detail} color={isOverdue ? colors.loss : undefined}>
                                    <AppText bold color={isOverdue ? colors.loss : undefined}>{isOverdue ? 'Overdue: ' : 'Next Payment: '}</AppText>
                                    {nextUnpaid ? formatDate(nextUnpaid.date) : details.isComplete ? 'None (one-time payment made)' : formatDate(details.nextDate)}
                                </AppText>
                                {lastPayment && (
                                    <AppText variant="small" color={colors.gain} style={styles.detail}>
                                        {`✓ Last paid: ${formatMoney(lastPayment.amount)} for ${formatISODate(lastPayment.dueDate)}`}
                                    </AppText>
                                )}
                                {!!bill.note && <AppText variant="small" italic style={styles.detail}>Note: {bill.note}</AppText>}
                            </View>

                            {!isCondensed && <BreakdownGrid breakdown={breakdown} />}

                            <View style={styles.actions}>
                                {nextUnpaid && <Button title="Mark Paid" variant="primary" small onPress={() => openPaymentSheet(nextUnpaid)} />}
                                <Button title="Edit" variant="secondary" small onPress={() => openBillEditor(bill)} />
                                <Button title="Delete" variant="danger" small onPress={() => handleDelete(bill)} />
                            </View>
                        </Card>
                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        gap: 16,
    },
    card: {
        gap: 16,
    },
    name: {
        marginBottom: 8,
    },
    detail: {
        marginTop: 8,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
    },
});
