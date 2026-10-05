import { StyleSheet, View } from 'react-native';
import { useFinance, type SavingsGoal } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getSavingsCapacity, planGoals, SAVINGS_CUSHION, type SavingsCapacity } from '../utils/goals';
import { formatDate, formatMoney, formatShortDate, startOfToday } from '../utils/dates';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import ProgressBar from './ui/ProgressBar';

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
    return (
        <View style={styles.row}>
            <AppText muted={!strong} bold={strong} style={styles.flex}>{label}</AppText>
            <AppText bold={strong} color={color}>{value}</AppText>
        </View>
    );
}

/** How Billy works out the safe amount, so the number is never a black box. */
export function SafeToSaveCard({ capacity }: { capacity: SavingsCapacity }) {
    const per = capacity.paycheckName ? 'paycheck' : 'month';
    const hasSurplus = capacity.monthlySurplus > 0;
    return (
        <Card style={styles.card}>
            <AppText variant="h3">Safe to Save</AppText>
            <AppText style={styles.bigNumber} color={hasSurplus ? colors.gain : colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                {formatMoney(capacity.perPaycheck)}
            </AppText>
            <AppText muted>
                {hasSurplus
                    ? `per ${per}${capacity.paycheckName ? ` (${capacity.paycheckName}, ${capacity.paycheckFrequency})` : ''}, ${formatMoney(capacity.safeMonthly)} a month.`
                    : 'Your bills, budgets and debt payments use up your income, so there\'s nothing safe to save yet.'}
            </AppText>

            <View style={styles.breakdown}>
                <Row label="Income" value={`+${formatMoney(capacity.monthlyIncome)}`} color={colors.gain} />
                <Row label="Bills, budgets & debt payments" value={`-${formatMoney(capacity.monthlyCommitted)}`} />
                <Row label="Left over" value={formatMoney(capacity.monthlySurplus)} />
                <Row label={`Cushion for surprises (${Math.round(SAVINGS_CUSHION * 100)}%)`} value={`-${formatMoney(capacity.cushion)}`} />
                <Row label="Safe to save" value={`${formatMoney(capacity.safeMonthly)} / month`} strong />
            </View>
            <AppText variant="caption" muted>Monthly averages, using everything you&apos;ve entered.</AppText>

            {capacity.thisPeriod && (
                <AppText style={styles.gapTop}>
                    <AppText bold>This paycheck: </AppText>
                    <AppText muted>
                        {capacity.thisPeriod.suggested > 0
                            ? `set aside ${formatMoney(capacity.thisPeriod.suggested)} before ${formatShortDate(capacity.thisPeriod.nextPayday)}.`
                            : capacity.thisPeriod.alreadySaved > 0
                                ? `you've already saved ${formatMoney(capacity.thisPeriod.alreadySaved)}. That's this paycheck's share.`
                                : 'this pay period is tight after what\'s due, so skip saving until the next paycheck.'}
                    </AppText>
                </AppText>
            )}

            {capacity.highInterestCards.map(card => (
                <AppText key={card.id} variant="small" color={colors.loss} style={styles.gapTop}>
                    {`${card.name} has ${formatMoney(card.balance)} at ${card.apr}% APR. That costs more than savings earn, so consider putting extra toward it before a big purchase.`}
                </AppText>
            ))}
        </Card>
    );
}

export default function Goals() {
    const { data, goals, deleteGoal } = useFinance();
    const { openGoalEditor, openContributionEditor } = useEditor();
    const today = startOfToday();
    const capacity = getSavingsCapacity(data, today);
    const plans = planGoals(data, capacity, today);
    const per = capacity.paycheckName ? 'paycheck' : 'month';
    const suggestedNow = (perPaycheck: number) =>
        capacity.thisPeriod ? Math.min(perPaycheck, capacity.thisPeriod.suggested) : perPaycheck;

    const handleDelete = async (goal: SavingsGoal) => {
        haptics.warning();
        if (await confirmAsync('Delete Goal', `Delete "${goal.name}" and its savings history? This cannot be undone.`, { confirmText: 'Delete', destructive: true })) {
            deleteGoal(goal.id);
        }
    };

    return (
        <View style={styles.list}>
            <AppText variant="h2">Savings Goals ({goals.length})</AppText>
            {goals.length > 1 && (
                <AppText variant="caption" muted>
                    Goals with a target date are prioritized.
                </AppText>
            )}

            <SafeToSaveCard capacity={capacity} />

            {goals.length === 0 && (
                <Card>
                    <AppText bold>No goals yet</AppText>
                    <AppText muted style={styles.gapTop}>
                        {'Add something you\'re saving for. Billy checks your bills, budgets, cards and loans, works out what\'s safe to put aside each paycheck, and tells you when you\'ll have it.'}
                    </AppText>
                </Card>
            )}

            {plans.map(plan => (
                <Card key={plan.goal.id} tone={plan.done ? 'gain' : undefined} style={styles.card}>
                    <AppText variant="h3">{plan.goal.name}</AppText>
                    <AppText muted>
                        {plan.goal.taxRate
                            ? `${formatMoney(plan.goal.price)} + ${plan.goal.taxRate}% tax = ${formatMoney(plan.total)}`
                            : formatMoney(plan.total)}
                    </AppText>

                    <View style={styles.progress}>
                        <ProgressBar ratio={plan.progress} warnAt={2} />
                        <AppText variant="small" muted>{`${formatMoney(plan.saved)} saved · ${formatMoney(plan.remaining)} to go (${Math.round(plan.progress * 100)}%)`}</AppText>
                    </View>

                    {plan.done ? (
                        <AppText bold color={colors.gain}>✓ Fully saved. Enjoy it!</AppText>
                    ) : plan.perPaycheck > 0 ? (
                        <AppText>
                            <AppText bold>{`Set aside ${formatMoney(plan.perPaycheck)} per ${per}`}</AppText>
                            <AppText muted>
                                {plan.projectedDate
                                    ? `\nReady by ${formatDate(plan.projectedDate)} (${plan.paychecksNeeded} ${plan.paychecksNeeded === 1 ? per : `${per}s`}).`
                                    : '. At that pace it takes over 10 years.'}
                            </AppText>
                        </AppText>
                    ) : (
                        <AppText muted>Nothing is left for this goal right now. Goals higher in the list, or a tight budget, use up what&apos;s safe to save.</AppText>
                    )}

                    {plan.target && !plan.done && (
                        plan.target.onTrack ? (
                            <AppText color={colors.gain}>{`On track for ${formatDate(plan.target.date)}.`}</AppText>
                        ) : (
                            <AppText color={colors.loss}>
                                {plan.target.paychecksLeft === 0
                                    ? `The target date ${formatDate(plan.target.date)} has passed or comes before your next payday.`
                                    : `To have it by ${formatDate(plan.target.date)} you'd need ${formatMoney(plan.target.neededPerPaycheck)} per ${per}, more than is safe. ${plan.projectedDate ? `${formatDate(plan.projectedDate)} is realistic.` : ''}`}
                            </AppText>
                        )
                    )}

                    {!!plan.goal.note && <AppText variant="small" italic>{`Note: ${plan.goal.note}`}</AppText>}

                    <View style={styles.actions}>
                        {!plan.done && (
                            <Button title="+ Saved" variant="primary" small onPress={() => openContributionEditor(plan.goal.id, suggestedNow(plan.perPaycheck))} />
                        )}
                        <Button title="Edit" variant="secondary" small onPress={() => openGoalEditor(plan.goal)} />
                        <Button title="Delete" variant="danger" small onPress={() => handleDelete(plan.goal)} />
                    </View>
                </Card>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        gap: 16,
    },
    card: {
        gap: 8,
    },
    flex: {
        flex: 1,
    },
    bigNumber: {
        fontSize: 36,
        lineHeight: 48,
        fontFamily: fonts.bold,
    },
    breakdown: {
        marginTop: 8,
        paddingTop: 10,
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: colors.tableBorder,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    gapTop: {
        marginTop: 6,
    },
    progress: {
        gap: 4,
        marginVertical: 4,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
});
