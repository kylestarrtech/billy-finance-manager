import type { confirmAsync, showAlert } from '../utils/dialogs';

// Stand-ins for the services that need a device (file storage, keychain, notifications, share sheet,
// native alerts). Test files wire them up with jest.mock(path, () => require('.../nativeMocks').x).

/** The encrypted vault "file". */
export const mockVaultFile = { value: null as string | null, writes: 0 };

export const storageAdapterMock = {
    storageAdapter: {
        get: async () => mockVaultFile.value,
        set: async (data: string) => {
            mockVaultFile.value = data;
            mockVaultFile.writes++;
        },
        clear: async () => {
            mockVaultFile.value = null;
        },
    },
};

export const biometricsMock = {
    getBiometricSupport: async () => ({ available: false, label: 'Face ID' }),
    isBiometricUnlockEnabled: async () => false,
    enableBiometricUnlock: async () => false,
    disableBiometricUnlock: async () => {},
    getVaultKeyWithBiometrics: async () => ({ status: 'cancelled' }),
};

export const notificationsMock = {
    cancelAllReminders: async () => {},
    hasReminderPermission: async () => false,
    scheduleReminders: async () => {},
};

/** Confirmations are accepted unless a test says otherwise. */
export const dialogsMock = {
    confirmAsync: jest.fn<ReturnType<typeof confirmAsync>, Parameters<typeof confirmAsync>>(async () => true),
    showAlert: jest.fn<ReturnType<typeof showAlert>, Parameters<typeof showAlert>>(),
};

export const fileSystemMock = {
    Paths: { cache: 'cache', document: 'document' },
    File: class {
        exists = false;
        delete() {}
        create() {}
        write() {}
    },
};

export const sharingMock = { isAvailableAsync: async () => false, shareAsync: async () => {} };

export function resetNativeMocks() {
    mockVaultFile.value = null;
    mockVaultFile.writes = 0;
    dialogsMock.confirmAsync.mockClear();
    dialogsMock.confirmAsync.mockImplementation(async () => true);
    dialogsMock.showAlert.mockClear();
}
