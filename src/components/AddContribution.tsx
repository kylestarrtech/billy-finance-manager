import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { DateField, FormField, NumberField, SwitchRow } from './ui/FormControls';
import { colors } from '../theme';
import { formatMoney, startOfToday, toISODate } from '../utils/dates';
import { goalSaved, goalTotal } from '../utils/goals';
import { haptics } from '../utils/haptics';

// Records money put toward (or taken back out of) a savings goal.
export default function AddContribution({ onClose, goalId, suggested }: { onClose: () => void; goalId: string; suggested?: number }) {
    const { goals, contributions, addContribution } = useFinance();
    const goal = goals.find(g => g.id === goalId);
    const [isClosing, setIsClosing] = useState(false);
    const [amount, setAmount] = useState(suggested && suggested > 0 ? suggested.toFixed(2) : '');
    const [date, setDate] = useState(toISODate(startOfToday()));
    const [withdraw, setWithdraw] = useState(false);
    const [error, setError] = useState('');

    if (!goal) return null;
    const saved = goalSaved(goal.id, contributions);
    const total = goalTotal(goal);

    const handleSubmit = () => {
        const value = Number(amount);
        if (!(value > 0) || !date) {
            setError('Please enter an amount.');
            haptics.error();
            return;
        }
        if (withdraw && value > saved + 0.005) {
            setError(`Only ${formatMoney(saved)} is saved toward this goal.`);
            haptics.error();
            return;
        }
        addContribution({ goalId, amount: withdraw ? -value : value, date });
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell title={withdraw ? 'Take Money Out' : 'Add to Savings'} closing={isClosing} onRequestClose={() => setIsClosing(true)} onClosed={onClose}>
            <AppText variant="h3">{goal.name}</AppText>
            <AppText muted style={styles.subtitle}>{`${formatMoney(saved)} of ${formatMoney(total)} saved`}</AppText>

            <FormField label="Amount">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" />
                {!!suggested && suggested > 0 && !withdraw && (
                    <AppText variant="small" muted style={styles.hint}>{`Billy suggests ${formatMoney(suggested)} this paycheck.`}</AppText>
                )}
            </FormField>
            <FormField label="Date">
                <DateField value={date} onChange={setDate} />
            </FormField>
            <SwitchRow label="Taking money out" description="For when you dip into the savings." value={withdraw} onValueChange={setWithdraw} />

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={withdraw ? 'Take Out' : 'Save It'} variant="primary" onPress={handleSubmit} />
            </View>
        </ModalShell>
    );
}

const styles = StyleSheet.create({
    subtitle: {
        marginTop: 2,
        marginBottom: 16,
    },
    hint: {
        marginTop: 6,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 24,
    },
});
