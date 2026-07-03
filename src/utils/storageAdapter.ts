import { BaseDirectory, readTextFile, writeTextFile, remove, mkdir, exists } from '@tauri-apps/plugin-fs';

const FILE_NAME = 'billy_secure_vault.json';

const isTauri = () => {
    return '__TAURI_INTERNALS__' in window;
};

export const storageAdapter = {
    async get(): Promise<string | null> {
        if (isTauri()) {
            try {
                if (await exists(FILE_NAME, { baseDir: BaseDirectory.AppData })) {
                    return await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
                }
                return null;
            } catch (e) {
                // file might not exist yet
                return null;
            }
        }
        return localStorage.getItem('billy_secure_vault');
    },
    async set(data: string): Promise<void> {
        if (isTauri()) {
            try {
                if (!(await exists('', { baseDir: BaseDirectory.AppData }))) {
                    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
                }
            } catch (e) {
                // The dir might already exist during the race condition
            }

            await writeTextFile(FILE_NAME, data, { baseDir: BaseDirectory.AppData });
            return;
        }
        localStorage.setItem('billy_secure_vault', data);
    },
    async clear(): Promise<void> {
        if (isTauri()) {
            try {
                await remove(FILE_NAME, { baseDir: BaseDirectory.AppData });
            } catch (e) {}
            return;
        }
        localStorage.removeItem('billy_secure_vault');
    }
};