import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { colors } from '../../theme';
import { UTILIZATION_GOAL, UTILIZATION_IDEAL, utilizationBand, type UtilizationBand } from '../../utils/cards';

const AMBER = '#d9a33f';

export const BAND_COLORS: Record<UtilizationBand, string> = {
    excellent: colors.gain,
    good: colors.gain,
    fair: AMBER,
    high: colors.loss,
};

export const BAND_LABELS: Record<UtilizationBand, string> = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    high: 'High',
};

const MARKERS = [UTILIZATION_IDEAL, UTILIZATION_GOAL];

/**
 * Utilization on a 0–100% scale. The fill carries the severity colour and the track is a faint step of
 * the same colour, so the state reads across the whole bar; ticks mark the 10% and 30% guidelines.
 */
export default function UtilizationMeter({ ratio, compact }: { ratio: number; compact?: boolean }) {
    const color = BAND_COLORS[utilizationBand(ratio)];
    const fill = Math.max(0, Math.min(1, ratio));
    const height = compact ? 6 : 10;

    return (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
            <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: `${color}33` }]}>
                <View style={[styles.fill, { width: `${fill * 100}%`, borderRadius: height / 2, backgroundColor: color }]} />
                {MARKERS.map(marker => (
                    <View key={marker} style={[styles.tick, { left: `${marker * 100}%` }]} />
                ))}
            </View>
            {!compact && (
                <View style={styles.labels}>
                    {MARKERS.map(marker => (
                        <AppText key={marker} variant="caption" muted style={[styles.label, { left: `${marker * 100}%` }]}>
                            {`${Math.round(marker * 100)}%`}
                        </AppText>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
    },
    tick: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        backgroundColor: colors.bg,
    },
    labels: {
        height: 16,
        marginTop: 2,
    },
    label: {
        position: 'absolute',
        width: 40,
        marginLeft: -20,
        textAlign: 'center',
    },
});
