import { StyleSheet, View } from 'react-native';
import { useFinance, type CreditCard } from '../context/FinanceContext';
import { getCardActivity, type CardActivity } from '../utils/cards';
import { formatISODate, formatMoney, formatShortDate, parseISODate } from '../utils/dates';
import { confirmAsync } from '../utils/dialogs';
import { colors } from '../theme';
import AppText from './ui/AppText';
import { ScalePressable } from './ui/Button';

const VISIBLE_ENTRIES = 5;

// One-off payments and charges on a card or loan (budget spending put on it included), listed like a
// budget's spending. Deleting one undoes what it did to the balance.
export default function CardActivityList({ card }: { card: CreditCard }) {
    const { cardTransactions, spending, budgets, deleteCardTransaction, deleteSpending } = useFinance();
    const activity = getCardActivity(card.id, { cardTransactions, spending, budgets });
    if (activity.length === 0) return null;
    const hidden = activity.length - VISIBLE_ENTRIES;

    const handleDelete = async (entry: CardActivity) => {
        const effect = entry.amount < 0
            ? `${card.name}'s balance goes back up by that much.`
            : `It comes off ${card.name}'s balance${entry.source === 'spending' ? ' and its budget' : ''}.`;
        if (await confirmAsync('Delete Entry', `Delete ${entry.label} (${formatMoney(Math.abs(entry.amount))}) from ${formatISODate(entry.date)}? ${effect}`, { confirmText: 'Delete', destructive: true })) {
            if (entry.source === 'spending') deleteSpending(entry.id);
            else deleteCardTransaction(entry.id);
        }
    };

    return (
        <View style={styles.entries}>
            {activity.slice(0, VISIBLE_ENTRIES).map(entry => (
                <ScalePressable key={entry.id} pressedScale={0.98} onPress={() => handleDelete(entry)} accessibilityLabel={`Delete ${entry.label}`}>
                    <View style={styles.entry}>
                        <AppText variant="small" muted style={styles.entryDate}>{formatShortDate(parseISODate(entry.date))}</AppText>
                        <AppText variant="small" style={styles.flex} numberOfLines={1}>{entry.label}</AppText>
                        <AppText variant="small" color={entry.amount < 0 ? colors.gain : undefined}>
                            {`${entry.amount < 0 ? '-' : '+'}${formatMoney(Math.abs(entry.amount))}`}
                        </AppText>
                    </View>
                </ScalePressable>
            ))}
            {hidden > 0 && <AppText variant="caption" muted>{`+ ${hidden} older`}</AppText>}
            <AppText variant="caption" muted>Tap an entry to delete it.</AppText>
        </View>
    );
}

const styles = StyleSheet.create({
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
    flex: {
        flex: 1,
    },
});
