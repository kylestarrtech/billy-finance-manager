import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { deserializeVaultKey, serializeVaultKey, type VaultKey } from './cryptoWrapper';

// Biometric unlock keeps a copy of the vault's derived key in the iOS Keychain / Android Keystore, in an
// entry the OS only releases after a successful Face ID / fingerprint check (and never backs up or syncs).
// Unlocking with it skips the PIN and the slow PBKDF2 step. The PIN always keeps working as a fallback.

const KEY_ITEM = 'billy.vaultKey';
// Not secret: only records that biometric unlock is on, so the lock screen knows whether to offer it.
const ENABLED_ITEM = 'billy.biometricUnlock';

const protectedOptions = (prompt: string): SecureStore.SecureStoreOptions => ({
    requireAuthentication: true,
    authenticationPrompt: prompt,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

export interface BiometricSupport {
    available: boolean;
    /** "Face ID", "Touch ID", "Fingerprint", ... */
    label: string;
    /** Why it's unavailable, when it is. */
    reason?: string;
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
    // Expo Go on iOS doesn't declare a Face ID usage description, so the OS refuses biometric keychain
    // access there. The installed app (IPA) declares it.
    if (Platform.OS === 'ios' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        return { available: false, label: 'Face ID', reason: 'Face ID works in the installed app, not in Expo Go.' };
    }
    try {
        const [hasHardware, enrolled, types] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
            LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const label = Platform.OS === 'ios'
            ? (face ? 'Face ID' : 'Touch ID')
            : (face && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'Face unlock' : 'Fingerprint');
        if (!hasHardware) return { available: false, label, reason: 'This device has no biometric sensor.' };
        if (!enrolled) return { available: false, label, reason: `Set up ${label} in your device settings first.` };
        return { available: true, label };
    } catch {
        return { available: false, label: 'Biometrics', reason: 'Biometrics are unavailable.' };
    }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
    try {
        return (await SecureStore.getItemAsync(ENABLED_ITEM)) === '1';
    } catch {
        return false;
    }
}

/** Stores the vault key behind biometrics. Resolves false if the user cancels or it can't be stored. */
export async function enableBiometricUnlock(vaultKey: VaultKey, label: string): Promise<boolean> {
    try {
        // iOS only asks for Face ID when reading the entry back, so confirm it works before relying on it.
        // (Android prompts while writing the entry.)
        if (Platform.OS === 'ios') {
            const check = await LocalAuthentication.authenticateAsync({ promptMessage: `Turn on ${label} unlock`, disableDeviceFallback: true });
            if (!check.success) return false;
        }
        await SecureStore.deleteItemAsync(KEY_ITEM).catch(() => {});
        await SecureStore.setItemAsync(KEY_ITEM, serializeVaultKey(vaultKey), protectedOptions(`Turn on ${label} unlock`));
        await SecureStore.setItemAsync(ENABLED_ITEM, '1');
        return true;
    } catch (e) {
        console.warn('Could not enable biometric unlock:', e);
        return false;
    }
}

export async function disableBiometricUnlock(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(KEY_ITEM).catch(() => {}),
        SecureStore.deleteItemAsync(ENABLED_ITEM).catch(() => {}),
    ]);
}

export type BiometricKeyResult =
    | { status: 'ok'; vaultKey: VaultKey }
    /** User cancelled or the scan failed; the PIN is still an option. */
    | { status: 'cancelled' }
    /** The entry is gone, e.g. the OS invalidated it after biometrics were re-enrolled. */
    | { status: 'unavailable' };

export async function getVaultKeyWithBiometrics(): Promise<BiometricKeyResult> {
    try {
        const value = await SecureStore.getItemAsync(KEY_ITEM, protectedOptions('Unlock Billy'));
        if (!value) return { status: 'unavailable' };
        return { status: 'ok', vaultKey: deserializeVaultKey(value) };
    } catch (e) {
        const message = String(e).toLowerCase();
        if (message.includes('cancel') || message.includes('authentication failed') || message.includes('user')) {
            return { status: 'cancelled' };
        }
        console.warn('Biometric key unavailable:', e);
        return { status: 'unavailable' };
    }
}
