/**
 * DeepSeek Web PoW (Proof of Work) solver
 * 
 * Strategy: WASM (sha3_wasm_bg.wasm) primary, pure JS keccak-256 fallback.
 * 
 * The WASM module exports `wasm_solve(retptr, ch_ptr, ch_len, pfx_ptr, pfx_len, difficulty)`
 * and `wasm_deepseek_hash_v1(ptr, len)` for keccak-256 hashing.
 * 
 * difficulty=18 → ~262k expected iterations → ~0.5-2s with WASM vs 60s+ with pure JS BigInt.
 */

import { debugLog } from '../../../shared/logging/debug.js';

// ── WASM singleton ──────────────────────────────────────────────
let _wasmInstance = null;
let _wasmMemory = null;
let _wasmReady = false;

/**
 * Load and instantiate the WASM module. Safe to call multiple times.
 * @returns {Promise<boolean>} true if WASM is ready
 */
export async function initWasm() {
    if (_wasmReady && _wasmInstance) return true;
    try {
        const wasmUrl = chrome.runtime.getURL('services/providers/shared/sha3_wasm_bg.wasm');
        const response = await fetch(wasmUrl);
        if (!response.ok) throw new Error(`WASM fetch failed: ${response.status}`);
        const wasmBuffer = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(wasmBuffer, {});
        _wasmInstance = result.instance;
        _wasmMemory = _wasmInstance.exports.memory;
        _wasmReady = true;
        debugLog('[DeepSeek Web PoW] WASM loaded successfully');
        return true;
    } catch (e) {
        debugLog(`[DeepSeek Web PoW] WASM init failed, will use JS fallback: ${e.message}`);
        _wasmReady = false;
        return false;
    }
}

// ── WASM solve path ────────────────────────────────────────────
function wasmSolve(challenge) {
    const { challenge: chalStr, salt, difficulty, algorithm, signature, target_path } = challenge;
    const prefix = `${salt}_${challenge.expire_at}_`;
    const exports = _wasmInstance.exports;
    const mem = _wasmMemory;

    // Write string to WASM linear memory
    function writeString(str) {
        const encoded = new TextEncoder().encode(str);
        const length = encoded.length;
        const ptr = exports.__wbindgen_export_0(length, 1);
        const view = new Uint8Array(mem.buffer);
        view.set(encoded, ptr);
        return { ptr, length };
    }

    // Allocate return pointer on stack
    const retptr = exports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const chalInfo = writeString(chalStr);
        const prefixInfo = writeString(prefix);

        exports.wasm_solve(
            retptr,
            chalInfo.ptr,
            chalInfo.length,
            prefixInfo.ptr,
            prefixInfo.length,
            difficulty
        );

        const view32 = new Int32Array(mem.buffer);
        const status = view32[retptr / 4];

        if (status === 0) {
            throw new Error('WASM solver returned status=0 (no solution)');
        }

        const view64 = new Float64Array(mem.buffer);
        const value = view64[(retptr + 8) / 8];
        const answer = Math.floor(value);
        debugLog(`[DeepSeek Web PoW] WASM solved: nonce=${answer}, difficulty=${difficulty}`);
        return answer;
    } finally {
        exports.__wbindgen_add_to_stack_pointer(16);
    }
}

// ── Pure JS keccak-256 fallback (slow, for difficulty <= 8) ─────
const KECCAK_ROUNDS = 24;
const KECCAK_RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const ROTATIONS = [
    [0, 1, 62, 28, 27], [36, 44, 6, 55, 20], [3, 10, 43, 25, 39],
    [41, 45, 15, 21, 8], [18, 2, 61, 56, 14],
];

function rotl64(x, n) {
    n = n % 64n;
    return n === 0n ? x : ((x << n) | (x >> (64n - n))) & 0xffffffffffffffffn;
}

function keccakP(state) {
    const a = state.map((v) => BigInt(v));
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
        const c = Array(5).fill(0n);
        for (let i = 0; i < 5; i++) c[i] = a[i] ^ a[i + 5] ^ a[i + 10] ^ a[i + 15] ^ a[i + 20];
        const d = Array(5).fill(0n);
        for (let i = 0; i < 5; i++) d[i] = c[(i + 4) % 5] ^ rotl64(c[(i + 1) % 5], 1n);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) a[i + 5 * j] ^= d[i];
        const b = Array(25).fill(0n);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
            b[j + 5 * ((2 * i + 3 * j) % 5)] = rotl64(a[i + 5 * j], BigInt(ROTATIONS[i][j]));
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
            a[i + 5 * j] = b[i + 5 * j] ^ ((~b[(i + 1) % 5 + 5 * j]) & b[(i + 2) % 5 + 5 * j]);
        a[0] ^= KECCAK_RC[round];
    }
    return a.map((v) => Number(v) | 0);
}

function keccak256(data) {
    const rateBytes = 136;
    const padded = new Uint8Array(data.length + 1 + ((rateBytes - ((data.length + 1) % rateBytes)) % rateBytes));
    padded.set(data);
    padded[data.length] = 0x01;
    padded[padded.length - 1] = 0x80;
    const state = Array(25).fill(0);
    for (let offset = 0; offset < padded.length; offset += rateBytes) {
        const block = padded.slice(offset, Math.min(offset + rateBytes, padded.length));
        for (let i = 0; i < Math.min(rateBytes / 8, 25); i++) {
            let word = 0n;
            for (let j = 0; j < 8; j++) {
                const idx = i * 8 + j;
                if (idx < block.length) word |= BigInt(block[idx]) << BigInt(j * 8);
            }
            state[i] ^= Number(word) | 0;
        }
        keccakP(state);
    }
    const hash = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
        const word = BigInt(state[i] >= 0 ? state[i] : state[i] >>> 0);
        for (let j = 0; j < 8; j++) hash[i * 8 + j] = Number((word >> BigInt(j * 8)) & 0xffn);
    }
    return hash;
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
}

function jsSolve(challenge) {
    const { challenge: chalStr, salt: saltStr, difficulty } = challenge;
    if (difficulty > 8) {
        debugLog(`[DeepSeek Web PoW] JS fallback: difficulty=${difficulty} too high, may be slow`);
    }
    const saltBytes = hexToBytes(saltStr);
    const challengeBytes = new TextEncoder().encode(chalStr);
    const maskBytes = Math.floor(difficulty / 8);
    const maskBits = difficulty % 8;
    const mask = new Uint8Array(32);
    for (let i = 0; i < maskBytes; i++) mask[i] = 0x00;
    if (maskBits > 0) mask[maskBytes] = 0xff << (8 - maskBits) & 0xff;

    for (let nonce = 0; ; nonce++) {
        const nonceBytes = new TextEncoder().encode(nonce.toString());
        const data = new Uint8Array(saltBytes.length + challengeBytes.length + nonceBytes.length);
        data.set(saltBytes, 0);
        data.set(challengeBytes, saltBytes.length);
        data.set(nonceBytes, saltBytes.length + challengeBytes.length);
        const hash = keccak256(data);
        let valid = true;
        for (let i = 0; i < 32; i++) {
            if ((hash[i] & mask[i]) !== 0) { valid = false; break; }
        }
        if (valid) {
            debugLog(`[DeepSeek Web PoW] JS solved: nonce=${nonce}, difficulty=${difficulty}`);
            return nonce;
        }
    }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Solve PoW challenge. Uses WASM if available, falls back to pure JS.
 * @param {object} challenge - {algorithm, challenge, salt, difficulty, signature, target_path, expire_at}
 * @returns {Promise<number>} The nonce that satisfies the difficulty requirement
 */
export async function solvePow(challenge) {
    // Try WASM first
    if (_wasmReady && _wasmInstance) {
        try {
            return wasmSolve(challenge);
        } catch (e) {
            debugLog(`[DeepSeek Web PoW] WASM solve failed, falling back to JS: ${e.message}`);
        }
    }
    // Pure JS fallback
    return jsSolve(challenge);
}

/**
 * Build PoW response for the x-ds-pow-response header.
 * @param {object} challenge - The challenge object from API
 * @param {number} answer - The solved nonce
 * @returns {string} Base64-encoded JSON
 */
export function buildPowResponse(challenge, answer) {
    const payload = {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        salt: challenge.salt,
        answer: answer,
        signature: challenge.signature,
        target_path: challenge.target_path,
    };
    return btoa(JSON.stringify(payload));
}

/**
 * Fetch PoW challenge from DeepSeek.
 * @param {string} token - JWT token
 * @param {string} targetPath - API path being challenged
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} Challenge object
 */
export async function fetchPowChallenge(token, targetPath = '/api/v0/chat/completion', signal) {
    const resp = await fetch('https://chat.deepseek.com/api/v0/chat/create_pow_challenge', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'origin': 'https://chat.deepseek.com',
            'referer': 'https://chat.deepseek.com/',
            'authorization': `Bearer ${token}`,
            'x-client-version': '2.0.2',
            'x-client-platform': 'web',
        },
        body: JSON.stringify({ target_path: targetPath }),
        signal,
    });
    if (!resp.ok) throw new Error(`PoW challenge request failed: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const bizData = data?.data?.biz_data;
    if (!bizData?.challenge) throw new Error('No challenge in PoW response: ' + JSON.stringify(data).slice(0, 200));
    return bizData.challenge;
}