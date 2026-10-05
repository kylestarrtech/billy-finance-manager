import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFinance, type CreditCard, type DebtKind } from '../context/FinanceContext';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import AppText from './ui/AppText';
import { DateField, FormField, NumberField, TextField } from './ui/FormControls';
import { colors } from '../theme';
import { formatMoney, formatMonthYear } from '../utils/dates';
import { projectPayoff } from '../utils/cards';
import { haptics } from '../utils/haptics';

const toField = (value: number | undefined) => (value !== undefined ? String(value) : '');

// Adds or edits a credit card, or (kind 'loan') a loan / financed purchase.
export default function AddCard({ onClose, cardToEdit, kind: requestedKind = 'card' }: { onClose: () => void; cardToEdit?: CreditCard; kind?: DebtKind }) {
    const { addCard, editCard } = useFinance();
    const kind: DebtKind = cardToEdit?.kind ?? requestedKind;
    const loan = kind === 'loan';
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(cardToEdit?.name || '');
    const [balance, setBalance] = useState(toField(cardToEdit?.balance));
    const [apr, setApr] = useState(toField(cardToEdit?.apr));
    const [creditLimit, setCreditLimit] = useState(toField(cardToEdit?.creditLimit));
    const [minimumPayment, setMinimumPayment] = useState(toField(cardToEdit?.minimumPayment));
    const [plannedPayment, setPlannedPayment] = useState(toField(cardToEdit?.plannedPayment));
    const [dueDay, setDueDay] = useState(toField(cardToEdit?.dueDay));
    const [originalAmount, setOriginalAmount] = useState(toField(cardToEdit?.originalAmount));
    const [promoEndDate, setPromoEndDate] = useState(cardToEdit?.promoEndDate ?? '');
    const [error, setError] = useState('');

    // Live preview of the payoff plan as the numbers are typed.
    const preview = balance !== '' && plannedPayment !== '' && Number(plannedPayment) > 0
        ? projectPayoff({ balance: Number(balance), apr: Number(apr || 0), dueDay: Number(dueDay || 1) }, Number(plannedPayment))
        : null;

    const handleSubmit = () => {
        const day = Number(dueDay);
        if (!name.trim() || balance === '' || plannedPayment === '' || !(Number(plannedPayment) > 0)) {
            setError(loan ? 'Please fill in the name, remaining balance and monthly payment.' : 'Please fill in the name, balance and planned monthly payment.');
            haptics.error();
            return;
        }
        if (!(day >= 1 && day <= 31)) {
            setError('The due day must be between 1 and 31.');
            haptics.error();
            return;
        }
        const payload = {
            kind,
            name: name.trim(),
            balance: Number(balance),
            apr: Number(apr || 0),
            plannedPayment: Number(plannedPayment),
            dueDay: day,
            ...(!loan && creditLimit ? { creditLimit: Number(creditLimit) } : {}),
            ...(!loan && minimumPayment ? { minimumPayment: Number(minimumPayment) } : {}),
            ...(loan && originalAmount ? { originalAmount: Number(originalAmount) } : {}),
            ...(loan && promoEndDate ? { promoEndDate } : {}),
        };
        if (cardToEdit) editCard(cardToEdit.id, payload);
        else addCard(payload);
        haptics.success();
        setIsClosing(true);
    };

    return (
        <ModalShell
            title={loan ? (cardToEdit ? 'Edit Loan' : 'Add Loan / Financing') : (cardToEdit ? 'Edit Credit Card' : 'Add Credit Card')}
            closing={isClosing}
            onRequestClose={() => setIsClosing(true)}
            onClosed={onClose}
        >
            <FormField label="Name">
                <TextField value={name} onChangeText={setName} autoCapitalize="words" placeholder={loan ? 'Car loan' : 'Visa'} />
            </FormField>
            <FormField label={loan ? 'Remaining Balance' : 'Current Balance'}>
                <NumberField value={balance} onChangeText={setBalance} placeholder="0.00" />
            </FormField>
            {loan && (
                <FormField label="Original Amount (Optional)">
                    <NumberField value={originalAmount} onChangeText={setOriginalAmount} placeholder="0.00" />
                </FormField>
            )}
            <FormField label="Interest Rate (APR %)">
                <NumberField value={apr} onChangeText={setApr} placeholder={loan ? '0' : '19.99'} />
            </FormField>
            {!loan && (
                <>
                    <FormField label="Credit Limit (Optional)">
                        <NumberField value={creditLimit} onChangeText={setCreditLimit} placeholder="0.00" />
                    </FormField>
                    <FormField label="Minimum Payment (Optional)">
                        <NumberField value={minimumPayment} onChangeText={setMinimumPayment} placeholder="0.00" />
                    </FormField>
                </>
            )}
            <FormField label={loan ? 'Monthly Payment' : 'Planned Monthly Payment'}>
                <NumberField value={plannedPayment} onChangeText={setPlannedPayment} placeholder="0.00" />
            </FormField>
            <FormField label="Payment Due Day (1–31)">
                <NumberField value={dueDay} onChangeText={setDueDay} decimal={false} placeholder="15" maxLength={2} />
            </FormField>
            {loan && (
                <FormField label="Promo Rate Ends (Optional)">
                    <DateField value={promoEndDate} onChange={setPromoEndDate} placeholder="No promotional rate" clearable />
                    <AppText variant="small" muted style={styles.hint}>
                        {"For offers like \"0% for 12 months\". Many charge all the deferred interest if anything is left when the promo ends, so Billy warns you if you're not on track."}
                    </AppText>
                </FormField>
            )}

            {preview && (
                <AppText variant="small" color={preview.months === null ? colors.loss : colors.textMuted} style={styles.preview}>
                    {preview.months === null
                        ? `${formatMoney(Number(plannedPayment))}/month doesn't cover the ~${formatMoney(preview.monthlyInterest)} of monthly interest, so this ${loan ? 'loan' : 'card'} would never be paid off.`
                        : preview.months === 0
                            ? 'Nothing owing.'
                            : `At ${formatMoney(Number(plannedPayment))}/month: paid off ${formatMonthYear(preview.payoffDate!)} (${preview.months} payments, ~${formatMoney(preview.totalInterest)} interest).`}
                </AppText>
            )}

            {!!error && <AppText bold color={colors.loss}>{error}</AppText>}

            <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setIsClosing(true)} />
                <Button title={cardToEdit ? 'Save Changes' : loan ? 'Add Loan' : 'Add Card'} variant="primary" onPress={handleSubmit} />
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
