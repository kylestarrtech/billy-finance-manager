export const encryptData = async (data: string, pin: string): Promise<string> => {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]
    );

    const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
    );

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, enc.encode(data)
    );

    const payload = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    payload.set(salt, 0);
    payload.set(iv, salt.length);
    payload.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert Uint8Array to base64
    const binStr = Array.from(payload).map(byte => String.fromCharCode(byte)).join('');
    return btoa(binStr);
};

export const decryptData = async (base64Payload: string, pin: string): Promise<string> => {
    const binStr = atob(base64Payload);
    const payload = new Uint8Array(Array.from(binStr).map(char => char.charCodeAt(0)));
    
    const salt = payload.slice(0, 16);
    const iv = payload.slice(16, 28);
    const ciphertext = payload.slice(28);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]
    );

    const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, ciphertext
    );

    return new TextDecoder().decode(decrypted);
};