import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, PaymentFrequency, type Income } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, DateField, FormField, NumberField, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { haptics } from '../utils/haptics';

interface AddIncomeProps {
    onClose: () => void;
    incomeToEdit?: Income;
}

const FREQUENCIES = Object.values(PaymentFrequency);

export default function AddIncome({ onClose, incomeToEdit }: AddIncomeProps) {
    const { addIncome, editIncome } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(incomeToEdit?.name || '');
    const [amount, setAmount] = useState(incomeToEdit?.amount !== undefined ? String(incomeToEdit.amount) : '');
    const [frequency, setFrequency] = useState<PaymentFrequency>(incomeToEdit?.frequency || PaymentFrequency.Monthly);
    const [initialPaymentDate, setInitialPaymentDate] = useState(incomeToEdit?.initialPaymentDate || '');
    const [endingPaymentDate, setEndingPaymentDate] = useState(incomeToEdit?.endingPaymentDate || '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name.trim() || amount === '' || isNaN(Number(amount)) || !initialPaymentDate) {
            setError('Please fill in the name, amount and initial payment date.');
            haptics.error();
            return;
        }

        const payload = {
            name: name.trim(),
            amount: Number(amount),
            frequency,
            initialPaymentDate,
            ...(endingPaymentDate ? { endingPaymentDate } : {})
        };

        if (incomeToEdit) {
            editIncome(incomeToEdit.id, payload);
        } else {
            addIncome(payload);
        }
        haptics.success();
        handleClose();
    };

    const handleClose = () => {
        setIsClosing(true);
    };

    return (
        <ModalShell
            title={incomeToEdit ? 'Edit Income' : 'Add Income'}
            closing={isClosing}
            onRequestClose={handleClose}
            onClosed={onClose}
        >
            <FormField label="Name">
                <TextField value={name} onChangeText={setName} autoCapitalize="words" />
            </FormField>
            <FormField label="Amount">
                <NumberField value={amount} onChangeText={setAmount} placeholder="0.00" />
            </FormField>
            <FormField label="Frequency">
                <ChipSelect options={FREQUENCIES} value={frequency} onChange={setFrequency} />
            </FormField>
            <FormField label="Initial Payment Date">
                <DateField value={initialPaymentDate} onChange={setInitialPaymentDate} />
            </FormField>
            <FormField label="Ending Payment Date (Optional)">
                <DateField value={endingPaymentDate} onChange={setEndingPaymentDate} placeholder="No end date" clearable />
            </FormField>

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={handleClose} />
                <Button title={incomeToEdit ? 'Save Changes' : 'Add Income'} variant="primary" onPress={handleSubmit} />
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
