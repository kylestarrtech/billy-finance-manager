import { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useAnimatedValueXY, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { Accelerometer } from 'expo-sensors';
import Logo from './Logo';
import { colors } from '../../theme';

const GRID_SIZE = 15;
// The desktop version shifted the dots by up to ±7.5px following the mouse. On a phone the device
// tilt drives the same subtle parallax.
const PARALLAX_RANGE = 7.5;
const OVERSCAN = PARALLAX_RANGE * 2;
const SAMPLE_MS = 80;

function useTiltParallax() {
    const offset = useAnimatedValueXY({ x: 0, y: 0 });

    useEffect(() => {
        let subscription: { remove: () => void } | null = null;
        let cancelled = false;
        let smoothed: { x: number; y: number } | null = null;
        const baseline = { x: 0, y: 0 };
        const last = { x: 0, y: 0 };

        const start = async () => {
            const [available, reduceMotion] = await Promise.all([
                Accelerometer.isAvailableAsync().catch(() => false),
                AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
            ]);
            if (cancelled || !available || reduceMotion) return;

            Accelerometer.setUpdateInterval(SAMPLE_MS);
            subscription = Accelerometer.addListener(({ x, y }) => {
                if (!smoothed) {
                    smoothed = { x, y };
                    baseline.x = x;
                    baseline.y = y;
                    return;
                }
                // Low-pass filter to take the jitter out of the raw readings, and a slowly drifting
                // baseline so only changes in tilt move the grid (however the phone is being held).
                smoothed.x += (x - smoothed.x) * 0.2;
                smoothed.y += (y - smoothed.y) * 0.2;
                baseline.x += (smoothed.x - baseline.x) * 0.03;
                baseline.y += (smoothed.y - baseline.y) * 0.03;
                const clamp = (v: number) => Math.max(-1, Math.min(1, v * 3));
                const tx = clamp(smoothed.x - baseline.x) * PARALLAX_RANGE;
                const ty = clamp(smoothed.y - baseline.y) * PARALLAX_RANGE;

                // Skip imperceptible changes so blur views over the background aren't re-rendered constantly.
                if (Math.abs(tx - last.x) < 0.3 && Math.abs(ty - last.y) < 0.3) return;
                last.x = tx;
                last.y = ty;
                Animated.timing(offset, {
                    toValue: { x: tx, y: ty },
                    duration: SAMPLE_MS,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }).start();
            });
        };

        start();
        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, [offset]);

    return offset;
}

// The dotted grid (`radial-gradient(#232323 1px, transparent 1px)` at 15px) plus the near-invisible
// logo watermark from the original App.tsx.
export default function Background() {
    const { width, height } = useWindowDimensions();
    const offset = useTiltParallax();
    const watermarkSize = Math.max(width * 0.5, 300);

    return (
        <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
            <Animated.View
                style={{
                    position: 'absolute',
                    left: -OVERSCAN,
                    top: -OVERSCAN,
                    transform: offset.getTranslateTransform(),
                }}
            >
                <Svg width={width + OVERSCAN * 2} height={height + OVERSCAN * 2}>
                    <Defs>
                        <Pattern id="dot-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                            <Circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={1} fill={colors.dot} />
                        </Pattern>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#dot-grid)" />
                </Svg>
            </Animated.View>

            <View style={[StyleSheet.absoluteFill, styles.center]}>
                <View style={styles.watermark}>
                    <Logo size={watermarkSize} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.bg,
        overflow: 'hidden',
    },
    center: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    watermark: {
        opacity: 0.01,
    },
});
