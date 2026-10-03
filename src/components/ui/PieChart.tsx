import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import AppText from './AppText';
import { CHART_COLORS, colors } from '../../theme';

export interface PieDatum {
    name: string;
    value: number;
}

interface PieChartProps {
    title: string;
    data: PieDatum[];
    radius?: number;
}

const ANIMATION_MS = 700;
const POP_OUT = 6;

const polar = (cx: number, cy: number, r: number, angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
});

const slicePath = (cx: number, cy: number, r: number, start: number, end: number) => {
    const a = polar(cx, cy, r, start);
    const b = polar(cx, cy, r, end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y} Z`;
};

// Sweeps the slices in on mount, like recharts' default pie animation.
function useSweep() {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        let frame = 0;
        const start = Date.now();
        const tick = () => {
            const t = Math.min(1, (Date.now() - start) / ANIMATION_MS);
            setProgress(1 - Math.pow(1 - t, 3));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);
    return progress;
}

/**
 * Replacement for the recharts <PieChart>. There's no hover on a phone, so tapping a slice pops it out
 * and shows the tooltip (name + amount) underneath; tapping it again hides it.
 */
export default function PieChart({ title, data, radius = 80 }: PieChartProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const progress = useSweep();

    // Zero-value entries (e.g. one-time payments, which normalise to $0/mo) can't be drawn.
    const slices = useMemo(() => {
        const visible = data
            .map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }))
            .filter(d => d.value > 0);
        const total = visible.reduce((sum, d) => sum + d.value, 0);
        const result = [];
        let cursor = -Math.PI / 2;
        for (const d of visible) {
            const share = total > 0 ? d.value / total : 0;
            result.push({ ...d, start: cursor, sweep: share * Math.PI * 2, share });
            cursor += share * Math.PI * 2;
        }
        return result;
    }, [data]);

    const size = (radius + POP_OUT) * 2 + 4;
    const c = size / 2;
    const active = selected != null ? slices[selected] : null;

    return (
        <View style={styles.container}>
            <AppText variant="h4" center style={styles.title}>{title}</AppText>

            <View style={[styles.chart, { height: size }]}>
                <Svg width={size} height={size}>
                    {slices.length === 0 ? (
                        <Circle cx={c} cy={c} r={radius} fill="none" stroke={colors.border} strokeWidth={2} strokeDasharray="4 6" />
                    ) : (
                        slices.map((s, i) => {
                            const start = -Math.PI / 2 + (s.start + Math.PI / 2) * progress;
                            const sweep = s.sweep * progress;
                            const mid = start + sweep / 2;
                            const isSelected = i === selected;
                            const dx = isSelected ? Math.cos(mid) * POP_OUT : 0;
                            const dy = isSelected ? Math.sin(mid) * POP_OUT : 0;
                            const onPress = () => setSelected(isSelected ? null : i);

                            return (
                                <G key={`${s.name}-${i}`} transform={`translate(${dx},${dy})`} opacity={selected == null || isSelected ? 1 : 0.55}>
                                    {sweep >= Math.PI * 2 - 1e-6 ? (
                                        <Circle cx={c} cy={c} r={radius} fill={s.color} onPress={onPress} />
                                    ) : (
                                        <Path
                                            d={slicePath(c, c, radius, start, start + sweep)}
                                            fill={s.color}
                                            stroke={colors.bg}
                                            strokeWidth={1.5}
                                            strokeLinejoin="round"
                                            onPress={onPress}
                                        />
                                    )}
                                </G>
                            );
                        })
                    )}
                </Svg>
                {slices.length === 0 && (
                    <View style={[StyleSheet.absoluteFill, styles.emptyLabel]} pointerEvents="none">
                        <AppText variant="small" muted>No data</AppText>
                    </View>
                )}
            </View>

            <View style={styles.tooltip}>
                {active ? (
                    <View style={styles.tooltipBox}>
                        <View style={[styles.swatch, { backgroundColor: active.color }]} />
                        <AppText variant="small" numberOfLines={1} style={styles.tooltipText}>
                            <AppText variant="small" bold color={active.color}>{active.name}</AppText>
                            {`: $${active.value.toFixed(2)}  (${(active.share * 100).toFixed(1)}%)`}
                        </AppText>
                    </View>
                ) : (
                    slices.length > 0 && <AppText variant="caption" muted center>Tap a slice for details</AppText>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minWidth: 200,
        alignItems: 'center',
    },
    title: {
        marginVertical: 8,
    },
    chart: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLabel: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    tooltip: {
        minHeight: 36,
        marginTop: 4,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tooltipBox: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '100%',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#1e1e1e',
        borderWidth: 1,
        borderColor: colors.border,
    },
    swatch: {
        width: 10,
        height: 10,
        borderRadius: 2,
        marginRight: 8,
    },
    tooltipText: {
        flexShrink: 1,
    },
});
