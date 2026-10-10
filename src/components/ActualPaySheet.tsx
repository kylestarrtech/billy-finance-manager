import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, FormField, NumberField } from './ui/FormControls';
import { colors } from '../theme';
import { formatMoney, formatShortDate, parseISODate, startOfToday, toISODate } from '../utils/dates';
import { recentPaydays } from '../utils/schedule';
import { haptics } from '../utils/haptics';

// What one paycheck actually came to, for pay that changes with the hours worked. It replaces the
// income's usual amount for that payday only (pay period, calendar and savings suggestions use it).
export default function ActualPaySheet({ onClose, incomeId, payDate: initialPayDate }: { onClose: () => void; incomeId: string; payDate?: string }) {
    const { incomes, incomeActuals, setIncomeActual, deleteIncomeActual } = useFinance();
    const income = incomes.find(i => i.id === incomeId);
    const todayKey = toISODate(startOfToday());
    const recent = income ? recentPaydays(income).map(toISODate) : [];
    // A payday picked on the calendar can be older than the recent ones offered here.
    const paydays = initialPayDate && !recent.includes(initialPayDate)
        ? [...recent, initialPayDate].sort((a, b) => b.localeCompare(a))
        : recent;
    const actualFor = (payDate: string) => incomeActuals.find(a => a.incomeId === incomeId && a.payDate === payDate);
    const amountFor = (payDate: string) => actualFor(payDate)?.amount.toFixed(2) ?? '';

    const [isClosing, setIsClosing] = useState(false);
    const [payDate, setPayDate] = useState(initialPayDate ?? recent.find(d => d <= todayKey) ?? recent[0] ?? '');
    const [amount, setAmount] = useState(() => amountFor(payDate));
    const [error, setError] = useState('');

    if (!income) return null;
    const actual = actualFor(payDate);

    const selectPayday = (date: string) => {
        setPayDate(date);
        setAmount(amountFor(date));
        setError('');
    };

    const handleSubmit = () => {
        if (!payDate || amount === '' || !(Number(amount) >= 0)) {
            setError('Please enter what you were paid.');
            haptics.error();
            return;
        }
        setIncomeActual(incomeId, payDate, Number(amount));
        haptics.success();
        setIsClosing(true);
    };

    const handleRemove = () => {
        if (actual) deleteIncomeActual(actual.id);
        haptics.warning();
        setIsClosing(true);
    };

    return (
        <ModalShell title="Actual Pay" closing={isClosing} onRequestClose={() => setIsClosing(true)} onClosed={onClose}>
            <AppText variant="h3">{income.name}</AppText>
            <AppText muted style={styles.subtitle}>{`Usually ${formatMoney(income.amount)} / ${income.frequency}`}</AppText>

            {paydays.length === 0 ? (
                <AppText muted>There are no recent or upcoming paydays for this income.</AppText>
            ) : (
                <>
                    <FormField label="Payday">
                        <ChipSelect
                            options={paydays}
                            value={payDate}
                            onChange={selectPayday}
                            getLabel={date => `${formatShortDate(parseISODate(date))}${actualFor(date) ? ' ✓' : ''}`}
                        />
                    </FormField>
                    <FormField label="Amount Received">
                        <NumberField value={amount} onChangeText={setAmount} placeholder={income.amount.toFixed(2)} />
                        <AppText variant="small" muted style={styles.hint}>
                            {`Replaces the usual ${formatMoney(income.amount)} for the ${formatShortDate(parseISODate(payDate))} paycheck only.`}
                        </AppText>
                    </FormField>
                </>
            )}

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                {actual && <Button title="Remove" variant="danger" onPress={handleRemove} />}
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                {paydays.length > 0 && <Button title="Save" variant="primary" onPress={handleSubmit} />}
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
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
    },
});
