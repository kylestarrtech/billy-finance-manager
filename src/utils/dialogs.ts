import { Alert } from 'react-native';

// Promise-based replacements for window.confirm / window.alert.

interface ConfirmOptions {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}

export const confirmAsync = (title: string, message: string, options: ConfirmOptions = {}): Promise<boolean> =>
    new Promise(resolve => {
        Alert.alert(
            title,
            message,
            [
                { text: options.cancelText ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                    text: options.confirmText ?? 'Continue',
                    style: options.destructive ? 'destructive' : 'default',
                    onPress: () => resolve(true),
                },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        );
    });

export const showAlert = (title: string, message?: string) => Alert.alert(title, message);
