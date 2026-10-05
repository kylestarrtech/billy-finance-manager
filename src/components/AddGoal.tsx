import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, type SavingsGoal } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { DateField, FormField, NumberField, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { formatDate, formatMoney, startOfToday } from '../utils/dates';
import { getSavingsCapacity, goalTotal, planGoals } from '../utils/goals';
import { haptics } from '../utils/haptics';

const toField = (value: number | undefined) => (value !== undefined ? String(value) : '');

export default function AddGoal({ onClose, goalToEdit }: { onClose: () => void; goalToEdit?: SavingsGoal }) {
    const { data, addGoal, editGoal } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(goalToEdit?.name || '');
    const [price, setPrice] = useState(toField(goalToEdit?.price));
    const [taxRate, setTaxRate] = useState(toField(goalToEdit?.taxRate));
    const [targetDate, setTargetDate] = useState(goalToEdit?.targetDate ?? '');
    const [note, setNote] = useState(goalToEdit?.note || '');
    const [error, setError] = useState('');

    const draft: SavingsGoal | null = Number(price) > 0
        ? {
            id: goalToEdit?.id ?? '__draft__',
            name: name.trim() || 'This goal',
            price: Number(price),
            ...(taxRate ? { taxRate: Number(taxRate) } : {}),
            ...(targetDate ? { targetDate } : {}),
        }
        : null;

    // Live preview: plan this goal alongside the others, exactly as the Goals screen will.
    let preview: string | null = null;
    let previewWarns = false;
    if (draft) {
        const today = startOfToday();
        const goals = goalToEdit ? data.goals.map(g => (g.id === draft.id ? draft : g)) : [...data.goals, draft];
        const capacity = getSavingsCapacity(data, today);
        const plan = planGoals({ ...data, goals }, capacity, today).find(p => p.goal.id === draft.id)!;
        const per = capacity.paycheckName ? 'paycheck' : 'month';
        if (plan.done) preview = 'Already fully saved.';
        else if (plan.perPaycheck <= 0) preview = 'Right now nothing is left over after your bills, budgets and debt payments, so Billy can\'t suggest a safe amount yet.';
        else {
            preview = `Billy can safely set aside ${formatMoney(plan.perPaycheck)} per ${per} for this: ready by ${plan.projectedDate ? formatDate(plan.projectedDate) : 'more than 10 years from now'}.`;
            if (plan.target && !plan.target.onTrack) {
                previewWarns = true;
                preview += ` Reaching it by ${formatDate(plan.target.date)} would take ${formatMoney(plan.target.neededPerPaycheck)} per ${per}, more than is safe.`;
            }
        }
    }

    const handleSubmit = () => {
        if (!name.trim() || !(Number(price) > 0)) {
            setError('Please enter what you\'re saving for and its price.');
            haptics.error();
            return;
        }
        const payload = {
            name: name.trim(),
            price: Number(price),
            ...(taxRate ? { taxRate: Number(taxRate) } : {}),
            ...(targetDate ? { targetDate } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
        };
        if (goalToEdit) editGoal(goalToEdit.id, payload);
        else addGoal(payload);
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell title={goalToEdit ? 'Edit Goal' : 'New Savings Goal'} closing={isClosing} onRequestClose={() => setIsClosing(true)} onClosed={onClose}>
            <FormField label="Saving For">
                <TextField value={name} onChangeText={setName} placeholder="Vacation, Laptop, TV, .etc" />
            </FormField>
            <FormField label="Price">
                <NumberField value={price} onChangeText={setPrice} placeholder="0.00" />
            </FormField>
            <FormField label="Sales Tax % (Optional)">
                <NumberField value={taxRate} onChangeText={setTaxRate} placeholder="13" />
                {draft && !!taxRate && (
                    <AppText variant="small" muted style={styles.hint}>{`${formatMoney(goalTotal(draft))} with tax`}</AppText>
                )}
            </FormField>
            <FormField label="Want It By (Optional)">
                <DateField value={targetDate} onChange={setTargetDate} placeholder="Whenever it's affordable" clearable />
            </FormField>
            <FormField label="Note (Optional)">
                <TextField value={note} onChangeText={setNote} />
            </FormField>

            {preview && (
                <AppText variant="small" color={previewWarns ? colors.loss : colors.textMuted} style={styles.preview}>
                    {preview}
                </AppText>
            )}

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={goalToEdit ? 'Save Changes' : 'Add Goal'} variant="primary" onPress={handleSubmit} />
            </View>
        </ModalShell>
    );
}

const styles = StyleSheet.create({
    hint: {
        marginTop: 6,
    },
    preview: {
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 24,
    },
});
