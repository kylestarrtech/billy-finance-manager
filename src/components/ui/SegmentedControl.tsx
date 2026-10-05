import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import AppBlur from './Blur';
import { ScalePressable } from './Button';
import { colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';

interface SegmentedControlProps<T extends string> {
    segments: readonly { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    /** Frosted glass + shadow, for use pinned over scrolling content. */
    floating?: boolean;
}

// Full-width switcher between sections of a screen, styled like the chip/tab buttons.
export default function SegmentedControl<T extends string>({ segments, value, onChange, floating }: SegmentedControlProps<T>) {
    return (
        <View style={[styles.container, floating && styles.floating]} accessibilityRole="tablist">
            {floating && (
                <>
                    <AppBlur intensity={40} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, styles.frostTint]} pointerEvents="none" />
                </>
            )}
            {segments.map(segment => {
                const active = segment.value === value;
                return (
                    <View key={segment.value} style={styles.cell}>
                        <ScalePressable
                            onPress={() => {
                                if (!active) haptics.selection();
                                onChange(segment.value);
                            }}
                            accessibilityLabel={segment.label}
                            style={[styles.segment, active && styles.active]}
                        >
                            <AppText variant="small" bold numberOfLines={1} color={active ? colors.textBright : colors.textMuted}>
                                {segment.label}
                            </AppText>
                        </ScalePressable>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 6,
        padding: 4,
        borderRadius: radius.button + 4,
        backgroundColor: colors.card,
    },
    floating: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0px 4px 15px 0px rgba(0, 0, 0, 0.6)',
    },
    frostTint: {
        backgroundColor: 'rgba(20, 20, 20, 0.45)',
    },
    cell: {
        flex: 1,
    },
    segment: {
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: radius.button,
    },
    active: {
        backgroundColor: colors.tabActive,
        boxShadow: '0px 0px 10px 0px rgba(255, 255, 255, 0.05)',
    },
});
