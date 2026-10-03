import { createContext, useContext, type RefObject } from 'react';
import { Platform, type StyleProp, type View, type ViewStyle } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';

// On Android, expo-blur can only blur content inside a <BlurTargetView>. The app wraps its scrollable
// content in one and shares the ref here so the header, floating buttons and modals can blur it.
// iOS ignores the target and blurs whatever is behind the view natively.
export const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

interface AppBlurProps {
    intensity?: number;
    tint?: BlurTint;
    style?: StyleProp<ViewStyle>;
}

export default function AppBlur({ intensity = 30, tint = 'dark', style }: AppBlurProps) {
    const target = useContext(BlurTargetContext);
    const useNativeAndroidBlur = Platform.OS === 'android' && target != null;

    return (
        <BlurView
            intensity={intensity}
            tint={tint}
            blurTarget={target ?? undefined}
            // Falls back to a translucent view below Android 12, where RenderEffect isn't available.
            blurMethod={useNativeAndroidBlur ? 'dimezisBlurViewSdk31Plus' : 'none'}
            style={style}
            pointerEvents="none"
        />
    );
}
