/**
 * Client-side crypto for the takings. Everything here runs in the owner's
 * browser — nothing in this file is ever executed with a key on the server,
 * because the server has none.
 *
 * Envelope scheme:
 *   passphrase --PBKDF2-SHA256--> KEK --AES-GCM unwrap--> data key
 *   data key --AES-256-GCM--> {"cash":n,"card":n,"other":n}
 *
 * The data key is random, so changing the passphrase re-wraps one small
 * blob instead of re-encrypting every day, and a recovery code is just a
 * second wrapping of the same key.
 */

/** OWASP's 2023 floor for PBKDF2-SHA256. Stored per business so it can rise. */
export const DEFAULT_ITERATIONS = 600_000;

/** Shortest passphrase we will accept. A stolen database is brute-forced offline. */
export const MIN_PASSPHRASE_LENGTH = 10;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** A fresh salt for a passphrase or a recovery code. */
export function newSalt(): string {
  return toBase64(randomBytes(16));
}

/** Stretch a passphrase into the key that wraps the data key. */
export async function deriveKek(
  passphrase: string,
  salt: string,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(salt) as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** The random key that actually encrypts the takings. */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function sealBytes(key: CryptoKey, plain: Uint8Array): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      plain as BufferSource
    )
  );
  const joined = new Uint8Array(iv.length + ct.length);
  joined.set(iv);
  joined.set(ct, iv.length);
  return toBase64(joined);
}

async function openBytes(key: CryptoKey, sealed: string): Promise<Uint8Array> {
  const raw = fromBase64(sealed);
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource
    )
  );
}

/** Wrap the data key for storage. */
export async function wrapDataKey(
  kek: CryptoKey,
  dataKey: CryptoKey
): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dataKey));
  return sealBytes(kek, raw);
}

/**
 * Unwrap the data key. Throws when the passphrase is wrong — AES-GCM's auth
 * tag fails, which is the whole password check; nothing comparable to a
 * password hash is stored.
 */
export async function unwrapDataKey(
  kek: CryptoKey,
  wrapped: string
): Promise<CryptoKey> {
  const raw = await openBytes(kek, wrapped);
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

/** The figures for one day, as the owner types them. */
export type Takings = {
  cash: number;
  card: number;
  other: number;
};

/**
 * Encrypt a day's takings.
 *
 * The JSON is padded to a fixed width first: AES-GCM does not hide length,
 * so without padding the size of the ciphertext would betray the size of
 * the numbers to anyone reading the table.
 */
const PADDED_LENGTH = 128;

export async function sealTakings(
  dataKey: CryptoKey,
  takings: Takings
): Promise<string> {
  const json = JSON.stringify({
    cash: takings.cash,
    card: takings.card,
    other: takings.other,
  });
  if (json.length > PADDED_LENGTH) throw new Error("takings too large");
  return sealBytes(dataKey, enc.encode(json.padEnd(PADDED_LENGTH, " ")));
}

export async function openTakings(
  dataKey: CryptoKey,
  sealed: string
): Promise<Takings> {
  const parsed = JSON.parse(dec.decode(await openBytes(dataKey, sealed)).trim());
  return {
    cash: Number(parsed.cash) || 0,
    card: Number(parsed.card) || 0,
    other: Number(parsed.other) || 0,
  };
}

/**
 * A recovery code the owner writes down: 32 random characters in groups of
 * four. Unambiguous alphabet — no O/0 or I/1 to mis-copy off paper.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const bytes = randomBytes(32);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return (chars.join("").match(/.{1,4}/g) ?? []).join("-");
}

/** Compare recovery codes as typed: case and dashes do not matter. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
