import { StyleSheet, View } from 'react-native';
import AppBlur from './ui/Blur';
import AppText from './ui/AppText';
import { ScalePressable } from './ui/Button';
import { colors, radius } from '../theme';
import { haptics } from '../utils/haptics';

interface FloatingActionsProps {
    onAddBill: () => void;
    onAddIncome: () => void;
    /** Distance from the bottom of the screen to the top of the tab bar. */
    bottomOffset: number;
}

// The mobile layout of `.header-actions`: pill buttons floating bottom-right (just above the tab bar),
// now with frosted glass.
export default function FloatingActions({ onAddBill, onAddIncome, bottomOffset }: FloatingActionsProps) {
    const actions = [
        { label: '+ Bill', onPress: onAddBill },
        { label: '+ Income', onPress: onAddIncome },
    ];

    return (
        <View style={[styles.container, { bottom: bottomOffset + 16, right: 20 }]} pointerEvents="box-none">
            {actions.map(({ label, onPress }) => (
                <ScalePressable
                    key={label}
                    onPress={() => {
                        haptics.tap();
                        onPress();
                    }}
                    accessibilityLabel={label}
                    style={styles.shadow}
                >
                    <View style={styles.pill}>
                        <AppBlur intensity={30} style={StyleSheet.absoluteFill} />
                        <AppText bold style={styles.label}>{label}</AppText>
                    </View>
                </ScalePressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignItems: 'flex-end',
        gap: 16,
    },
    shadow: {
        borderRadius: radius.pill,
        boxShadow: '0px 4px 15px 0px rgba(0, 0, 0, 0.6)',
    },
    pill: {
        borderRadius: radius.pill,
        overflow: 'hidden',
        backgroundColor: colors.btnStandard,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    label: {
        color: colors.textMain,
    },
});
