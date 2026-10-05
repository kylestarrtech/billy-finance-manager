import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

const AMBER = '#d9a33f';

/** Spending/utilization bar: green, amber from `warnAt`, red once over 100%. */
export default function ProgressBar({ ratio, warnAt = 0.8 }: { ratio: number; warnAt?: number }) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 1));
    const color = ratio > 1 ? colors.loss : ratio >= warnAt ? AMBER : colors.gain;
    return (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
            <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.tableBorder,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
});
