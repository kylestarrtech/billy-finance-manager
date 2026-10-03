import { gcm } from '@noble/ciphers/aes.js';
import { getRandomBytes } from 'expo-crypto';
import { pbkdf2Sha256 } from './pbkdf2';

// Vault payload layout (identical to the original WebCrypto version):
//   base64( salt[16] | iv[12] | AES-256-GCM ciphertext + 16 byte tag )
// The key is PBKDF2-SHA256(pin, salt, 100k iterations).
//
// React Native's Hermes engine has no WebCrypto `subtle`, so AES-GCM comes from the audited pure-JS
// @noble/ciphers and PBKDF2 from a word-level implementation tuned for Hermes (./pbkdf2.ts, ~6x faster
// than a generic one). Even so, 100k iterations take a couple of seconds on a phone, so the derived
// key is cached for the session and reused for every autosave (each save still gets a fresh IV).

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100_000;

export interface VaultKey {
    key: Uint8Array;
    salt: Uint8Array;
}

const utf8Encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const utf8Decode = (bytes: Uint8Array): string => {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
    }
    // Fallback for runtimes without TextDecoder.
    let out = '';
    for (let i = 0; i < bytes.length; ) {
        const b = bytes[i++];
        let cp: number;
        if (b < 0x80) cp = b;
        else if (b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        else if (b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        out += String.fromCodePoint(cp);
    }
    return out;
};

const toBase64 = (bytes: Uint8Array): string => {
    let binStr = '';
    // Chunked to stay well under engine argument-count limits for large vaults.
    const CHUNK = 0x1000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binStr += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binStr);
};

const fromBase64 = (base64: string): Uint8Array => {
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return bytes;
};

export const deriveVaultKey = async (pin: string, salt: Uint8Array = getRandomBytes(SALT_LENGTH)): Promise<VaultKey> => {
    const started = Date.now();
    const key = await pbkdf2Sha256(utf8Encode(pin), salt, PBKDF2_ITERATIONS);
    if (__DEV__) console.log(`[vault] key derivation took ${Date.now() - started}ms`);
    return { key, salt };
};

export const encryptWithKey = (data: string, vaultKey: VaultKey): string => {
    const iv = getRandomBytes(IV_LENGTH);
    const encrypted = gcm(vaultKey.key, iv).encrypt(utf8Encode(data));

    const payload = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.length);
    payload.set(vaultKey.salt, 0);
    payload.set(iv, SALT_LENGTH);
    payload.set(encrypted, SALT_LENGTH + IV_LENGTH);
    return toBase64(payload);
};

/**
 * Decrypts a vault payload with the given PIN. Returns the plaintext together with the derived key so
 * subsequent saves can skip PBKDF2. Throws if the PIN is wrong or the payload has been tampered with.
 */
export const decryptVault = async (base64Payload: string, pin: string): Promise<{ data: string; vaultKey: VaultKey }> => {
    const payload = fromBase64(base64Payload);
    const salt = payload.slice(0, SALT_LENGTH);
    const iv = payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = payload.slice(SALT_LENGTH + IV_LENGTH);

    const vaultKey = await deriveVaultKey(pin, salt);
    const decrypted = gcm(vaultKey.key, iv).decrypt(ciphertext);
    return { data: utf8Decode(decrypted), vaultKey };
};
