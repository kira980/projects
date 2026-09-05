import { describe, it, expect } from "vitest";
import {
  deriveKek,
  generateDataKey,
  wrapDataKey,
  unwrapDataKey,
  sealTakings,
  openTakings,
  newSalt,
  generateRecoveryCode,
  normalizeRecoveryCode,
} from "./crypto";

// Real PBKDF2 at 600k iterations is slow by design; the scheme is identical
// at a lower count, so the tests use one that keeps the suite quick.
const ITER = 10_000;

async function setup(passphrase: string) {
  const salt = newSalt();
  const kek = await deriveKek(passphrase, salt, ITER);
  const dataKey = await generateDataKey();
  const wrapped = await wrapDataKey(kek, dataKey);
  return { salt, wrapped, dataKey };
}

describe("envelope", () => {
  it("round-trips the takings through a passphrase", async () => {
    const { salt, wrapped } = await setup("a good long passphrase");
    const kek = await deriveKek("a good long passphrase", salt, ITER);
    const dataKey = await unwrapDataKey(kek, wrapped);

    const sealed = await sealTakings(dataKey, { cash: 6750, card: 1234.5, other: 0 });
    expect(await openTakings(dataKey, sealed)).toEqual({
      cash: 6750,
      card: 1234.5,
      other: 0,
    });
  });

  it("refuses the wrong passphrase", async () => {
    const { salt, wrapped } = await setup("a good long passphrase");
    const wrong = await deriveKek("a good long passphrose", salt, ITER);
    await expect(unwrapDataKey(wrong, wrapped)).rejects.toThrow();
  });

  it("a second wrapping of the same key also opens the data", async () => {
    // How a recovery code is added later without re-encrypting anything.
    const { salt, wrapped } = await setup("original passphrase");
    const kek = await deriveKek("original passphrase", salt, ITER);
    const dataKey = await unwrapDataKey(kek, wrapped);
    const sealed = await sealTakings(dataKey, { cash: 100, card: 200, other: 0 });

    const recoverySalt = newSalt();
    const recoveryKek = await deriveKek("RECOVERYCODE", recoverySalt, ITER);
    const recoveryWrapped = await wrapDataKey(recoveryKek, dataKey);

    const viaRecovery = await unwrapDataKey(
      await deriveKek("RECOVERYCODE", recoverySalt, ITER),
      recoveryWrapped
    );
    expect(await openTakings(viaRecovery, sealed)).toEqual({
      cash: 100,
      card: 200,
      other: 0,
    });
  });

  it("hides the size of the numbers behind a fixed ciphertext length", async () => {
    const { dataKey } = await setup("a good long passphrase");
    const small = await sealTakings(dataKey, { cash: 1, card: 1, other: 1 });
    const large = await sealTakings(dataKey, {
      cash: 987654.32,
      card: 123456.78,
      other: 9999,
    });
    expect(small.length).toBe(large.length);
  });

  it("gives a different ciphertext every time for the same figures", async () => {
    const { dataKey } = await setup("a good long passphrase");
    const a = await sealTakings(dataKey, { cash: 500, card: 0, other: 0 });
    const b = await sealTakings(dataKey, { cash: 500, card: 0, other: 0 });
    expect(a).not.toBe(b);
  });

  it("detects a tampered ciphertext instead of returning a wrong number", async () => {
    const { dataKey } = await setup("a good long passphrase");
    const sealed = await sealTakings(dataKey, { cash: 500, card: 0, other: 0 });
    const bytes = [...atob(sealed)].map((c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));
    await expect(openTakings(dataKey, tampered)).rejects.toThrow();
  });
});

describe("recovery code", () => {
  it("is grouped for copying off paper and avoids look-alike characters", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){7}$/);
    expect(code).not.toMatch(/[O01I]/);
  });

  it("is forgiving about case and dashes when typed back", () => {
    expect(normalizeRecoveryCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeRecoveryCode("ABCD 2345")).toBe("ABCD2345");
  });
});
