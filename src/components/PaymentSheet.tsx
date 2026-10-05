import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { DateField, FormField, NumberField } from './ui/FormControls';
import { colors } from '../theme';
import { formatLongDate, formatMoney, startOfToday, toISODate } from '../utils/dates';
import type { DueItem } from '../utils/schedule';
import { haptics } from '../utils/haptics';

// Marks one occurrence of a bill or card payment as paid, with the actual amount (bills like utilities vary).
export default function PaymentSheet({ onClose, due }: { onClose: () => void; due: DueItem }) {
    const { markPaid, unmarkPaid } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [amount, setAmount] = useState(due.amount.toFixed(2));
    const [paidDate, setPaidDate] = useState(due.payment?.paidDate ?? toISODate(startOfToday()));
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (amount === '' || !(Number(amount) >= 0) || !paidDate) {
            setError('Please enter the amount paid.');
            haptics.error();
            return;
        }
        markPaid({ kind: due.kind, itemId: due.itemId, dueDate: due.dueDate }, Number(amount), paidDate);
        haptics.success();
        setIsClosing(true);
    };

    const handleUnmark = () => {
        if (due.payment) unmarkPaid(due.payment.id);
        haptics.warning();
        setIsClosing(true);
    };

    return (
        <ModalShell title={due.payment ? 'Payment' : 'Mark as Paid'} closing={isClosing} onRequestClose={() => setIsClosing(true)} onClosed={onClose}>
            <AppText variant="h3">{due.name}</AppText>
            <AppText muted style={styles.subtitle}>
                {due.kind === 'card' ? (due.isLoan ? 'Loan payment' : 'Card payment') : 'Bill'} due {formatLongDate(due.date)}
            </AppText>

            <FormField label="Amount Paid">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" />
            </FormField>
            <FormField label="Date Paid">
                <DateField value={paidDate} onChange={setPaidDate} />
            </FormField>
            {due.kind === 'card' && (
                <AppText variant="small" muted>
                    {due.payment
                        ? `Changing the amount adjusts the ${due.isLoan ? 'loan' : 'card'} balance by the difference.`
                        : `Marking this paid lowers the ${due.isLoan ? 'loan' : 'card'}'s balance by ${amount ? formatMoney(Number(amount)) : 'the amount'}.`}
                </AppText>
            )}

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                {due.payment && <Button title="Mark Unpaid" variant="danger" onPress={handleUnmark} />}
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={due.payment ? 'Save' : 'Mark Paid'} variant="primary" onPress={handleSubmit} />
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
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
    },
});
