import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, DateField, FormField, NumberField, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { startOfToday, toISODate } from '../utils/dates';
import { haptics } from '../utils/haptics';

// Logs money spent against a budget ("$84.20 at Costco").
export default function AddSpending({ onClose, budgetId }: { onClose: () => void; budgetId?: string }) {
    const { budgets, addSpending } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [selected, setSelected] = useState(budgetId ?? budgets[0]?.id ?? '');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(toISODate(startOfToday()));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!selected || amount === '' || !(Number(amount) > 0) || !date) {
            setError('Please choose a budget and enter an amount.');
            haptics.error();
            return;
        }
        addSpending({ budgetId: selected, amount: Number(amount), date, ...(note.trim() ? { note: note.trim() } : {}) });
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell title="Log Spending" closing={isClosing} onRequestClose={() => setIsClosing(true)} onClosed={onClose}>
            <FormField label="Budget">
                <ChipSelect options={budgets.map(b => b.id)} value={selected} onChange={setSelected} getLabel={id => budgets.find(b => b.id === id)?.name ?? ''} />
            </FormField>
            <FormField label="Amount">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" autoFocus />
            </FormField>
            <FormField label="Date">
                <DateField value={date} onChange={setDate} />
            </FormField>
            <FormField label="Note (Optional)">
                <TextField value={note} onChangeText={setNote} placeholder="Costco" />
            </FormField>

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title="Log Spending" variant="primary" onPress={handleSubmit} />
            </View>
        </ModalShell>
    );
}

const styles = StyleSheet.create({
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 24,
    },
});
