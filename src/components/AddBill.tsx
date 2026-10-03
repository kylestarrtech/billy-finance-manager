import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, PaymentFrequency, type Bill } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { ChipSelect, DateField, FormField, NumberField, SwitchRow, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { haptics } from '../utils/haptics';

interface AddBillProps {
    onClose: () => void;
    billToEdit?: Bill;
}

const FREQUENCIES = Object.values(PaymentFrequency);

export default function AddBill({ onClose, billToEdit }: AddBillProps) {
    const { addBill, editBill } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(billToEdit?.name || '');
    const [cost, setCost] = useState(billToEdit?.cost !== undefined ? String(billToEdit.cost) : '');
    const [frequency, setFrequency] = useState<PaymentFrequency>(billToEdit?.frequency || PaymentFrequency.Monthly);
    const [firstPaymentDate, setFirstPaymentDate] = useState(billToEdit?.firstPaymentDate || '');
    const [isEssential, setIsEssential] = useState(billToEdit?.isEssential ?? true);
    const [note, setNote] = useState(billToEdit?.note || '');
    const [isFinanced, setIsFinanced] = useState(billToEdit?.isFinanced ?? false);
    const [totalLoanAmount, setTotalLoanAmount] = useState(billToEdit?.totalLoanAmount !== undefined ? String(billToEdit.totalLoanAmount) : '');
    const [loanTermMonths, setLoanTermMonths] = useState(billToEdit?.loanTermMonths !== undefined ? String(billToEdit.loanTermMonths) : '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        // Stand-ins for the `required` attributes on the web form.
        if (!name.trim() || cost === '' || isNaN(Number(cost)) || !firstPaymentDate) {
            setError('Please fill in the name, cost and first payment date.');
            haptics.error();
            return;
        }
        if (isFinanced && (!totalLoanAmount || !loanTermMonths)) {
            setError('Financed bills need a total loan amount and loan term.');
            haptics.error();
            return;
        }

        const payload = {
            name: name.trim(),
            cost: Number(cost),
            frequency,
            firstPaymentDate,
            isEssential,
            ...(note ? { note } : {}),
            isFinanced,
            ...(isFinanced && totalLoanAmount ? { totalLoanAmount: Number(totalLoanAmount) } : {}),
            ...(isFinanced && loanTermMonths ? { loanTermMonths: Number(loanTermMonths) } : {})
        };

        if (billToEdit) {
            editBill(billToEdit.id, payload);
        } else {
            addBill(payload);
        }
        haptics.success();
        handleClose();
    };

    const handleClose = () => {
        setIsClosing(true);
    };

    return (
        <ModalShell
            title={billToEdit ? 'Edit Bill' : 'Add Bill'}
            closing={isClosing}
            onRequestClose={handleClose}
            onClosed={onClose}
        >
            <FormField label="Name">
                <TextField value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
            </FormField>
            <FormField label="Cost">
                <NumberField value={cost} onChangeText={setCost} placeholder="0.00" />
            </FormField>
            <FormField label="Frequency">
                <ChipSelect options={FREQUENCIES} value={frequency} onChange={setFrequency} />
            </FormField>
            <FormField label="First Payment Date">
                <DateField value={firstPaymentDate} onChange={setFirstPaymentDate} />
            </FormField>

            <SwitchRow label="Is Essential" value={isEssential} onValueChange={setIsEssential} />
            <SwitchRow label="Is Financed" value={isFinanced} onValueChange={setIsFinanced} />

            {isFinanced && (
                <>
                    <FormField label="Total Loan Amount">
                        <NumberField value={totalLoanAmount} onChangeText={setTotalLoanAmount} placeholder="0.00" />
                    </FormField>
                    <FormField label="Loan Term (Months)">
                        <NumberField value={loanTermMonths} onChangeText={setLoanTermMonths} decimal={false} placeholder="12" />
                    </FormField>
                </>
            )}

            <FormField label="Note (Optional)">
                <TextField value={note} onChangeText={setNote} />
            </FormField>

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={handleClose} />
                <Button title={billToEdit ? 'Save Changes' : 'Add Bill'} variant="primary" onPress={handleSubmit} />
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
