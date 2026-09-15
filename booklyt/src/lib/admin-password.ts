import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto"

const ITERATIONS = 210_000
const KEY_LENGTH = 32
const DIGEST = "sha256"

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex")

  return { salt, hash }
}

export function verifyAdminPassword(password: string, salt: string, expectedHash: string) {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)
  const expected = Buffer.from(expectedHash, "hex")

  return hash.length === expected.length && timingSafeEqual(hash, expected)
}
