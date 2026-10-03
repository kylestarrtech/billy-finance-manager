import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { File } from 'expo-file-system';
import { useFinance } from '../context/FinanceContext';
import { getSummaryStats, getUpcomingBills, normalizeToMonthly } from '../utils/financeHelpers';
import { formatDate } from '../utils/dates';
import { confirmAsync, showAlert } from '../utils/dialogs';
import { colors, fonts } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import PieChart from './ui/PieChart';

const WIDE_LAYOUT = 700;

export default function Dashboard() {
    const { bills, incomes, exportData, importData, clearAllData } = useFinance();
    const { width } = useWindowDimensions();
    const isWide = width >= WIDE_LAYOUT;

    const handleImportFile = async () => {
        // expo-file-system's own picker grants read access to the chosen file (Expo Go's sandbox
        // refuses to read files handed over by other modules). Cloud providers often report JSON as
        // octet-stream, so any file is allowed and validated when parsed.
        const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
        if (picked.canceled) return;

        const confirmed = await confirmAsync(
            'Import Data',
            'WARNING: Importing data will OVERWRITE all your current bills and income data. Do you wish to proceed?',
            { confirmText: 'Overwrite', destructive: true }
        );
        if (!confirmed) return;

        try {
            importData(await picked.result.text());
        } catch (error) {
            console.warn('Import read failed:', error);
            showAlert('Import Failed', 'Could not read the selected file.');
        }
    };

    const stats = getSummaryStats(bills, incomes);
    const upcoming = getUpcomingBills(bills);

    const isNetPositive = stats.leftoverCash >= 0;

    const incomeData = incomes.map(inc => ({
        name: inc.name,
        value: normalizeToMonthly(inc.amount, inc.frequency)
    }));

    const expenseData = bills.map(b => ({
        name: b.name,
        value: normalizeToMonthly(b.cost, b.frequency)
    }));

    const hasData = bills.length > 0 || incomes.length > 0;

    const handleDeleteAllData = async () => {
        const confirmed = await confirmAsync(
            'Delete All Data',
            'WARNING: This will permanently delete all bills, income, and your PIN-protected vault data. This cannot be undone.\n\nDo you want to continue?',
            { confirmText: 'Delete Everything', destructive: true }
        );

        if (!confirmed) return;

        await clearAllData();
    };

    const rowStyle = isWide ? styles.row : styles.column;

    return (
        <View style={styles.page}>

            {!hasData && (
                <Card style={styles.welcome}>
                    <AppText variant="h2" center style={styles.welcomeTitle}>Welcome to Billy Bill Manager!</AppText>
                    <AppText muted center>
                        To get started and activate your dashboard metrics, please add your first income source or bill using the + Bill and + Income buttons.
                    </AppText>
                </Card>
            )}

            {hasData && (
                <>
                {/* Top: Upcoming Expenses */}
                <Card>
                    <AppText variant="h2" style={styles.cardTitle}>Upcoming Expenses</AppText>
                    {upcoming.length === 0 ? (
                        <AppText muted>No upcoming bills.</AppText>
                    ) : (
                        <View style={styles.upcomingList}>
                            {upcoming.map((u) => (
                                <Card key={u.bill.id} style={styles.upcomingCard}>
                                    <AppText variant="h4" style={styles.upcomingName}>{u.bill.name}</AppText>
                                    <AppText bold>${u.bill.cost.toFixed(2)}</AppText>
                                    <AppText variant="small" muted style={styles.upcomingDue}>
                                        Due: {formatDate(u.nextDate)}
                                    </AppText>
                                </Card>
                            ))}
                        </View>
                    )}
                </Card>

                {/* Middle: Key Metrics */}
                <View style={rowStyle}>
                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Monthly Income</AppText>
                        <AppText style={styles.bigNumber} color={colors.gain} adjustsFontSizeToFit numberOfLines={1}>
                            ${stats.totalMonthlyIncome.toFixed(2)}
                        </AppText>
                        <AppText muted>
                            Weekly Avg: ${stats.weeklyIncome.toFixed(2)}
                        </AppText>
                        <AppText muted>
                            Daily Avg: ${stats.dailyIncome.toFixed(2)}
                        </AppText>
                    </Card>

                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Monthly Expenses</AppText>
                        <AppText style={styles.bigNumber} color={colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                            ${stats.totalMonthlyExpenses.toFixed(2)}
                        </AppText>
                        <AppText muted>
                            Weekly Avg: ${stats.weeklyExpenses.toFixed(2)}
                        </AppText>
                        <AppText muted>
                            Daily Avg: ${stats.dailyExpenses.toFixed(2)}
                        </AppText>
                    </Card>

                    <Card tone={isNetPositive ? 'gain' : 'loss'} style={isWide && styles.flexCell}>
                        <AppText variant="h3">Remaining</AppText>
                        <AppText style={styles.bigNumber} color={isNetPositive ? colors.gain : colors.loss} adjustsFontSizeToFit numberOfLines={1}>
                            {isNetPositive ? '+' : '-'}${Math.abs(stats.leftoverCash).toFixed(2)}
                        </AppText>
                        <AppText muted>
                            {isNetPositive ? 'You are cash-positive this month.' : 'You are spending more than you earn!'}
                        </AppText>
                    </Card>
                </View>

                {/* Bottom: Charts & Recommendations */}
                <View style={rowStyle}>

                    {/* 50/30/20 Split Recommendation */}
                    <Card style={isWide && styles.flexCell}>
                        <AppText variant="h3">Savings Recommendation (50/30/20)</AppText>
                        <AppText muted style={styles.recommendationIntro}>Based on your total normalized monthly income.</AppText>

                        <View style={styles.recommendation}>
                            <AppText variant="h4" style={styles.recommendationTitle}>Needs (50%)</AppText>
                            <AppText muted>Recommended: ${(stats.totalMonthlyIncome * 0.50).toFixed(2)}</AppText>
                            <AppText muted>Actual Essential: ${(stats.essentialExpenses).toFixed(2)}</AppText>
                        </View>

                        <View style={styles.recommendation}>
                            <AppText variant="h4" style={styles.recommendationTitle}>Wants (30%)</AppText>
                            <AppText muted>Recommended Limit: ${(stats.totalMonthlyIncome * 0.30).toFixed(2)}</AppText>
                            <AppText muted>Actual Non-essential: ${(stats.totalMonthlyExpenses - stats.essentialExpenses).toFixed(2)}</AppText>
                        </View>

                        <View>
                            <AppText variant="h4" style={styles.recommendationTitle}>Savings/Investing (20%)</AppText>
                            <AppText muted>Recommended Goal: ${(stats.totalMonthlyIncome * 0.20).toFixed(2)}</AppText>
                            <AppText muted>Actual Leftover: ${(stats.leftoverCash).toFixed(2)}</AppText>
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

            <View style={styles.dataActions}>
                <Button title="Import Data from JSON" onPress={handleImportFile} />
                <Button title="Export Data to JSON" onPress={exportData} />
            </View>

            <View style={styles.dangerZone}>
                <Button title="Delete All Data" variant="danger" onPress={handleDeleteAllData} />
            </View>

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
    dataActions: {
        paddingTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    dangerZone: {
        alignItems: 'center',
    },
});
