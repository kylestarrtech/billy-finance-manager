import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, type Bill } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getFrequencyBreakdown, normalizeToMonthly, getNextPaymentDetails } from '../utils/financeHelpers';
import { formatDate } from '../utils/dates';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import BreakdownGrid from './ui/BreakdownGrid';
import ListToolbar from './ui/ListToolbar';

export default function Bills() {
    const { bills, deleteBill } = useFinance();
    const { openBillEditor } = useEditor();
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
                    return (
                        <Card key={bill.id} style={styles.card}>
                            <View>
                                <AppText variant="h3" style={styles.name}>{bill.name} {bill.isFinanced ? '(Financed)' : ''}</AppText>
                                <AppText muted>
                                    ${bill.cost.toFixed(2)} / {bill.frequency}
                                    <AppText variant="small" muted>{`   (~$${breakdown.monthly.toFixed(2)}/mo)`}</AppText>
                                </AppText>
                                <AppText style={styles.detail}>
                                    <AppText bold>Next Payment: </AppText>
                                    {details.isComplete ? 'None (one-time payment made)' : formatDate(details.nextDate)}
                                </AppText>
                                {bill.isFinanced && (
                                    <AppText color={colors.loss} style={styles.detail}>
                                        <AppText bold color={colors.loss}>Financed: </AppText>
                                        ${details.remainingBalance.toFixed(2)} remaining ({details.paymentsLeft} payments left of {bill.loanTermMonths})
                                    </AppText>
                                )}
                                {!!bill.note && <AppText variant="small" italic style={styles.detail}>Note: {bill.note}</AppText>}
                            </View>

                            {!isCondensed && <BreakdownGrid breakdown={breakdown} />}

                            <View style={styles.actions}>
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
        justifyContent: 'flex-end',
        gap: 8,
    },
});
