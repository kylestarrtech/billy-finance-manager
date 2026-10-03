import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBlur from './ui/Blur';
import AppText from './ui/AppText';
import Logo from './ui/Logo';
import { colors } from '../theme';

// `.app-header`: logo and title, pinned to the top with a frosted background. Navigation lives in the
// native tab bar at the bottom of the screen.
export default function AppHeader({ onLayout }: { onLayout: (e: LayoutChangeEvent) => void }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]} onLayout={onLayout} pointerEvents="none">
            <AppBlur intensity={40} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.tint]} />

            <View style={styles.titleRow}>
                <Logo size={34} />
                <AppText variant="h1" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
                    Billy: Bill Management
                </AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        overflow: 'hidden',
    },
    tint: {
        backgroundColor: 'rgba(20, 20, 20, 0.55)',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        flexShrink: 1,
    },
});
