import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { colors } from '../../theme';
import type { getFrequencyBreakdown } from '../../utils/financeHelpers';

type Breakdown = ReturnType<typeof getFrequencyBreakdown>;

const COLUMNS: { key: keyof Breakdown; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'biweekly', label: 'Bi-Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'semiannually', label: 'Semi-Annually' },
    { key: 'annually', label: 'Annually' },
];

// The desktop `.breakdown-table` is seven columns wide, which doesn't fit a phone (the web version
// just hid it on mobile). This wraps the same cells into a grid instead.
export default function BreakdownGrid({ breakdown }: { breakdown: Breakdown }) {
    return (
        <View style={styles.grid}>
            {COLUMNS.map(({ key, label }) => (
                <View key={key} style={styles.cell}>
                    <View style={styles.header}>
                        <AppText variant="caption" muted bold numberOfLines={1} adjustsFontSizeToFit>{label}</AppText>
                    </View>
                    <View style={styles.value}>
                        <AppText variant="small" numberOfLines={1} adjustsFontSizeToFit>${breakdown[key].toFixed(2)}</AppText>
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: colors.tableBorder,
    },
    cell: {
        width: '25%',
        flexGrow: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.tableBorder,
    },
    header: {
        backgroundColor: colors.tableBorder,
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    value: {
        paddingVertical: 6,
        paddingHorizontal: 6,
    },
});
