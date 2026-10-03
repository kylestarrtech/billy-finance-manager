import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, type Income as IncomeType } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getFrequencyBreakdown, normalizeToMonthly } from '../utils/financeHelpers';
import { formatISODate } from '../utils/dates';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import BreakdownGrid from './ui/BreakdownGrid';
import ListToolbar from './ui/ListToolbar';

export default function Income() {
    const { incomes, deleteIncome } = useFinance();
    const { openIncomeEditor } = useEditor();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCondensed, setIsCondensed] = useState(false);

    const filteredIncomes = incomes.filter(income =>
        income.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedIncomes = [...filteredIncomes].sort((a, b) =>
        normalizeToMonthly(b.amount, b.frequency) - normalizeToMonthly(a.amount, a.frequency)
    );

    const handleDelete = async (income: IncomeType) => {
        haptics.warning();
        if (await confirmAsync('Delete Income', `Delete "${income.name}"? This cannot be undone.`, { confirmText: 'Delete', destructive: true })) {
            deleteIncome(income.id);
        }
    };

    return (
        <View style={styles.list}>
            <ListToolbar
                title={`Income (${incomes.length})`}
                searchPlaceholder="Search income..."
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isCondensed={isCondensed}
                onCondensedChange={setIsCondensed}
            />

            {sortedIncomes.length === 0 ? (
                <AppText color="#aaaaaa">No income sources found.</AppText>
            ) : (
                sortedIncomes.map(income => {
                    const breakdown = getFrequencyBreakdown(income.amount, income.frequency);
                    return (
                        <Card key={income.id} style={styles.card}>
                            <View>
                                <AppText variant="h3" style={styles.name}>{income.name}</AppText>
                                <AppText muted>
                                    ${income.amount.toFixed(2)} / {income.frequency}
                                    <AppText variant="small" muted>{`   (~$${breakdown.monthly.toFixed(2)}/mo)`}</AppText>
                                </AppText>
                                {!!income.endingPaymentDate && (
                                    <AppText variant="small" italic style={styles.detail}>Ends on: {formatISODate(income.endingPaymentDate)}</AppText>
                                )}
                            </View>

                            {!isCondensed && <BreakdownGrid breakdown={breakdown} />}

                            <View style={styles.actions}>
                                <Button title="Edit" variant="secondary" small onPress={() => openIncomeEditor(income)} />
                                <Button title="Delete" variant="danger" small onPress={() => handleDelete(income)} />
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
