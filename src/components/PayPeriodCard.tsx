import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getPayPeriodSummary } from '../utils/payPeriod';
import { formatMoney, formatShortDate, startOfToday, toISODate } from '../utils/dates';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';

function Line({ label, value, detail, color }: { label: string; value: string; detail?: string; color?: string }) {
    return (
        <View style={styles.line}>
            <AppText muted style={styles.flex}>
                {label}
                {!!detail && <AppText variant="small" muted>{`  ${detail}`}</AppText>}
            </AppText>
            <AppText bold color={color}>{value}</AppText>
        </View>
    );
}

// What's left of the current paycheck once the bills, card payments and budgets due before the next one
// are set aside.
export default function PayPeriodCard() {
    const { data } = useFinance();
    const { openActualPaySheet } = useEditor();
    const summary = getPayPeriodSummary(data, startOfToday());
    if (!summary) return null;

    const { period } = summary;
    const bills = summary.dueItems.filter(d => d.kind === 'bill');
    const paidBills = bills.filter(d => d.payment).length;
    const actualPaychecks = summary.incomeItems.filter(i => i.actual).length;
    const startPayDate = toISODate(period.start);
    const hasActualPay = summary.incomeItems.some(i => i.incomeId === period.income.id && i.payDate === startPayDate && i.actual);
    const positive = summary.free >= 0;

    return (
        <Card tone={positive ? undefined : 'loss'} style={styles.card}>
            <AppText variant="h3">Pay Period</AppText>
            <AppText variant="small" muted>
                {`${formatShortDate(period.start)} – ${formatShortDate(period.end)} · day ${period.dayNumber} of ${period.days} · next ${period.income.name} on ${formatShortDate(period.nextPayday)}`}
            </AppText>

            <AppText style={styles.bigNumber} color={positive ? colors.gain : colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                {formatMoney(summary.free)}
            </AppText>
            <AppText muted>
                {positive
                    ? `left to spend this pay period, about ${formatMoney(summary.perDay)} a day.`
                    : 'short this pay period after bills and budgets.'}
            </AppText>

            <View style={styles.breakdown}>
                <Line
                    label="Income"
                    value={`+${formatMoney(summary.incomeTotal)}`}
                    color={colors.gain}
                    detail={actualPaychecks === 0 ? undefined : actualPaychecks === summary.incomeItems.length ? 'actual' : `${actualPaychecks} of ${summary.incomeItems.length} actual`}
                />
                <Line
                    label="Bills"
                    value={`-${formatMoney(summary.billsTotal)}`}
                    detail={bills.length > 0 ? `${paidBills} of ${bills.length} paid` : undefined}
                />
                {summary.cardsTotal > 0 && <Line label={summary.dueItems.some(d => d.isLoan) ? 'Card & loan payments' : 'Card payments'} value={`-${formatMoney(summary.cardsTotal)}`} />}
                {summary.budgetsTotal > 0 && <Line label="Budgets" value={`-${formatMoney(summary.budgetsTotal)}`} detail="(Set aside)" />}
                {summary.extraPaymentsTotal > 0 && <Line label="Extra debt payments" value={`-${formatMoney(summary.extraPaymentsTotal)}`} />}
                {summary.savedTotal !== 0 && <Line label="Saved toward goals" value={`-${formatMoney(summary.savedTotal)}`} />}
            </View>

            {/* Paychecks that vary (hours, overtime) can be corrected to what actually came in. */}
            <View style={styles.actions}>
                <Button
                    title={hasActualPay ? 'Edit Actual Pay' : 'Enter Actual Pay'}
                    variant="secondary"
                    small
                    onPress={() => openActualPaySheet(period.income.id, startPayDate)}
                />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 4,
    },
    bigNumber: {
        fontSize: 36,
        lineHeight: 48,
        fontFamily: fonts.bold,
        marginTop: 6,
    },
    breakdown: {
        marginTop: 12,
        paddingTop: 10,
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: colors.tableBorder,
    },
    line: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
    },
    flex: {
        flex: 1,
    },
});
