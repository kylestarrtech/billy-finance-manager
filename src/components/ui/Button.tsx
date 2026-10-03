import { type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, useAnimatedValue, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import AppText from './AppText';
import { colors, radius } from '../../theme';

export type ButtonVariant = 'standard' | 'primary' | 'secondary' | 'danger';

const variantStyles: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
    standard: { backgroundColor: colors.btnStandard, color: colors.textMain },
    primary: { backgroundColor: colors.gain, color: colors.textBright },
    secondary: { backgroundColor: colors.btnSecondary, color: colors.textBright },
    danger: { backgroundColor: colors.lossTranslucent, color: colors.textBright },
};

/**
 * Pressable that reproduces the `transform: scale(0.95)` :active feedback from the CSS.
 * Used directly for custom-shaped buttons (tabs, chips, FABs); `Button` builds on it.
 */
export function ScalePressable({
    onPress,
    disabled,
    style,
    pressedScale = 0.95,
    children,
    accessibilityLabel,
}: {
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    pressedScale?: number;
    children: ReactNode;
    accessibilityLabel?: string;
}) {
    const scale = useAnimatedValue(1);
    const animateTo = (toValue: number) =>
        Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => animateTo(pressedScale)}
            onPressOut={() => animateTo(1)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled: !!disabled }}
            hitSlop={4}
        >
            <Animated.View style={[style, { transform: [{ scale }] }, disabled && styles.disabled]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    small?: boolean;
}

export default function Button({ title, onPress, variant = 'standard', disabled, loading, style, textStyle, small }: ButtonProps) {
    const v = variantStyles[variant];
    return (
        <ScalePressable
            onPress={onPress}
            disabled={disabled || loading}
            accessibilityLabel={title}
            style={[styles.button, small && styles.small, { backgroundColor: v.backgroundColor }, style]}
        >
            {loading && <ActivityIndicator size="small" color={v.color} style={styles.spinner} />}
            <AppText variant={small ? 'small' : 'body'} bold color={v.color} style={textStyle} numberOfLines={1}>
                {title}
            </AppText>
        </ScalePressable>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.button,
    },
    small: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    spinner: {
        marginRight: 8,
    },
    disabled: {
        opacity: 0.6,
    },
});
