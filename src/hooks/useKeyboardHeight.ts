import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Android is edge-to-edge, so the window no longer resizes for the keyboard. Overlays that need to
// stay above it pad themselves by this height instead.
export function useKeyboardHeight() {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const show = Keyboard.addListener(showEvent, e => setHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    return height;
}
