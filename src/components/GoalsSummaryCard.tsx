import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { getSavingsCapacity, planGoals } from '../utils/goals';
import { formatMoney, formatMonthYear, formatShortDate, startOfToday } from '../utils/dates';
import { colors } from '../theme';
import AppText from './ui/AppText';
import Card from './ui/Card';
import ProgressBar from './ui/ProgressBar';

// Dashboard glance at savings goals: progress, ETA, and what to set aside this paycheck.
export default function GoalsSummaryCard() {
    const { data } = useFinance();
    if (data.goals.length === 0) return null;

    const today = startOfToday();
    const capacity = getSavingsCapacity(data, today);
    const plans = planGoals(data, capacity, today);

    return (
        <Card style={styles.card}>
            <AppText variant="h3">Savings Goals</AppText>
            {capacity.thisPeriod && capacity.thisPeriod.suggested > 0 && (
                <AppText muted>
                    {`Set aside ${formatMoney(capacity.thisPeriod.suggested)} before ${formatShortDate(capacity.thisPeriod.nextPayday)}.`}
                </AppText>
            )}
            {plans.map(plan => (
                <View key={plan.goal.id} style={styles.goal}>
                    <View style={styles.row}>
                        <AppText bold style={styles.flex} numberOfLines={1}>{plan.goal.name}</AppText>
                        <AppText variant="small" muted>{`${formatMoney(plan.saved)} / ${formatMoney(plan.total)}`}</AppText>
                    </View>
                    <ProgressBar ratio={plan.progress} warnAt={2} />
                    <AppText variant="small" color={plan.target && !plan.target.onTrack && !plan.done ? colors.loss : colors.textMuted}>
                        {plan.done
                            ? '✓ Fully saved'
                            : plan.projectedDate
                                ? `Ready by ${formatMonthYear(plan.projectedDate)}${plan.target && !plan.target.onTrack ? ` (after your ${formatShortDate(plan.target.date)} target)` : ''}`
                                : 'Nothing safe to set aside yet'}
                    </AppText>
                </View>
            ))}
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 8,
    },
    goal: {
        gap: 4,
        marginTop: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    flex: {
        flex: 1,
    },
});
