import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { isLoan, useFinance } from '../context/FinanceContext';
import { useEditor } from '../context/EditorContext';
import { getSummaryStats, normalizeToMonthly } from '../utils/financeHelpers';
import { budgetMonthly } from '../utils/budgets';
import { pickPaycheckIncome } from '../utils/payPeriod';
import { getDueItems, getUpcomingDue, isIncomeActive } from '../utils/schedule';
import { endOfMonth, formatDate, formatMoney, startOfToday } from '../utils/dates';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import PieChart from './ui/PieChart';
import PayPeriodCard from './PayPeriodCard';
import UtilizationCard from './UtilizationCard';
import GoalsSummaryCard from './GoalsSummaryCard';

const WIDE_LAYOUT = 700;

export default function Dashboard() {
    const { data, bills, incomes, budgets, cards } = useFinance();
    const { openPaymentSheet } = useEditor();
    const { width } = useWindowDimensions();
    const isWide = width >= WIDE_LAYOUT;
    const today = startOfToday();

    const stats = getSummaryStats(data, today);
    const upcoming = getUpcomingDue(data, today, 5);
    const stillDueThisMonth = getDueItems(data, today, endOfMonth(today), today).filter(item => !item.payment);
    const stillDueTotal = stillDueThisMonth.reduce((sum, item) => sum + item.amount, 0);

    const isNetPositive = stats.leftoverCash >= 0;

    const incomeData = incomes.filter(inc => isIncomeActive(inc, today)).map(inc => ({
        name: inc.name,
        value: normalizeToMonthly(inc.amount, inc.frequency)
    }));

    const paycheckFrequency = pickPaycheckIncome(incomes, data.settings.payPeriodIncomeId, today)?.frequency;
    const expenseData = [
        ...bills.map(b => ({ name: b.name, value: normalizeToMonthly(b.cost, b.frequency) })),
        ...budgets.map(b => ({ name: `${b.name} (budget)`, value: budgetMonthly(b, paycheckFrequency) })),
        ...cards.filter(c => c.balance > 0).map(c => ({ name: `${c.name} (${isLoan(c) ? 'loan' : 'card'})`, value: c.plannedPayment })),
    ];

    const hasData = bills.length > 0 || incomes.length > 0 || budgets.length > 0 || cards.length > 0;

    const expenseParts = [
        stats.billsMonthly > 0 && `Bills ${formatMoney(stats.billsMonthly)}`,
        stats.budgetsMonthly > 0 && `Budgets ${formatMoney(stats.budgetsMonthly)}`,
        stats.cardsMonthly > 0 && `Debt ${formatMoney(stats.cardsMonthly)}`,
    ].filter(Boolean);

    const rowStyle = isWide ? styles.row : styles.column;

    return (
        <View style={styles.page}>

            {!hasData && (
                <Card style={styles.welcome}>
                    <AppText variant="h2" center style={styles.welcomeTitle}>Welcome to Billy Bill Manager!</AppText>
                    <AppText muted center>
                        To get started and activate your dashboard metrics, please add your first income source or bill using the + Add button.
                    </AppText>
                </Card>
            )}

            {hasData && (
                <>
                <PayPeriodCard />

                <GoalsSummaryCard />

                {/* Upcoming Expenses */}
                <Card>
                    <AppText variant="h2" style={styles.cardTitle}>Upcoming Expenses</AppText>
                    {upcoming.length === 0 ? (
                        <AppText muted>Nothing waiting to be paid.</AppText>
                    ) : (
                        <View style={styles.upcomingList}>
                            {upcoming.map(item => {
                                const overdue = item.date < today;
                                return (
                                    <Card key={item.key} style={[styles.upcomingCard, overdue && styles.overdueCard]}>
                                        <View style={styles.upcomingText}>
                                            <AppText variant="h4" style={styles.upcomingName}>{item.name}</AppText>
                                            <AppText bold>{formatMoney(item.amount)}</AppText>
                                            <AppText variant="small" muted={!overdue} color={overdue ? colors.loss : undefined} style={styles.upcomingDue}>
                                                {`${overdue ? 'Overdue' : 'Due'}: ${formatDate(item.date)}${item.kind === 'card' ? (item.isLoan ? ' · loan payment' : ' · card payment') : ''}`}
                                            </AppText>
                                        </View>
                                        <Button title="✓ Paid" small variant="secondary" onPress={() => openPaymentSheet(item)} />
                                    </Card>
                                );
                            })}
                        </View>
                    )}
                </Card>

                {/* Middle: Key Metrics */}
                <View style={rowStyle}>
                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Monthly Income</AppText>
                        <AppText style={styles.bigNumber} color={colors.gain} adjustsFontSizeToFit numberOfLines={1}>
                            {formatMoney(stats.totalMonthlyIncome)}
                        </AppText>
                        <AppText muted>
                            Weekly Avg: {formatMoney(stats.weeklyIncome)}
                        </AppText>
                        <AppText muted>
                            Daily Avg: {formatMoney(stats.dailyIncome)}
                        </AppText>
                    </Card>

                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Monthly Expenses</AppText>
                        <AppText style={styles.bigNumber} color={colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                            {formatMoney(stats.totalMonthlyExpenses)}
                        </AppText>
                        {expenseParts.length > 1 && (
                            <AppText variant="small" muted style={styles.parts}>{expenseParts.join(' · ')}</AppText>
                        )}
                        <AppText muted>
                            Weekly Avg: {formatMoney(stats.weeklyExpenses)}
                        </AppText>
                        <AppText muted>
                            Daily Avg: {formatMoney(stats.dailyExpenses)}
                        </AppText>
                        <AppText style={styles.stillDue}>
                            <AppText bold>{formatMoney(stillDueTotal)}</AppText>
                            <AppText muted>{` still due this month (${stillDueThisMonth.length} unpaid)`}</AppText>
                        </AppText>
                    </Card>

                    <Card tone={isNetPositive ? 'gain' : 'loss'} style={isWide && styles.flexCell}>
                        <AppText variant="h3">Remaining</AppText>
                        <AppText style={styles.bigNumber} color={isNetPositive ? colors.gain : colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                            {isNetPositive ? '+' : '-'}{formatMoney(Math.abs(stats.leftoverCash))}
                        </AppText>
                        <AppText muted>
                            {isNetPositive ? 'You are cash-positive this month.' : 'You are spending more than you earn!'}
                        </AppText>
                    </Card>
                </View>

                <UtilizationCard />

                {/* Bottom: Charts & Recommendations */}
                <View style={rowStyle}>

                    {/* 50/30/20 Split Recommendation */}
                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Savings Recommendation (50/30/20)</AppText>
                        <AppText muted style={styles.recommendationIntro}>Based on your total normalized monthly income.</AppText>

                        <View style={styles.recommendation}>
                            <AppText variant="h4" style={styles.recommendationTitle}>Needs (50%)</AppText>
                            <AppText muted>Recommended: {formatMoney(stats.totalMonthlyIncome * 0.50)}</AppText>
                            <AppText muted>Actual Essential: {formatMoney(stats.essentialExpenses)}</AppText>
                        </View>

                        <View style={styles.recommendation}>
                            <AppText variant="h4" style={styles.recommendationTitle}>Wants (30%)</AppText>
                            <AppText muted>Recommended Limit: {formatMoney(stats.totalMonthlyIncome * 0.30)}</AppText>
                            <AppText muted>Actual Non-essential: {formatMoney(stats.nonEssentialExpenses)}</AppText>
                        </View>

                        <View>
                            <AppText variant="h4" style={styles.recommendationTitle}>Savings & Debt (20%)</AppText>
                            <AppText muted>Recommended Goal: {formatMoney(stats.totalMonthlyIncome * 0.20)}</AppText>
                            <AppText muted>Actual Leftover: {formatMoney(stats.leftoverCash)}</AppText>
                            {stats.cardsMonthly > 0 && (
                                <AppText muted>Debt Payments: {formatMoney(stats.cardsMonthly)}</AppText>
                            )}
                        </View>
                    </Card>

                    {/* Pie Charts */}
                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Cash Flow Breakdown</AppText>
                        <View style={styles.charts}>
                            <PieChart title="Income" data={incomeData} />
                            <PieChart title="Expenses" data={expenseData} />
                        </View>
                    </Card>

                </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        gap: 24,
    },
    welcome: {
        borderWidth: 1,
        borderColor: colors.gain,
        backgroundColor: '#22222280',
    },
    welcomeTitle: {
        marginBottom: 16,
    },
    cardTitle: {
        marginBottom: 12,
    },
    upcomingList: {
        gap: 12,
    },
    upcomingCard: {
        padding: 16,
        backgroundColor: colors.cardInner,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    overdueCard: {
        borderWidth: 1,
        borderColor: 'rgba(229, 57, 53, 0.4)',
    },
    upcomingText: {
        flex: 1,
    },
    upcomingName: {
        marginBottom: 6,
    },
    upcomingDue: {
        marginTop: 6,
    },
    row: {
        flexDirection: 'row',
        gap: 20,
    },
    column: {
        gap: 20,
    },
    flexCell: {
        flex: 1,
    },
    bigNumber: {
        fontSize: 36,
        lineHeight: 48,
        fontFamily: fonts.bold,
        marginVertical: 6,
    },
    parts: {
        marginBottom: 6,
    },
    stillDue: {
        marginTop: 10,
    },
    recommendationIntro: {
        marginTop: 4,
        marginBottom: 20,
    },
    recommendation: {
        marginBottom: 16,
    },
    recommendationTitle: {
        marginBottom: 4,
    },
    charts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
});
