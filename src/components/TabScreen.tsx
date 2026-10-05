import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useIsFocused } from 'expo-router';
import { useTabChrome, type FloatingAction } from '../context/TabChromeContext';
import Background from './ui/Background';
import { BlurTargetContext } from './ui/Blur';
import FadeInView from './ui/FadeInView';

// Room left under the last card so the floating + Bill / + Income buttons never cover it.
const FLOATING_ACTIONS_CLEARANCE = 200;
// Gap between the native tab bar and a pinned footer.
const FOOTER_GAP = 10;

interface TabScreenProps {
    children: ReactNode;
    /** Pinned just above the tab bar, within thumb reach (e.g. a section switcher). Frosted over the content. */
    footer?: ReactNode;
    /** Add buttons for this screen, shown floating bottom-right while it's focused. */
    actions?: FloatingAction[];
}

/**
 * Shared body for every tab: dotted background, a scroll view padded below the overlaid header and
 * above the native tab bar, an optional pinned footer, and an invisible probe that measures where the
 * tab bar starts.
 *
 * Screens opt out of the native automatic insets (`disableAutomaticContentInsets` in the tabs layout) so
 * content scrolls underneath the iOS 26 Liquid Glass tab bar, and both platforms are padded the same way.
 */
export default function TabScreen({ children, footer, actions }: TabScreenProps) {
    const { headerHeight, reportTabBarTop, setFloatingActions } = useTabChrome();
    const [tabBarInset, setTabBarInset] = useState(0);
    const [footerHeight, setFooterHeight] = useState(0);
    const probeRef = useRef<View>(null);
    const footerRef = useRef<View>(null);
    const contentRef = useRef<View>(null);
    const isFocused = useIsFocused();
    const hasFooter = !!footer;

    // The floating buttons live in the full-screen layout, so the top of this screen's bottom chrome (the
    // footer if there is one, otherwise the tab bar) is reported in window coordinates. Only the visible
    // tab reports; hidden ones may not be laid out.
    const measureBottomChrome = useCallback(() => {
        const target = hasFooter ? footerRef.current : probeRef.current;
        target?.measureInWindow((_x, y, _w, h) => {
            if (h >= 0 && y > 0) reportTabBarTop(y);
        });
    }, [hasFooter, reportTabBarTop]);

    useEffect(() => {
        if (isFocused) measureBottomChrome();
    }, [isFocused, measureBottomChrome, footerHeight, tabBarInset]);

    // The layout de-duplicates by label, so re-sending the same actions on every render is cheap.
    useEffect(() => {
        if (isFocused) setFloatingActions(actions ?? []);
    });

    // react-native-screens' SafeAreaView knows about the native tab bar, so with only the bottom edge
    // enabled, an empty one is exactly as tall as the tab bar (plus the home indicator area).
    const handleProbeLayout = (e: LayoutChangeEvent) => {
        setTabBarInset(e.nativeEvent.layout.height);
        if (isFocused) measureBottomChrome();
    };

    const footerSpace = hasFooter ? footerHeight + FOOTER_GAP : 0;

    return (
        <View style={styles.root} collapsable={false}>
            {/* The footer frosts this content on Android, so it must sit outside the blur target. */}
            <BlurTargetView ref={contentRef} style={StyleSheet.absoluteFill}>
                <Background />
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: headerHeight + 20, paddingBottom: tabBarInset + footerSpace + FLOATING_ACTIONS_CLEARANCE },
                    ]}
                    scrollIndicatorInsets={{ top: headerHeight, bottom: tabBarInset + footerSpace }}
                    contentInsetAdjustmentBehavior="never"
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <FadeInView style={styles.main} active={isFocused}>
                        {children}
                    </FadeInView>
                </ScrollView>
            </BlurTargetView>
            {hasFooter && (
                <BlurTargetContext.Provider value={contentRef}>
                    <View
                        ref={footerRef}
                        collapsable={false}
                        style={[styles.footer, { bottom: tabBarInset + FOOTER_GAP }]}
                        onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}
                    >
                        {footer}
                    </View>
                </BlurTargetContext.Provider>
            )}
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
    footer: {
        position: 'absolute',
        left: 16,
        right: 16,
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
