import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isLoan, useFinance, type CardTransaction } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, DateField, FormField, NumberField, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { formatMoney, startOfToday, toISODate } from '../utils/dates';
import { haptics } from '../utils/haptics';

type TransactionType = CardTransaction['type'];

const TYPES: TransactionType[] = ['payment', 'charge'];
const TYPE_LABELS: Record<TransactionType, string> = { payment: 'Payment', charge: 'Charge' };

// A one-off payment toward a card or loan (on top of the monthly one), or a charge on a card. A charge
// that belongs to a budget is logged as that budget's spending, so it counts there too.
export default function AddCardTransaction({ onClose, cardId }: { onClose: () => void; cardId: string }) {
    const { cards, budgets, addCardTransaction, addSpending } = useFinance();
    const card = cards.find(c => c.id === cardId);
    const loan = !!card && isLoan(card);
    const [isClosing, setIsClosing] = useState(false);
    // A paid-off card has nothing to pay, so start on a charge.
    const [type, setType] = useState<TransactionType>(card && !loan && card.balance <= 0 ? 'charge' : 'payment');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(toISODate(startOfToday()));
    const [budgetId, setBudgetId] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    if (!card) return null;
    const isCharge = type === 'charge';
    const value = Number(amount);
    const overpaying = !isCharge && value > card.balance + 0.005;
    const newBalance = Math.max(0, card.balance + (isCharge ? value : -value));
    const budgetName = budgets.find(b => b.id === budgetId)?.name;

    const handleSubmit = () => {
        if (!(value > 0) || !date) {
            setError('Please enter an amount.');
            haptics.error();
            return;
        }
        if (overpaying) {
            setError(card.balance > 0 ? `That's more than the ${formatMoney(card.balance)} owing.` : 'Nothing is owing.');
            haptics.error();
            return;
        }
        const trimmed = note.trim();
        if (isCharge && budgetName) {
            addSpending({ budgetId, amount: value, date, cardId, ...(trimmed ? { note: trimmed } : {}) });
        } else {
            addCardTransaction({ cardId, type, amount: value, date, ...(trimmed ? { note: trimmed } : {}) });
        }
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell
            title={isCharge ? 'Add a Charge' : loan ? 'Extra Payment' : 'Make a Payment'}
            closing={isClosing}
            onRequestClose={() => setIsClosing(true)}
            onClosed={onClose}
        >
            <AppText variant="h3">{card.name}</AppText>
            <AppText muted style={styles.subtitle}>{card.balance > 0 ? `${formatMoney(card.balance)} owing` : 'Paid off'}</AppText>

            {!loan && (
                <FormField label="Type">
                    <ChipSelect options={TYPES} value={type} onChange={setType} getLabel={t => TYPE_LABELS[t]} />
                </FormField>
            )}
            <FormField label="Amount">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" autoFocus />
            </FormField>
            <FormField label="Date">
                <DateField value={date} onChange={setDate} />
            </FormField>
            {isCharge && budgets.length > 0 && (
                <FormField label="Budget (Optional)">
                    <ChipSelect
                        options={['', ...budgets.map(b => b.id)]}
                        value={budgetId}
                        onChange={setBudgetId}
                        getLabel={id => budgets.find(b => b.id === id)?.name ?? 'None'}
                    />
                </FormField>
            )}
            <FormField label="Note (Optional)">
                <TextField value={note} onChangeText={setNote} placeholder={isCharge ? 'Amazon' : 'Bonus money'} />
            </FormField>

            {value > 0 && !overpaying && (
                <AppText variant="small" muted>
                    {isCharge
                        ? `Raises the balance to ${formatMoney(newBalance)}${budgetName ? ` and counts toward ${budgetName}` : ''}.`
                        : newBalance <= 0
                            ? `Pays off the ${loan ? 'loan' : 'card'}.`
                            : `Lowers the balance to ${formatMoney(newBalance)}. Your regular monthly payment stays the same.`}
                </AppText>
            )}

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={isCharge ? 'Add Charge' : 'Record Payment'} variant="primary" onPress={handleSubmit} />
            </View>
        </ModalShell>
    );
}

const styles = StyleSheet.create({
    subtitle: {
        marginTop: 2,
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 24,
    },
});
