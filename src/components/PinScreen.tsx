import { useEffect, useRef, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../context/FinanceContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { confirmAsync } from '../utils/dialogs';
import { haptics } from '../utils/haptics';
import { colors, fonts, radius } from '../theme';
import AppText from './ui/AppText';
import Button from './ui/Button';
import Card from './ui/Card';
import Logo from './ui/Logo';

const PIN_LENGTH = 6;

function PinInput({ inputRef, value, onChangeText, editable }: {
    inputRef?: RefObject<TextInput | null>;
    value: string;
    onChangeText: (value: string) => void;
    editable: boolean;
}) {
    return (
        <TextInput
            ref={inputRef}
            value={value}
            onChangeText={text => onChangeText(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            maxLength={PIN_LENGTH}
            secureTextEntry
            keyboardType="number-pad"
            keyboardAppearance="dark"
            textContentType="none"
            autoComplete="off"
            placeholder="••••••"
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.gain}
            editable={editable}
            style={styles.pinInput}
        />
    );
}

export default function PinScreen() {
    const { authStatus, unlockVault, setupVault, clearAllData, biometricEnabled, biometricSupport, unlockWithBiometrics } = useFinance();
    const insets = useSafeAreaInsets();
    const keyboardHeight = useKeyboardHeight();
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const pinRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const isSetup = authStatus === 'setup';
    const canUseBiometrics = !isSetup && biometricEnabled;
    const biometricLabel = biometricSupport?.label ?? 'Face ID';

    const focusPin = () => setTimeout(() => pinRef.current?.focus(), 350);

    const tryBiometrics = async () => {
        if (isBusy) return;
        setError('');
        setIsBusy(true);
        try {
            const result = await unlockWithBiometrics();
            if (result === 'ok') {
                haptics.success();
                return;
            }
            if (result === 'unavailable') {
                setError(`${biometricLabel} unlock was turned off (your ${biometricLabel} settings may have changed). Use your PIN, then turn it back on in Settings.`);
            }
            focusPin();
        } finally {
            setIsBusy(false);
        }
    };

    // Offer biometrics straight away when it's on; otherwise (or after cancelling) focus the PIN field.
    // `autoFocus` focuses the field but Android often won't raise the keyboard while the screen is still
    // mounting, so focus it once things have settled instead.
    useEffect(() => {
        if (canUseBiometrics) {
            const timer = setTimeout(tryBiometrics, 300);
            return () => clearTimeout(timer);
        }
        const timer = focusPin();
        return () => clearTimeout(timer);
        // Only on first show / when the mode changes, not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSetup, canUseBiometrics]);

    const handleSubmit = async (pinValue = pin, confirmValue = confirmPin) => {
        if (isBusy) return;
        setError('');

        if (pinValue.length !== PIN_LENGTH || !/^\d{6}$/.test(pinValue)) {
            setError('PIN must be exactly 6 digits.');
            haptics.error();
            return;
        }

        setIsBusy(true);
        try {
            if (isSetup) {
                if (pinValue !== confirmValue) {
                    setError('PINs do not match.');
                    haptics.error();
                    return;
                }
                await setupVault(pinValue);
                haptics.success();
            } else {
                const success = await unlockVault(pinValue);
                if (!success) {
                    setError('Incorrect PIN.');
                    haptics.error();
                    setPin('');
                } else {
                    haptics.success();
                }
            }
        } finally {
            setIsBusy(false);
        }
    };

    const handlePinChange = (value: string) => {
        setPin(value);
        if (value.length === PIN_LENGTH) {
            // The number pad has no return key on iOS, so move along automatically.
            if (isSetup) confirmRef.current?.focus();
            else handleSubmit(value);
        }
    };

    const handleConfirmChange = (value: string) => {
        setConfirmPin(value);
        if (value.length === PIN_LENGTH && pin.length === PIN_LENGTH) handleSubmit(pin, value);
    };

    const handleForgotPinReset = async () => {
        const confirmed = await confirmAsync(
            'Wipe My Data',
            'WARNING: This will permanently delete all encrypted data and remove your PIN. This cannot be undone.\n\nDo you want to continue?',
            { confirmText: 'Wipe Data', destructive: true }
        );

        if (!confirmed) {
            return;
        }

        await clearAllData();
    };

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
                styles.container,
                { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, keyboardHeight) + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
        >
            <Card style={styles.card}>
                <View style={styles.logo}>
                    <Logo size={48} />
                </View>
                <AppText variant="h2" center style={styles.title}>{isSetup ? 'Create a Secure PIN' : 'Enter Your PIN'}</AppText>
                {isSetup ? (
                    <AppText muted center style={styles.subtitle}>
                        This 6-digit PIN will encrypt your data locally.{'\n'}
                        <AppText muted bold>If you forget it, your data cannot be recovered.</AppText>
                    </AppText>
                ) : (
                    <AppText muted center style={styles.subtitle}>Unlock your secure local vault.</AppText>
                )}

                <View style={styles.form}>
                    <PinInput inputRef={pinRef} value={pin} onChangeText={handlePinChange} editable={!isBusy} />

                    {isSetup && (
                        <PinInput inputRef={confirmRef} value={confirmPin} onChangeText={handleConfirmChange} editable={!isBusy} />
                    )}

                    {!!error && <AppText bold center color={colors.loss}>{error}</AppText>}

                    <Button
                        title={isBusy ? (isSetup ? 'Securing Vault…' : 'Unlocking…') : (isSetup ? 'Set PIN' : 'Unlock Vault')}
                        onPress={() => handleSubmit()}
                        loading={isBusy}
                        style={styles.submit}
                        textStyle={styles.submitText}
                    />

                    {canUseBiometrics && (
                        <Button
                            title={`Unlock with ${biometricLabel}`}
                            onPress={tryBiometrics}
                            disabled={isBusy}
                        />
                    )}

                    {!isSetup && (
                        <Button
                            title="Wipe My Data (Forgot PIN)"
                            variant="danger"
                            onPress={handleForgotPinReset}
                            disabled={isBusy}
                            style={styles.wipe}
                        />
                    )}
                </View>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
        backgroundColor: '#22222230',
    },
    logo: {
        marginBottom: 24,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 28,
    },
    form: {
        width: '100%',
        maxWidth: 250,
        alignItems: 'stretch',
        gap: 16,
    },
    pinInput: {
        backgroundColor: colors.input,
        borderRadius: radius.input,
        color: colors.textMain,
        fontFamily: fonts.bold,
        fontSize: 24,
        letterSpacing: 12,
        textAlign: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    submit: {
        marginTop: 8,
        paddingVertical: 12,
    },
    submitText: {
        fontSize: 17,
    },
    wipe: {
        marginTop: 0,
    },
});
