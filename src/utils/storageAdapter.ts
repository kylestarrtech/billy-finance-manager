import { File, Paths } from 'expo-file-system';

// The encrypted vault lives in the app's private documents directory (the mobile equivalent of the
// Tauri AppData file). Nothing in here is readable by other apps.
const FILE_NAME = 'billy_secure_vault.json';
const TEMP_FILE_NAME = `${FILE_NAME}.tmp`;

const vaultFile = () => new File(Paths.document, FILE_NAME);
const tempFile = () => new File(Paths.document, TEMP_FILE_NAME);

export const storageAdapter = {
    async get(): Promise<string | null> {
        try {
            const vault = vaultFile();
            if (vault.exists) return await vault.text();

            // A previous write may have been interrupted between the delete and the rename.
            const temp = tempFile();
            if (temp.exists) return await temp.text();
            return null;
        } catch (e) {
            console.warn('storageAdapter.get failed:', e);
            return null;
        }
    },
    async set(data: string): Promise<void> {
        // Write to a temp file first and swap it in, so a crash mid-write can't corrupt the vault.
        const temp = tempFile();
        if (temp.exists) temp.delete();
        temp.create();
        temp.write(data);

        const vault = vaultFile();
        if (vault.exists) vault.delete();
        temp.rename(FILE_NAME);
    },
    async clear(): Promise<void> {
        for (const file of [vaultFile(), tempFile()]) {
            try {
                if (file.exists) file.delete();
            } catch (e) {
                console.warn('storageAdapter.clear failed:', e);
            }
        }
    }
};
