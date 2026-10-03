import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useIsFocused } from 'expo-router';
import { useTabChrome } from '../context/TabChromeContext';
import Background from './ui/Background';
import FadeInView from './ui/FadeInView';

// Room left under the last card so the floating + Bill / + Income buttons never cover it.
const FLOATING_ACTIONS_CLEARANCE = 150;

/**
 * Shared body for every tab: dotted background, a scroll view padded below the overlaid header and
 * above the native tab bar, and an invisible probe that measures where the tab bar starts.
 *
 * Screens opt out of the native automatic insets (`disableAutomaticContentInsets` in the tabs layout) so
 * content scrolls underneath the iOS 26 Liquid Glass tab bar, and both platforms are padded the same way.
 */
export default function TabScreen({ children }: { children: ReactNode }) {
    const { headerHeight, reportTabBarTop } = useTabChrome();
    const [tabBarInset, setTabBarInset] = useState(0);
    const probeRef = useRef<View>(null);
    const isFocused = useIsFocused();

    // The floating buttons live in the full-screen layout, so the tab bar's position is reported in
    // window coordinates. Only the visible tab reports; hidden ones may not be laid out.
    const measureTabBar = useCallback(() => {
        probeRef.current?.measureInWindow((_x, y, _w, h) => {
            if (h >= 0 && y > 0) reportTabBarTop(y);
        });
    }, [reportTabBarTop]);

    useEffect(() => {
        if (isFocused) measureTabBar();
    }, [isFocused, measureTabBar]);

    // react-native-screens' SafeAreaView knows about the native tab bar, so with only the bottom edge
    // enabled, an empty one is exactly as tall as the tab bar (plus the home indicator area).
    const handleProbeLayout = (e: LayoutChangeEvent) => {
        setTabBarInset(e.nativeEvent.layout.height);
        if (isFocused) measureTabBar();
    };

    return (
        <View style={styles.root} collapsable={false}>
            <Background />
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: headerHeight + 20, paddingBottom: tabBarInset + FLOATING_ACTIONS_CLEARANCE },
                ]}
                scrollIndicatorInsets={{ top: headerHeight, bottom: tabBarInset }}
                contentInsetAdjustmentBehavior="never"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <FadeInView style={styles.main} active={isFocused}>
                    {children}
                </FadeInView>
            </ScrollView>
            <View ref={probeRef} style={styles.probe} pointerEvents="none" collapsable={false} onLayout={handleProbeLayout}>
                <SafeAreaView edges={{ bottom: true }} style={styles.probeInset} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    main: {
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
    },
    probe: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    probeInset: {
        flex: 0,
    },
});
