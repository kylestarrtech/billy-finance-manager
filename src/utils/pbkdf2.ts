// PBKDF2-HMAC-SHA256 specialised for a single 32-byte output block.
//
// General-purpose JS implementations (including @noble/hashes) spend most of their time on object and
// byte<->word bookkeeping, which is expensive on Hermes since it has no JIT. For a 32-byte key every
// HMAC input after the first has the same fixed shape, so this keeps everything as 32-bit words,
// precomputes the ipad/opad states once, and runs a single tight loop.
// Output is identical to WebCrypto's PBKDF2 (verified against @noble/hashes in tests).

const K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = new Int32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** Runs one SHA-256 compression of the 16 words in w[0..15] into `state` (w is used as scratch). */
function compress(state: Int32Array, w: Int32Array) {
    for (let i = 16; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = state[0], b = state[1], c = state[2], d = state[3];
    let e = state[4], f = state[5], g = state[6], h = state[7];

    for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
    }

    state[0] = (state[0] + a) | 0;
    state[1] = (state[1] + b) | 0;
    state[2] = (state[2] + c) | 0;
    state[3] = (state[3] + d) | 0;
    state[4] = (state[4] + e) | 0;
    state[5] = (state[5] + f) | 0;
    state[6] = (state[6] + g) | 0;
    state[7] = (state[7] + h) | 0;
}

/** Big-endian bytes -> words, zero padded, with an optional 0x80 terminator + bit length (SHA padding). */
function loadBlocks(bytes: Uint8Array, prefixBytes: number): Int32Array[] {
    const totalBits = (prefixBytes + bytes.length) * 8;
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, totalBits);
    const blocks: Int32Array[] = [];
    for (let off = 0; off < padded.length; off += 64) {
        const w = new Int32Array(64);
        for (let i = 0; i < 16; i++) w[i] = view.getInt32(off + i * 4);
        blocks.push(w);
    }
    return blocks;
}

const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    // HMAC key: hash it first if longer than the block size, then pad to 64 bytes.
    let key = password;
    if (key.length > 64) {
        const state = IV.slice();
        for (const w of loadBlocks(key, 0)) compress(state, w);
        key = new Uint8Array(32);
        const view = new DataView(key.buffer);
        for (let i = 0; i < 8; i++) view.setInt32(i * 4, state[i]);
    }
    const ipadBlock = new Uint8Array(64);
    const opadBlock = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
        const k = i < key.length ? key[i] : 0;
        ipadBlock[i] = k ^ 0x36;
        opadBlock[i] = k ^ 0x5c;
    }
    const ipadState = IV.slice();
    const opadState = IV.slice();
    const ipadView = new DataView(ipadBlock.buffer);
    const opadView = new DataView(opadBlock.buffer);
    const w = new Int32Array(64);
    for (let i = 0; i < 16; i++) w[i] = ipadView.getInt32(i * 4);
    compress(ipadState, w);
    for (let i = 0; i < 16; i++) w[i] = opadView.getInt32(i * 4);
    compress(opadState, w);

    // U1 = HMAC(password, salt || INT_32_BE(1))
    const firstMessage = new Uint8Array(salt.length + 4);
    firstMessage.set(salt);
    firstMessage[salt.length + 3] = 1;
    const inner = ipadState.slice();
    for (const block of loadBlocks(firstMessage, 64)) compress(inner, block);

    const u = new Int32Array(8);
    const outer = opadState.slice();
    for (let i = 0; i < 8; i++) w[i] = inner[i];
    w[8] = 0x80000000 | 0;
    for (let i = 9; i < 15; i++) w[i] = 0;
    w[15] = (64 + 32) * 8;
    compress(outer, w);
    for (let i = 0; i < 8; i++) u[i] = outer[i];
    const t = u.slice();

    // U2..Un: every HMAC input is now a 32-byte digest, so both blocks have fixed padding.
    const state = new Int32Array(8);
    for (let iter = 1; iter < iterations; iter++) {
        // inner = SHA256(ipad || u)
        for (let i = 0; i < 8; i++) {
            state[i] = ipadState[i];
            w[i] = u[i];
        }
        w[8] = 0x80000000 | 0;
        for (let i = 9; i < 15; i++) w[i] = 0;
        w[15] = 768;
        compress(state, w);

        // u = SHA256(opad || inner)
        for (let i = 0; i < 8; i++) {
            w[i] = state[i];
            state[i] = opadState[i];
        }
        w[8] = 0x80000000 | 0;
        for (let i = 9; i < 15; i++) w[i] = 0;
        w[15] = 768;
        compress(state, w);

        for (let i = 0; i < 8; i++) {
            u[i] = state[i];
            t[i] ^= state[i];
        }

        // Let the UI breathe (spinner, touches) every few thousand rounds.
        if ((iter & 4095) === 0) await yieldToEventLoop();
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) outView.setInt32(i * 4, t[i]);
    return out;
}
