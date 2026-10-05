import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, BudgetPeriod, type Budget } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, FormField, NumberField, SwitchRow, TextField } from './ui/FormControls';
import { BUDGET_PERIOD_LABELS } from '../utils/budgets';
import { colors } from '../theme';
import { haptics } from '../utils/haptics';

const PERIODS = Object.values(BudgetPeriod);

export default function AddBudget({ onClose, budgetToEdit }: { onClose: () => void; budgetToEdit?: Budget }) {
    const { addBudget, editBudget } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(budgetToEdit?.name || '');
    const [amount, setAmount] = useState(budgetToEdit ? String(budgetToEdit.amount) : '');
    const [period, setPeriod] = useState<BudgetPeriod>(budgetToEdit?.period || BudgetPeriod.Monthly);
    const [isEssential, setIsEssential] = useState(budgetToEdit?.isEssential ?? true);
    const [note, setNote] = useState(budgetToEdit?.note || '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name.trim() || amount === '' || !(Number(amount) > 0)) {
            setError('Please enter a name and an amount above zero.');
            haptics.error();
            return;
        }
        const payload = { name: name.trim(), amount: Number(amount), period, isEssential, ...(note ? { note } : {}) };
        if (budgetToEdit) editBudget(budgetToEdit.id, payload);
        else addBudget(payload);
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell
            title={budgetToEdit ? 'Edit Budget' : 'Add Budget'}
            closing={isClosing}
            onRequestClose={() => setIsClosing(true)}
            onClosed={onClose}
        >
            <AppText variant="small" muted style={styles.intro}>
                For costs that vary, like groceries or gas. Log what you spend and Billy tracks what’s left.
            </AppText>
            <FormField label="Name">
                <TextField value={name} onChangeText={setName} autoCapitalize="words" placeholder="Groceries" />
            </FormField>
            <FormField label="Amount">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" />
            </FormField>
            <FormField label="Resets">
                <ChipSelect options={PERIODS} value={period} onChange={setPeriod} getLabel={p => BUDGET_PERIOD_LABELS[p]} />
            </FormField>
            <SwitchRow label="Is Essential" description="Counts toward Needs in the 50/30/20 split." value={isEssential} onValueChange={setIsEssential} />
            <FormField label="Note (Optional)">
                <TextField value={note} onChangeText={setNote} />
            </FormField>

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={budgetToEdit ? 'Save Changes' : 'Add Budget'} variant="primary" onPress={handleSubmit} />
            </View>
        </ModalShell>
    );
}

const styles = StyleSheet.create({
    intro: {
        marginTop: -8,
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 24,
    },
});
