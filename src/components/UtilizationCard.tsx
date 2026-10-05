import { StyleSheet, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { getUtilizationSummary, utilizationBand, UTILIZATION_GOAL } from '../utils/cards';
import { formatMoney } from '../utils/dates';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Card from './ui/Card';
import UtilizationMeter, { BAND_COLORS, BAND_LABELS } from './ui/UtilizationMeter';

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

// Dashboard summary of credit card utilization: where it is now, where it should be, and what it takes
// to get there.
export default function UtilizationCard() {
    const { cards } = useFinance();
    const summary = getUtilizationSummary(cards);

    if (!summary) {
        if (!cards.some(c => c.balance > 0)) return null;
        return (
            <Card>
                <AppText variant="h3">Credit Utilization</AppText>
                <AppText muted style={styles.gapTop}>
                    Add a credit limit to your cards (Bills → Cards → Edit) to see your utilization.
                </AppText>
            </Card>
        );
    }

    const band = utilizationBand(summary.ratio);
    const color = BAND_COLORS[band];
    const underGoal = summary.ratio < UTILIZATION_GOAL;
    const showPerCard = summary.cards.length > 1;

    return (
        <Card tone={band === 'high' ? 'loss' : undefined} style={styles.card}>
            <View style={styles.titleRow}>
                <AppText variant="h3" style={styles.flex}>Credit Utilization</AppText>
                <View style={[styles.pill, { borderColor: color }]}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <AppText variant="small" bold>{BAND_LABELS[band]}</AppText>
                </View>
            </View>

            <AppText style={styles.bigNumber} color={color}>{percent(summary.ratio)}</AppText>
            <AppText muted>{`${formatMoney(summary.totalBalance)} of ${formatMoney(summary.totalLimit)} in total credit`}</AppText>

            <View style={styles.meter}>
                <UtilizationMeter ratio={summary.ratio} />
            </View>

            <View style={styles.section}>
                <AppText>
                    <AppText bold>Should be: </AppText>
                    <AppText muted>under 30%, and under 10% is best.</AppText>
                </AppText>
                {underGoal ? (
                    <AppText color={colors.gain}>
                        {summary.payToIdeal > 0
                            ? `Under 30%. Paying down ${formatMoney(summary.payToIdeal)} more gets you under 10%.`
                            : 'Under 10%: Great work!'}
                    </AppText>
                ) : (
                    <>
                        <AppText>{`Pay down ${formatMoney(summary.payToGoal)} to get under 30%.`}</AppText>
                        <AppText muted>{`Pay down ${formatMoney(summary.payToIdeal)} to get under 10%.`}</AppText>
                    </>
                )}
                {summary.afterPlannedRatio < summary.ratio && (
                    <AppText muted>{`After this month's planned payments: about ${percent(summary.afterPlannedRatio)}.`}</AppText>
                )}
            </View>

            {showPerCard && (
                <View style={styles.perCard}>
                    {summary.cards.map(({ card, ratio, payToGoal }) => (
                        <View key={card.id} style={styles.cardRow}>
                            <View style={styles.cardRowText}>
                                <AppText style={styles.flex} numberOfLines={1}>{card.name}</AppText>
                                <AppText bold>{percent(ratio)}</AppText>
                            </View>
                            <UtilizationMeter ratio={ratio} compact />
                            {payToGoal > 0 && (
                                <AppText variant="caption" muted>{`${formatMoney(payToGoal)} over 30% on this card`}</AppText>
                            )}
                        </View>
                    ))}
                </View>
            )}

            <AppText variant="caption" muted style={styles.footnote}>
                {'Estimated from your current balances. Card issuers usually report your statement balance, so paying before the statement closes lowers what gets reported.'}
                {summary.uncounted.length > 0 && ` Not counted (no credit limit): ${summary.uncounted.map(c => c.name).join(', ')}.`}
            </AppText>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 4,
    },
    gapTop: {
        marginTop: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    flex: {
        flex: 1,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 50,
        borderWidth: 1,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    bigNumber: {
        fontSize: 48,
        lineHeight: 60,
        fontFamily: fonts.bold,
        marginTop: 4,
    },
    meter: {
        marginTop: 12,
    },
    section: {
        marginTop: 8,
        gap: 4,
    },
    perCard: {
        marginTop: 12,
        paddingTop: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: colors.tableBorder,
    },
    cardRow: {
        gap: 4,
    },
    cardRowText: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    footnote: {
        marginTop: 12,
    },
});
