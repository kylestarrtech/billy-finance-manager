import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, useAnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBlur from './Blur';
import AppText from './AppText';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { colors, radius } from '../../theme';

interface ModalShellProps {
    title: string;
    /** Set to true to play the closing animation; `onClosed` fires once it finishes. */
    closing: boolean;
    onRequestClose: () => void;
    onClosed: () => void;
    children: ReactNode;
}

/**
 * The `.modal-backdrop` / `.modal-content` pair. Rendered as an in-tree overlay (not RN's <Modal>) so the
 * backdrop can blur the app behind it on Android too, which can't blur across separate windows.
 */
export default function ModalShell({ title, closing, onRequestClose, onClosed, children }: ModalShellProps) {
    const insets = useSafeAreaInsets();
    const keyboardHeight = useKeyboardHeight();
    const progress = useAnimatedValue(0);
    const scrollRef = useRef<ScrollView>(null);
    const contentRef = useRef<View>(null);

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [progress]);

    const handleClosed = useEffectEvent(() => onClosed());

    useEffect(() => {
        if (!closing) return;
        Animated.timing(progress, {
            toValue: 0,
            duration: 140,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => handleClosed());
    }, [closing, progress]);

    // Android back button closes the modal instead of leaving the app.
    const handleBack = useEffectEvent(() => {
        onRequestClose();
        return true;
    });
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => handleBack());
        return () => sub.remove();
    }, []);

    // The keyboard can cover fields near the bottom of the form, so once it's up, scroll the focused
    // input to near the top of the modal.
    useEffect(() => {
        const sub = Keyboard.addListener('keyboardDidShow', () => {
            setTimeout(() => {
                const input = TextInput.State.currentlyFocusedInput();
                const content = contentRef.current;
                if (!input || !content) return;
                input.measureLayout(
                    content,
                    (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 48), animated: true }),
                    () => {}
                );
            }, 50);
        });
        return () => sub.remove();
    }, []);

    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'auto'}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
                <AppBlur intensity={25} style={StyleSheet.absoluteFill} />
                <Pressable
                    style={[StyleSheet.absoluteFill, styles.dim]}
                    onPress={onRequestClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                />
            </Animated.View>

            <View
                style={[
                    styles.center,
                    {
                        paddingTop: insets.top + 16,
                        paddingBottom: Math.max(insets.bottom, keyboardHeight) + 16,
                    },
                ]}
                pointerEvents="box-none"
            >
                <Animated.View style={[styles.content, { opacity: progress, transform: [{ scale }] }]}>
                    <ScrollView
                        ref={scrollRef}
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View ref={contentRef} collapsable={false}>
                            <AppText variant="h2" style={styles.title}>{title}</AppText>
                            {children}
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    dim: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    center: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    content: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '100%',
        backgroundColor: colors.bg,
        borderRadius: radius.card,
        boxShadow: '0px 10px 30px 0px rgba(0, 0, 0, 0.5)',
    },
    scroll: {
        flexGrow: 0,
    },
    scrollContent: {
        padding: 24,
    },
    title: {
        marginBottom: 16,
    },
});
