import {
    decryptVault,
    decryptVaultWithKey,
    deriveVaultKey,
    deserializeVaultKey,
    encryptWithKey,
    serializeVaultKey,
} from '../cryptoWrapper';
import { pbkdf2Sha256 } from '../pbkdf2';

const bytes = (text: string) => new TextEncoder().encode(text);
const hex = (data: Uint8Array) => Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const fromBase64 = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const toBase64 = (data: Uint8Array) => btoa(String.fromCharCode(...data));

/** WebCrypto's PBKDF2-HMAC-SHA256: the reference the app's version (hand-tuned for Hermes) must match. */
async function referencePbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number) {
    // Copied, since WebCrypto's types only take views over a plain ArrayBuffer.
    const key = await crypto.subtle.importKey('raw', new Uint8Array(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations }, key, 256);
    return new Uint8Array(bits);
}

describe('pbkdf2Sha256', () => {
    it.each([
        ['RFC 7914 vector', bytes('passwd'), bytes('salt'), 1],
        ['a 6-digit PIN with a 16-byte salt', bytes('123456'), new Uint8Array(16).fill(7), 1000],
        ['a password longer than the 64-byte block (hashed first)', bytes('x'.repeat(100)), bytes('salt'), 3],
        ['exactly 64 bytes', bytes('y'.repeat(64)), bytes('salt'), 3],
        ['an empty salt', bytes('pin'), new Uint8Array(0), 2],
        ['a salt that spills into a second block', bytes('pin'), new Uint8Array(60).fill(1), 2],
        ['enough rounds to yield to the event loop', bytes('654321'), randomBytes(16), 9000],
    ])('matches the reference: %s', async (_name, password, salt, iterations) => {
        expect(hex(await pbkdf2Sha256(password, salt, iterations))).toBe(hex(await referencePbkdf2(password, salt, iterations)));
    });

    it('matches at the vault strength (100,000 rounds)', async () => {
        const salt = randomBytes(16);
        expect(hex(await pbkdf2Sha256(bytes('024680'), salt, 100_000))).toBe(hex(await referencePbkdf2(bytes('024680'), salt, 100_000)));
    });
});

describe('vault encryption', () => {
    const plaintext = JSON.stringify({ bills: [{ name: 'Café rent ☕', cost: 1200 }], note: 'x'.repeat(10_000) });
    let vaultKey: Awaited<ReturnType<typeof deriveVaultKey>>;

    beforeAll(async () => {
        vaultKey = await deriveVaultKey('123456');
    });

    it('round-trips with the PIN, including non-ASCII text', async () => {
        const payload = encryptWithKey(plaintext, vaultKey);
        const { data, vaultKey: derived } = await decryptVault(payload, '123456');
        expect(data).toBe(plaintext);
        expect(hex(derived.key)).toBe(hex(vaultKey.key));
    });

    it('stores salt, IV and ciphertext as base64, without the plaintext', () => {
        const payload = encryptWithKey(plaintext, vaultKey);
        const raw = fromBase64(payload);
        expect(hex(raw.subarray(0, 16))).toBe(hex(vaultKey.salt));
        expect(raw.length).toBe(16 + 12 + bytes(plaintext).length + 16);
        expect(payload).not.toContain('rent');
    });

    it('uses a fresh IV for every save', () => {
        expect(encryptWithKey(plaintext, vaultKey)).not.toBe(encryptWithKey(plaintext, vaultKey));
    });

    it('rejects a wrong PIN', async () => {
        await expect(decryptVault(encryptWithKey(plaintext, vaultKey), '654321')).rejects.toThrow();
    });

    it('rejects a tampered vault', async () => {
        const raw = fromBase64(encryptWithKey(plaintext, vaultKey));
        raw[40] ^= 1;
        await expect(decryptVault(toBase64(raw), '123456')).rejects.toThrow();
    });

    it('decrypts with a stored key (biometric unlock), but not one from a different vault', async () => {
        const payload = encryptWithKey(plaintext, vaultKey);
        const restored = deserializeVaultKey(serializeVaultKey(vaultKey));
        expect(decryptVaultWithKey(payload, restored)).toBe(plaintext);

        const otherVault = await deriveVaultKey('123456');
        expect(() => decryptVaultWithKey(payload, otherVault)).toThrow('Stored key belongs to a different vault');
    });
});
