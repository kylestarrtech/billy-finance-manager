import { useEffect } from 'react';
import { Animated, Easing, useAnimatedValue, type ViewProps } from 'react-native';

// `viewFadeIn` from the CSS: fades in and rises 5px whenever the view becomes active. Native tabs keep
// every screen mounted, so this replays on focus; it's reset while inactive (and hidden) so the next
// focus starts from transparent instead of flashing the old frame first.
export default function FadeInView({ style, active = true, ...props }: ViewProps & { active?: boolean }) {
    const progress = useAnimatedValue(0);

    useEffect(() => {
        if (!active) {
            progress.setValue(0);
            return;
        }
        Animated.timing(progress, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [progress, active]);

    return (
        <Animated.View
            {...props}
            style={[
                style,
                {
                    opacity: progress,
                    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
                },
            ]}
        />
    );
}
